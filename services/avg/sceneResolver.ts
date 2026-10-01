import type { AvgPresentation, AvgResolvedScene, AvgSceneAsset, AvgSceneHint, AvgSceneProfile } from '../../models/avg';
import type { 环境信息结构 } from '../../models/environment';
import type { GameLog, 聊天记录结构 } from '../../types';
import type { 场景图片档案 } from '../../models/imageGeneration';
import { isGeneralAvgAsset, normalizeAvgTheme } from './identity';
import { AVG_PRESET_PACK } from './manifest';
import { getAvgPackCatalog } from './packStore';
import { readAvgSceneProfile } from './vocabulary';

/** Existing project art is an engineering fixture until an art pack is approved. */
export const ENGINEERING_AVG_SCENES: AvgSceneAsset[] = [
    { id: 'engineering_huashan_platform', version: 1, image: '/assets/home/huashan-bg.webp', label: '华山平台（工程样图）', profile: { 空间: '山间平台', 地域: '中部' } },
    ...AVG_PRESET_PACK.scenes
];
export const getAvgSceneAssets = (): AvgSceneAsset[] => {
    const installed = getAvgPackCatalog().scenes;
    return installed.length > 0 ? [...AVG_PRESET_PACK.scenes, ...installed] : ENGINEERING_AVG_SCENES;
};

/** Untagged pictures are addressable by explicit override, but never auto matched. */
export const sceneAssetsFromArchive = (archive?: 场景图片档案, theme?: string): AvgSceneAsset[] => {
    const available = (archive?.生图历史 || []).filter(item => item?.id && item.状态 === 'success'
        && (item.本地路径 || item.图片URL));
    return [
        ...getAvgSceneAssets().filter(asset => isGeneralAvgAsset(asset) || asset.themeId === normalizeAvgTheme(theme)),
        ...available.map(item => ({
            id: `archive:${item.id}`, version: 1,
            image: item.本地路径 || item.图片URL || '',
            profile: item.AVG分类 || { 空间: '未知' }, label: item.摘要 || item.上传文件名 || item.id
        }))
    ];
};

const compatible: Record<string, string[]> = {
    山道: ['山腰', '后山小径'], 后山小径: ['山道', '林间小径'], 练剑坪: ['露天练武场'],
    门派广场: ['门派前庭', '露天练武场'], 门派前庭: ['门派广场'],
    藏经阁: ['藏书阁'], 藏书阁: ['藏经阁'], 客栈大堂: ['酒楼大厅', '茶馆'],
    洞内: ['静修洞穴'], 静修洞穴: ['洞内'], 山腰: ['山道', '山脚'],
    树林: ['林间空地'], 林间空地: ['树林']
};

const weights: Array<[keyof AvgSceneProfile, number]> = [
    ['地域', 10], ['地理环境', 12], ['植被', 16], ['地表', 9], ['水域', 15],
    ['视点', 11], ['场所体系', 18], ['场所功能', 26],
    ['装潢档次', 14], ['完好程度', 12], ['空间规模', 8]
];

const normalize = (value: string | undefined): string => (value || '').trim().replace(/\s+/g, ' ');
const keyFields = ['大地点', '中地点', '小地点', '具体地点'] as const;

export const avgPlaceKey = (location?: Record<string, string>): string => {
    if (!location) return '';
    const parts = keyFields.map(key => normalize(location[key]));
    return parts.some(Boolean) ? parts.join('/') : '';
};

const hash = (value: string): number => {
    let result = 2166136261;
    for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return result >>> 0;
};

const score = (wanted: AvgSceneProfile, available: AvgSceneProfile): number => {
    let total = 0;
    for (const [field, points] of weights) {
        const a = wanted[field];
        const b = available[field];
        if (typeof a !== 'string' || !a || a === '不适用' || typeof b !== 'string' || !b || b === '通用' || b === '不适用') continue;
        total += a === b ? points : -Math.ceil(points / 3);
    }
    const features = new Set(available.显著要素 || []);
    total += (wanted.显著要素 || []).filter(item => features.has(item)).length * 3;
    return total;
};

const resolveAsset = (profile: AvgSceneProfile, placeKey: string, assets: AvgSceneAsset[], preferredStyle?: string, theme?: string): AvgSceneAsset | undefined => {
    const compatibleInstitution = (asset: AvgSceneAsset) => !profile.场所体系 || !asset.profile.场所体系
        || asset.profile.场所体系 === '通用' || profile.场所体系 === asset.profile.场所体系;
    const compatibleFunction = (asset: AvgSceneAsset) => !profile.场所功能 || !asset.profile.场所功能
        || asset.profile.场所功能 === '通用' || profile.场所功能 === '通用'
        || profile.场所功能 === asset.profile.场所功能;
    const available = assets.filter(asset => asset.profile.空间 !== '未知'
        && compatibleInstitution(asset) && compatibleFunction(asset));
    const exact = available.filter(asset => asset.profile.空间 === profile.空间);
    const categoryPool = exact.length > 0 ? exact : available.filter(asset => (compatible[profile.空间] || []).includes(asset.profile.空间));
    const exactFunction = profile.场所功能 && profile.场所功能 !== '通用'
        ? categoryPool.filter(asset => asset.profile.场所功能 === profile.场所功能) : [];
    const functionPool = exactFunction.length > 0 ? exactFunction : categoryPool;
    const themed = normalizeAvgTheme(theme) ? functionPool.filter(asset => asset.themeId === normalizeAvgTheme(theme)) : [];
    const themePool = themed.length ? themed : functionPool;
    const sameStyle = preferredStyle ? themePool.filter(asset => asset.styleFamily === preferredStyle) : [];
    const pool = sameStyle.length > 0 ? sameStyle : themePool;
    if (pool.length === 0) return undefined;
    const ranked = pool.map(asset => ({ asset, points: score(profile, asset.profile) }));
    const top = Math.max(...ranked.map(item => item.points));
    const ties = ranked.filter(item => item.points === top).sort((a, b) => a.asset.id.localeCompare(b.asset.id));
    return ties[hash(placeKey) % ties.length]?.asset;
};

