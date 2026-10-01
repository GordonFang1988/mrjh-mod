import type { GameResponse, NPC结构, 聊天记录结构 } from '../../types';
import type { AvgPortraitAsset, AvgPortraitBinding, AvgSceneAsset } from '../../models/avg';
import { avgBindingForAsset, avgSamePersonOptions, isAvgBasePortrait } from './identity';
import { findUniqueLegacyAvgAsset, getAvgPackImageBlob, isAvgPackImage, loadAvgPackCatalog } from './packStore';
import { getAvgPortraitAssets, resolveAvgPortraits } from './portraitResolver';
import { buildAvgPresentation, sceneAssetsFromArchive } from './sceneResolver';
import type { 场景图片档案 } from '../../models/imageGeneration';

const localId = (id?: string): string | undefined => id?.slice(id.lastIndexOf(':') + 1);

/** Recovery is limited to the same saved logical person, never a new scored face. */
export const replacementForMissingPortrait = (
    binding: AvgPortraitBinding, npc: NPC结构 | undefined, assets: AvgPortraitAsset[]
): AvgPortraitAsset | undefined => {
    if (!npc) return undefined;
    const age = Number(npc.年龄);
    const exact = findUniqueLegacyAvgAsset(binding.assetId, assets);
    if (exact) {
        const oldBase = binding.baseAssetId || binding.assetId;
        const base = isAvgBasePortrait(exact) ? exact : assets.find(asset => asset.id === exact.baseAssetId && isAvgBasePortrait(asset));
        if (!base || !base.legacyAssetIds?.includes(oldBase || '') || !exact.portraitVerified
            || exact.gender !== npc.性别 || !Number.isFinite(age) || age < exact.ageRange.min || age > exact.ageRange.max
            || (binding.characterKey && exact.characterKey !== binding.characterKey)
            || (binding.faceFamilyKey && exact.faceFamilyKey !== binding.faceFamilyKey)
            || !avgSamePersonOptions(avgBindingForAsset(npc.id, base, 'existing-binding'), assets).some(asset => asset.id === exact.id)) return undefined;
        return exact;
    }
    if (assets.some(asset => asset.legacyAssetIds?.includes(binding.assetId || ''))) return undefined;
    if (!binding.characterKey) return undefined;
    const oldBase = localId(binding.baseAssetId || binding.assetId);
    const bases = assets.filter(asset => isAvgBasePortrait(asset) && asset.portraitVerified
        && asset.characterKey === binding.characterKey && localId(asset.id) === oldBase
        && asset.gender === npc.性别 && Number.isFinite(age)
        && age >= asset.ageRange.min && age <= asset.ageRange.max
        && (!binding.faceFamilyKey || asset.faceFamilyKey === binding.faceFamilyKey));
    if (bases.length !== 1) return undefined;
    const base = bases[0];
    const choices = avgSamePersonOptions(avgBindingForAsset(npc.id, base, 'existing-binding'), assets);
    return choices.find(asset => asset.portraitVerified && age >= asset.ageRange.min && age <= asset.ageRange.max && localId(asset.id) === localId(binding.assetId)) || base;
};

/** Rebuild old automatic fallbacks from the saved model fields; explicit choices stay frozen. */
export const restoreStructuredAvgScenes = (
    response: GameResponse, history: 聊天记录结构[], assets: AvgSceneAsset[], theme?: string
) => {
    const presentation = response.avgPresentation;
    if (!presentation || !['invalid-scene-timeline', 'no-scene-markers', 'missing-scene-fields', 'incomplete-scene-timeline'].includes(presentation.diagnostic || '')
        || (presentation.mode === 'final' && presentation.scenes.some(scene => scene.reason.startsWith('manual-')))) return presentation;
    const parts = (presentation.scenes.at(-1)?.placeKey || '').split('/');
    const env = { 大地点: parts[0] || '', 中地点: parts[1] || '', 小地点: parts[2] || '', 具体地点: parts[3] || '' };
    const restored = buildAvgPresentation(response.logs || [], response.avgSceneHints, env as any, history, assets, {}, theme);
    // A fieldless legacy turn is repairable only when an exact saved identity is available.
    if (['missing-scene-fields', 'incomplete-scene-timeline'].includes(presentation.diagnostic || '')) {
        if (!restored.scenes.some(scene => scene.reason === 'existing-binding' || scene.reason === 'manual-neutral')) return presentation;
        restored.scenes = restored.scenes.map(scene => {
            const saved = presentation.scenes.find(item => item.ref === scene.ref);
            return saved?.assetId || saved?.image ? saved! : scene;
        });
    }
    restored.scenes = restored.scenes.map(scene => {
        const saved = presentation.scenes.find(item => item.ref === scene.ref);
        return saved?.reason.startsWith('manual-') ? saved : scene;
    });
    return JSON.stringify(restored) === JSON.stringify(presentation) ? presentation : restored;
};

