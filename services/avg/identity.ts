import type { AvgPortraitAsset, AvgPortraitBinding } from '../../models/avg';
import type { NPC结构 } from '../../models/social';

export const normalizeAvgTheme = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value.trim())) return '';
    const id = value.trim();
    if (id === 'general' || id === 'generic') return '';
    return id === 'shuihu_jinpingmei' ? 'shuihu-jinpingmei' : id;
};
export const isGeneralAvgAsset = (asset: { themeId?: string }): boolean => !normalizeAvgTheme(asset.themeId);
export const isAvgBasePortrait = (asset: AvgPortraitAsset): boolean => asset.baseAssetId === asset.id
    || (!asset.baseAssetId && !asset.variantStage);

/** Exact canonical names are used only inside the player's chosen story theme. */
export const namedAvgCharacterKey = (npc: NPC结构, assets: AvgPortraitAsset[], theme?: string): string | undefined => {
    if (npc.AVG具名角色Key) return npc.AVG具名角色Key;
    const selectedTheme = normalizeAvgTheme(theme);
    if (!selectedTheme) return undefined;
    const keys = new Set(assets.filter(asset => asset.themeId === selectedTheme && isAvgBasePortrait(asset)
        && asset.characterKey && (asset.label === npc.姓名.trim() || asset.aliases?.includes(npc.姓名.trim())))
        .map(asset => asset.characterKey!));
    return keys.size === 1 ? [...keys][0] : undefined;
};

/** Variants require an explicit base identity. A shared family resemblance never joins different NPCs. */
export const avgSamePersonOptions = (binding: AvgPortraitBinding | undefined, assets: AvgPortraitAsset[]): AvgPortraitAsset[] => {
    const current = assets.find(asset => asset.id === binding?.assetId);
    const baseId = binding?.baseAssetId || current?.baseAssetId || current?.id;
    const base = assets.find(asset => asset.id === baseId && isAvgBasePortrait(asset));
    if (!base) return [];
    return assets.filter(asset => (asset.id === base.id || asset.baseAssetId === base.id)
        && asset.gender === base.gender && asset.characterKey === base.characterKey
        && (!base.faceFamilyKey || asset.faceFamilyKey === base.faceFamilyKey));
};

export const avgBindingForAsset = (npcId: string, asset: AvgPortraitAsset, reason: AvgPortraitBinding['reason']): AvgPortraitBinding => ({
    npcId, assetId: asset.id, baseAssetId: asset.baseAssetId || asset.id,
    characterKey: asset.characterKey, faceFamilyKey: asset.faceFamilyKey,
    version: asset.version, image: asset.image, reason
});