const previousScenes = (history: 聊天记录结构[]): Map<string, AvgResolvedScene> => {
    const result = new Map<string, AvgResolvedScene>();
    for (const item of history) {
        const presentation = item.structuredResponse?.avgPresentation;
        const legacyFallback = presentation?.diagnostic === 'invalid-scene-timeline'
            || (presentation?.diagnostic === 'no-scene-markers' && !item.structuredResponse?.avgSceneHints?.length);
        for (const scene of presentation?.scenes || []) {
            if (legacyFallback && !scene.reason.startsWith('manual-')) continue;
            if (scene.placeKey && !scene.placeKey.startsWith('transient:') && scene.assetId) result.set(scene.placeKey, scene);
        }
    }
    return result;
};

/** Freeze chosen resources onto the turn stored in history. No image generation occurs here. */
export const buildAvgPresentation = (
    logs: GameLog[], hints: AvgSceneHint[] | undefined, env: 环境信息结构,
    history: 聊天记录结构[], assets: AvgSceneAsset[] = getAvgSceneAssets(),
    overrides: Record<string, string> = {}, theme?: string
): AvgPresentation => {
    const refs = logs.map(log => log.avgSceneRef).filter((value): value is string => !!value);
    const uniqueRefs = [...new Set(refs)];
    const byRef = new Map<string, AvgSceneHint>();
    const refCounts = new Map<string, number>();
    for (const hint of hints || []) {
        if (!hint?.ref) continue;
        refCounts.set(hint.ref, (refCounts.get(hint.ref) || 0) + 1);
        const profile = readAvgSceneProfile(hint.分类);
        if (profile) byRef.set(hint.ref, { ...hint, 分类: profile });
    }
    for (const [ref, count] of refCounts) if (count > 1) byRef.delete(ref);
    const multi = uniqueRefs.length > 0;
    const complete = multi && logs.every(log => !!log.avgSceneRef && byRef.has(log.avgSceneRef));
    // Without markers only a single supplied scene is addressable. Never infer from a place name.
    const singleHint = !multi && byRef.size === 1 ? [...byRef.values()][0] : undefined;
    const chosen: AvgSceneHint[] = multi
        ? uniqueRefs.map(ref => byRef.get(ref) || { ref, 分类: { 空间: '未知' } })
        : [{ ref: 'final', 地点: singleHint?.地点 || Object.fromEntries(keyFields.map(key => [key, env[key] || ''])),
            分类: singleHint?.分类 || { 空间: '未知' } }];
    const prior = previousScenes(history);
    const venueStyles = new Map<string, string>();
    for (const [place, binding] of prior) {
        const style = assets.find(asset => asset.id === binding.assetId)?.styleFamily;
        if (style) venueStyles.set(place.split('/').slice(0, 3).join('/'), style);
    }
    const scenes = chosen.map((hint, index): AvgResolvedScene => {
        const location = hint.地点;
        const placeKey = avgPlaceKey(location) || `transient:${hash(JSON.stringify(hint.分类))}:${index}`;
        const label = keyFields.map(key => location?.[key]).filter(Boolean).join(' / ') || hint.分类.空间;
        const overrideId = overrides[placeKey];
        const previous = prior.get(placeKey);
        const binding = !overrideId && (hint.分类.空间 !== '未知' || previous?.reason.startsWith('manual-'))
            ? previous : undefined;
        const asset = overrideId
            ? assets.find(candidate => candidate.id === overrideId)
            : binding
            ? assets.find(candidate => candidate.id === binding.assetId && candidate.version === binding.version)
            : resolveAsset(hint.分类, placeKey, assets, venueStyles.get(placeKey.split('/').slice(0, 3).join('/')), theme);
        if (asset?.styleFamily) venueStyles.set(placeKey.split('/').slice(0, 3).join('/'), asset.styleFamily);
        return {
            ref: hint.ref, placeKey, label, profile: hint.分类,
            assetId: binding?.assetId || asset?.id,
            image: binding?.image || asset?.image,
            version: binding?.version || asset?.version,
            reason: overrideId ? (asset ? 'manual-place-override' : 'manual-neutral')
                : binding ? 'existing-binding' : asset ? 'first-match' : 'neutral-background'
        };
    });
    return {
        schemaVersion: 1,
        mode: multi ? 'multi' : 'final',
        scenes,
        diagnostic: multi ? complete ? undefined : 'incomplete-scene-timeline'
            : singleHint ? undefined : byRef.size > 1 ? 'no-scene-markers' : 'missing-scene-fields'
    };
};