export const recoverMissingAvgArt = async (
    history: 聊天记录结构[], social: NPC结构[], theme?: string, archive?: 场景图片档案
): Promise<{history: 聊天记录结构[]; social: NPC结构[]; repaired: number}> => {
    try { await loadAvgPackCatalog(); }
    catch { return { history, social, repaired: 0 }; }
    const portraits = getAvgPortraitAssets();
    const sceneAssets = sceneAssetsFromArchive(archive, theme);
    const missing = new Map<string, Promise<boolean | undefined>>();
    const imageMissing = (image?: string): Promise<boolean | undefined> => {
        if (!isAvgPackImage(image)) return Promise.resolve(false);
        if (!missing.has(image)) missing.set(image, getAvgPackImageBlob(image).then(blob => !blob).catch(() => undefined));
        return missing.get(image)!;
    };
    const imageAvailable = async (image?: string): Promise<boolean> => !!image && await imageMissing(image) === false;
    const migrated = new Map<string, string>();
    const repairedHistory: 聊天记录结构[] = [];
    let repaired = 0;
    for (const turn of history) {
        const response = turn.structuredResponse;
        if (!response) { repairedHistory.push(turn); continue; }
        const bindings = {...response.avgPortraitBindings};
        let changed = false;
        for (const [sender, binding] of Object.entries(bindings)) {
            if (!await imageMissing(binding.image)) continue;
            const npc = social.find(item => item.id === binding.npcId);
            const replacement = replacementForMissingPortrait(binding, npc, portraits);
            if (replacement && await imageAvailable(replacement.image)) {
                const next = avgBindingForAsset(binding.npcId, replacement, 'existing-binding');
                if (binding.assetId && next.assetId) migrated.set(binding.assetId, next.assetId);
                if (binding.baseAssetId && next.baseAssetId) migrated.set(binding.baseAssetId, next.baseAssetId);
                if (JSON.stringify(next) !== JSON.stringify(binding)) {
                    bindings[sender] = next; changed = true; repaired += 1;
                }
            } else {
                // Preserve the missing identity so a later reimport can restore it.
                if (binding.reason !== 'no-compatible-art') {
                    bindings[sender] = {...binding, reason:'no-compatible-art'}; changed = true; repaired += 1;
                }
            }
        }
        const refreshed = resolveAvgPortraits(response.logs || [], social,
            [...repairedHistory, { ...turn, structuredResponse: { ...response, avgPortraitBindings: bindings } }], portraits, theme);
        for (const [sender, next] of Object.entries(refreshed)) {
            const previous = bindings[sender];
            const canRepair = !previous?.assetId || (next.characterKey && !previous.characterKey && previous.reason !== 'manual-prefab');
            if (canRepair && next.assetId && next.assetId !== previous?.assetId && await imageAvailable(next.image)) {
                bindings[sender] = next; changed = true; repaired += 1;
            }
        }
        let presentation = restoreStructuredAvgScenes(response, repairedHistory, sceneAssets, theme);
        if (presentation !== response.avgPresentation) { changed = true; repaired += 1; }
        if (presentation) {
            const scenes = [];
            for (const scene of presentation.scenes) {
                const recoverNeutral = !scene.assetId && !scene.image && scene.reason === 'neutral-background';
                if (!recoverNeutral && !await imageMissing(scene.image)) { scenes.push(scene); continue; }
                const exact = findUniqueLegacyAvgAsset(scene.assetId, sceneAssets);
                if (exact && await imageAvailable(exact.image)) {
                    scenes.push({...scene,assetId:exact.id,image:exact.image,version:exact.version});
                    changed = true; repaired += 1; continue;
                }
                // A missing frozen choice remains identifiable for reimport.
                // Never replace a saved image with a new first-match candidate.
                if (scene.assetId || scene.image) { scenes.push(scene); continue; }
                const parts = scene.placeKey.split('/');
                const env = {大地点:parts[0] || '',中地点:parts[1] || '',小地点:parts[2] || '',具体地点:parts[3] || ''};
                const hint = {ref:'final',场景ID:scene.sceneId,地点:env,分类:scene.profile};
                const replacement = buildAvgPresentation([], [hint], env as any, repairedHistory, sceneAssets, {}, theme).scenes[0];
                const next = {...replacement,sceneId:scene.sceneId || replacement.sceneId,
                    placeAliases:scene.placeAliases || replacement.placeAliases,ref:scene.ref,placeKey:scene.placeKey,label:scene.label};
                if (await imageAvailable(next.image) && JSON.stringify(next) !== JSON.stringify(scene)) {
                    scenes.push(next); changed = true; repaired += 1;
                } else scenes.push(scene);
            }
            if (changed) presentation = {...presentation,scenes};
        }
        repairedHistory.push(changed ? {...turn,structuredResponse:{...response,avgPortraitBindings:bindings,avgPresentation:presentation}} : turn);
    }
    const repairedSocial = social.map(npc => {
        const selection = npc.AVG美术选择;
        if (!selection) return npc;
        const baseAssetId = migrated.get(selection.baseAssetId || '') || selection.baseAssetId;
        const assetId = migrated.get(selection.assetId || '') || selection.assetId;
        return baseAssetId !== selection.baseAssetId || assetId !== selection.assetId
            ? {...npc,AVG美术选择:{...selection,baseAssetId,assetId}} : npc;
    });
    return {history:repaired > 0 ? repairedHistory : history,
        social:repairedSocial.some((npc, index) => npc !== social[index]) ? repairedSocial : social,repaired};
};
