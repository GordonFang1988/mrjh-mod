import type { 聊天记录结构, NPC结构, 场景图片档案, 环境信息结构 } from '../../types';
import { getAvgPackCatalog, getAvgPackImageBlob, isAvgPackImage, listAvgArtPacks, loadAvgPackCatalog } from './packStore';
import { getAvgPortraitAssets, resolveAvgPortraits } from './portraitResolver';
import { namedAvgCharacterKey, isAvgBasePortrait } from './identity';
import { readAvgDisplay } from './displayPreferences';
import { buildAvgPresentation, sceneAssetsFromArchive } from './sceneResolver';

export const buildAvgDiagnostic = async (input: {
    history: 聊天记录结构[]; social: NPC结构[]; environment: 环境信息结构;
    theme?: string; archive?: 场景图片档案;
}) => {
    await loadAvgPackCatalog();
    const { history, social, environment, theme, archive } = input;
    const portraits = getAvgPortraitAssets();
    const latest = [...history].reverse().find(turn => turn.structuredResponse)?.structuredResponse;
    const freshlyResolved = resolveAvgPortraits(latest?.logs || [], social, history, portraits, theme);
    const assetAvailable = async (image?: string) => !image ? 'no-image'
        : isAvgPackImage(image) ? await getAvgPackImageBlob(image) ? 'local-file-present' : 'local-file-missing' : 'external-or-generated';
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
    const scenes = await Promise.all((latest?.avgPresentation?.scenes || []).map(async scene => ({
        ...scene, availability: await assetAvailable(scene.image)
    })));
    const stage = [...document.querySelectorAll<HTMLElement>('[aria-label="AVG 演出舞台，左右方向键翻页"]')].reverse()
        .find(element => element.getBoundingClientRect().width > 0);
    const catalog = getAvgPackCatalog();
    return {
        schema: 'mrjh-diagnostic-v1', exportedAt: new Date().toISOString(),
        app: { url: `${location.origin}${location.pathname}`, userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight } },
        theme: theme || 'general', environment, displayPreferences: readAvgDisplay(),
        resourcePacks: await listAvgArtPacks(), catalog: { scenes: catalog.scenes.length, portraits: catalog.portraits.length },
        latestTurn: { timelineMode: latest?.avgPresentation?.mode, diagnostic: latest?.avgPresentation?.diagnostic,
            hints: latest?.avgSceneHints, scenes, portraits: actorReports,
            logCount: latest?.logs?.length || 0, sceneMarkerCount: latest?.logs?.filter(log => log.avgSceneRef).length || 0 },
        proposedFinalScene: buildAvgPresentation(latest?.logs || [], latest?.avgSceneHints, environment, [], sceneAssetsFromArchive(archive, theme), {}, theme),
        playback: stage ? { text: stage.innerText.slice(0, 4000),
            images: [...stage.querySelectorAll<HTMLImageElement>('img')].map(image => ({ alt: image.alt,
                loaded: image.complete && image.naturalWidth > 0, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
                portraitMode: image.dataset.avgPortraitStage, transform: getComputedStyle(image).transform })) } : undefined,
        recentTurns: history.slice(-20).map(turn => ({ role: turn.role, timestamp: turn.timestamp,
            logCount: turn.structuredResponse?.logs?.length, presentation: turn.structuredResponse?.avgPresentation,
            portraitBindings: turn.structuredResponse?.avgPortraitBindings,
            commandCount: turn.structuredResponse?.tavern_commands?.length })),
        // Explicit whitelist: API settings, credentials, raw prompts and image bytes are not included.
        contents: 'AVG matching, pack availability, playback and recent turn summaries'
    };
};
