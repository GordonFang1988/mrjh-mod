import type { 聊天记录结构, NPC结构, 场景图片档案, 环境信息结构 } from '../../types';
import type { AvgResolvedScene } from '../../models/avg';
import { 读取图片资源 } from '../dbService';
import { 是否图片资源引用 } from '../../utils/imageAssets';
import { getAvgPackCatalog, getAvgPackImageBlob, isAvgPackImage, listAvgArtPacks, loadAvgPackCatalog } from './packStore';
import { getAvgPortraitAssets, resolveAvgPortraits } from './portraitResolver';
import { namedAvgCharacterKey, isAvgBasePortrait } from './identity';
import { readAvgDisplay } from './displayPreferences';
import { APP_VERSION } from '../../release/version';
import { buildAvgPresentation, inspectAvgSceneCandidates, inspectAvgSceneBindings, sceneAssetsFromArchive } from './sceneResolver';
import { buildAvgSceneSourceEvidence, diagnoseAvgSceneDisplay, diagnoseAvgSceneSource, redactAvgDiagnosticText } from './sceneEvidence';

export const buildAvgDiagnostic = async (input: {
    history: 聊天记录结构[]; social: NPC结构[]; environment: 环境信息结构;
    theme?: string; archive?: 场景图片档案; avgEnabled?: boolean;
}) => {
    let packStorageError = false;
    await loadAvgPackCatalog().catch(() => { packStorageError = true; });
    const { history, social, environment, theme, archive } = input;
    const turns = history.filter(turn => turn.role === 'assistant' && turn.structuredResponse);
    const latestTurn = turns.at(-1);
    const latest = latestTurn?.structuredResponse;
    const sourceEvidence = buildAvgSceneSourceEvidence(latestTurn);
    const portraits = getAvgPortraitAssets();
    const sceneAssets = sceneAssetsFromArchive(archive, theme);
    const freshlyResolved = resolveAvgPortraits(latest?.logs || [], social, history, portraits, theme);
    const availabilityCache = new Map<string, Promise<string>>();
    const assetAvailable = (image?: string): Promise<string> => {
        if (!image) return Promise.resolve('no-image');
        if (!isAvgPackImage(image) && !是否图片资源引用(image)) return Promise.resolve('external-or-generated');
        if (!availabilityCache.has(image)) availabilityCache.set(image, (isAvgPackImage(image) ? getAvgPackImageBlob(image) : 读取图片资源(image))
            .then(blob => blob ? 'local-file-present' : 'local-file-missing').catch(() => 'storage-unavailable'));
        return availabilityCache.get(image)!;
    };
    const actorReports = await Promise.all(Object.entries(latest?.avgPortraitBindings || {}).map(async ([sender, binding]) => {
        const npc = social.find(item => item.id === binding.npcId);
        const key = npc && namedAvgCharacterKey(npc, portraits, theme);
        const current = portraits.find(asset => asset.id === binding.assetId);
        const namedCandidates = portraits.filter(asset => key && asset.characterKey === key && isAvgBasePortrait(asset));
        return { sender, npcId: binding.npcId, age: npc?.年龄, gender: npc?.性别,
            profile: npc?.AVG立绘特征, selection: npc?.AVG美术选择, binding,
            asset: current ? { id: current.id, label: current.label, characterKey: current.characterKey,
                ageRange: current.ageRange, visualAge: current.visualAge, profile: current.profile } : undefined,
            availability: await assetAvailable(binding.image), expectedCharacterKey: key,
            namedCandidates: namedCandidates.map(asset => ({ id: asset.id, label: asset.label, ageRange: asset.ageRange,
                genderMatches: asset.gender === npc?.性别,
                ageMatches: Number(npc?.年龄) >= asset.ageRange.min && Number(npc?.年龄) <= asset.ageRange.max })),
            currentResolution: freshlyResolved[sender]
        };
    }));
    const describeScene = async (scene: AvgResolvedScene) => {
        const asset = sceneAssets.find(asset => asset.id === scene.assetId);
        return { ...scene, availability: await assetAvailable(scene.image),
            selectedAssetInCatalog: !!asset,
            selectedAsset: asset ? { id: asset.id, version: asset.version, profile: asset.profile,
                themeId: asset.themeId, styleFamily: asset.styleFamily } : undefined,
            matching: inspectAvgSceneCandidates(scene.profile, sceneAssets, theme) };
    };
    const scenes = await Promise.all((latest?.avgPresentation?.scenes || []).map(describeScene));
    const inspectTurnBinding = (turn: 聊天记录结构 | undefined, scene: AvgResolvedScene | undefined) => {
        const index = turn ? history.indexOf(turn) : -1;
        return scene ? inspectAvgSceneBindings(index >= 0 ? history.slice(0, index) : [], scene.placeKey, scene.profile, scene.sceneId) : undefined;
    };
    const latestBindingReuse = inspectTurnBinding(latestTurn, scenes[0]);
    const stage = [...document.querySelectorAll<HTMLElement>('[aria-label="AVG 演出舞台，左右方向键翻页"]')].reverse()
        .find(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; });
    const number = (value?: string) => value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
    const shownTurnNumber = number(stage?.dataset.avgTurnNumber);
    const shownTurn = shownTurnNumber !== undefined ? turns[shownTurnNumber] : undefined;
    const shownResponse = shownTurn?.structuredResponse;
    const shownRef = stage?.dataset.avgSceneRef;
    const shownScene = shownResponse?.avgPresentation?.scenes.find(scene => scene.ref === shownRef)
        || (shownResponse?.avgPresentation?.mode === 'final' ? shownResponse.avgPresentation.scenes[0] : undefined);
    const background = stage?.querySelector<HTMLImageElement>('img[data-avg-scene-image]');
    const imageState = stage ? stage.dataset.avgImageState === 'failed' ? 'failed'
        : background ? background.complete ? background.naturalWidth > 0 ? 'loaded' : 'failed' : 'pending'
        : stage.dataset.avgImageState === 'pending' ? 'pending' : 'no-image' : undefined;
    const shownEvidence = shownTurn ? buildAvgSceneSourceEvidence(shownTurn) : undefined;
    const shownSceneReport = shownScene ? await describeScene(shownScene) : undefined;
    const diagnosisSource = shownEvidence || sourceEvidence;
    const diagnosisScene = shownSceneReport || (stage && shownTurn ? undefined : scenes[0]);
    const bindingReuse = shownTurn ? inspectTurnBinding(shownTurn, shownSceneReport) : latestBindingReuse;
    const resourcePacks = await listAvgArtPacks().catch(() => { packStorageError = true; return []; });
    const sceneDiagnosis = {
        scope: shownTurn ? 'playback' : 'latest-turn',
        turnNumber: shownTurnNumber ?? Math.max(0, turns.length - 1),
        ...diagnoseAvgSceneDisplay({ source: diagnosisSource, response: shownResponse || latest,
            scene: diagnosisScene, sceneRef: shownRef || diagnosisScene?.ref, availability: diagnosisScene?.availability,
            candidateCount: diagnosisScene?.matching.counts.category, catalogAvailable: !packStorageError,
            bindingReuseBlockReason: bindingReuse?.blockReason,
            bindingReuseAvailable: bindingReuse?.reuseAllowedByCurrentResolver,
            imageState: shownTurn ? imageState : undefined }),
        limitations: [
            ...(!diagnosisSource.request ? ['该旧回合未保存请求证据，无法确认当时是否附带 AVG 协议；当前开关不代表当时开关。'] : []),
            ...(stage && !shownTurn ? ['当前舞台未提供回合标识，结论针对最新回合，不能认定就是正在播放的回合。'] : []),
            ...(packStorageError ? ['素材库读取失败，候选数量可能不完整。'] : [])
        ]
    };
    const catalog = getAvgPackCatalog();
    const report = {
        schema: 'mrjh-diagnostic-v2', exportedAt: new Date().toISOString(),
        app: { version: APP_VERSION, url: `${location.origin}${location.pathname}`, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } },
        theme: theme || 'general', environment, displayPreferences: readAvgDisplay(), currentSettings: { avgEnabled: input.avgEnabled ?? null },
        sceneDiagnosis,
        resourcePacks, packStorageError, catalog: { scenes: catalog.scenes.length, portraits: catalog.portraits.length },
        latestTurn: { turnNumber: Math.max(0, turns.length - 1), timestamp: latestTurn?.timestamp,
            timelineMode: latest?.avgPresentation?.mode, diagnostic: latest?.avgPresentation?.diagnostic,
            sourceDiagnosis: diagnoseAvgSceneSource(sourceEvidence), sourceEvidence,
            hints: latest?.avgSceneHints, scenes, bindingReuse: latestBindingReuse, portraits: actorReports,
            logCount: latest?.logs?.length || 0, sceneMarkerCount: latest?.logs?.filter(log => log.avgSceneRef).length || 0 },
        proposedFinalScene: buildAvgPresentation(latest?.logs || [], latest?.avgSceneHints, environment, [], sceneAssets, {}, theme),
        playback: stage ? { turnNumber: shownTurnNumber, timestamp: shownTurn?.timestamp,
            step: number(stage.dataset.avgStep), logIndex: number(stage.dataset.avgLogIndex),
            sceneRef: shownRef, placeKey: stage.dataset.avgPlaceKey, assetId: stage.dataset.avgAssetId, imageState,
            scene: shownSceneReport, bindingReuse, sourceEvidence: shownTurn && shownTurn !== latestTurn ? shownEvidence : undefined,
            text: stage.innerText.slice(0, 4000),
            images: [...stage.querySelectorAll<HTMLImageElement>('img')].map(image => ({ alt: image.alt,
                kind: image.dataset.avgSceneImage ? 'scene' : 'portrait', complete: image.complete,
                loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
                portraitMode: image.dataset.avgPortraitStage, transform: getComputedStyle(image).transform })) } : undefined,
        recentTurns: history.slice(-20).map(turn => ({ role: turn.role, timestamp: turn.timestamp,
            logCount: turn.structuredResponse?.logs?.length, presentation: turn.structuredResponse?.avgPresentation,
            portraitBindings: turn.structuredResponse?.avgPortraitBindings,
            commandCount: turn.structuredResponse?.tavern_commands?.length })),
        contents: 'Scene source evidence, request protocol presence, field processing, matching, pack availability and playback. Excludes full prompts, API settings and image bytes.'
    };
    // Sanitize free-text labels, malformed snippets, signed image URLs and embedded image data throughout the whitelist.
    return JSON.parse(JSON.stringify(report, (_key, value) => typeof value === 'string' ? redactAvgDiagnosticText(value) : value)) as typeof report;
};
