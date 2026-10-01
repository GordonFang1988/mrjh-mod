import type { NPC结构, 聊天记录结构 } from '../../types';
import type { AvgPortraitAsset, AvgPortraitBinding } from '../../models/avg';
import { avgBindingForAsset, avgSamePersonOptions, isAvgBasePortrait } from './identity';
import { findUniqueLegacyAvgAsset, getAvgPackImageBlob, isAvgPackImage, loadAvgPackCatalog } from './packStore';
import { getAvgPortraitAssets } from './portraitResolver';
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

export const recoverMissingAvgArt = async (
    history: 聊天记录结构[], social: NPC结构[], theme?: string, archive?: 场景图片档案
): Promise<{history: 聊天记录结构[]; social: NPC结构[]; repaired: number}> => {
    await loadAvgPackCatalog();
    const portraits = getAvgPortraitAssets();
    const sceneAssets = sceneAssetsFromArchive(archive, theme);
    const missing = new Map<string, Promise<boolean>>();
    const imageMissing = (image?: string): Promise<boolean> => {
        if (!isAvgPackImage(image)) return Promise.resolve(false);
        if (!missing.has(image)) missing.set(image, getAvgPackImageBlob(image).then(blob => !blob));
        return missing.get(image)!;
    };
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
            if (replacement) {
                const next = avgBindingForAsset(binding.npcId, replacement, 'existing-binding');
                if (binding.assetId && next.assetId) migrated.set(binding.assetId, next.assetId);
                if (binding.baseAssetId && next.baseAssetId) migrated.set(binding.baseAssetId, next.baseAssetId);
                bindings[sender] = next;
            } else {
                // Preserve the missing identity so a later reimport can restore it.
                bindings[sender] = {...binding, reason:'no-compatible-art'};
            }
            changed = true; repaired += 1;
        }
        let presentation = response.avgPresentation;
        if (presentation) {
            const scenes = [];
            for (const scene of presentation.scenes) {
                if (!await imageMissing(scene.image)) { scenes.push(scene); continue; }
                const exact = findUniqueLegacyAvgAsset(scene.assetId, sceneAssets);
                if (exact) {
                    scenes.push({...scene,assetId:exact.id,image:exact.image,version:exact.version,profile:exact.profile});
                    changed = true; repaired += 1; continue;
                }
                const parts = scene.placeKey.split('/');
                const env = {大地点:parts[0] || '',中地点:parts[1] || '',小地点:parts[2] || '',具体地点:parts[3] || ''};
                const hint = {ref:'final',地点:env,分类:scene.profile};
                const replacement = buildAvgPresentation([], [hint], env as any, repairedHistory, sceneAssets, {}, theme).scenes[0];
                scenes.push({...replacement,ref:scene.ref,placeKey:scene.placeKey,label:scene.label});
                changed = true; repaired += 1;
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
    return {history:repairedHistory,social:repairedSocial,repaired};
};
