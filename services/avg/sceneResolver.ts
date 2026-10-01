import type { AvgPresentation, AvgResolvedScene, AvgSceneAsset, AvgSceneHint, AvgSceneProfile } from '../../models/avg';
import type { 环境信息结构 } from '../../models/environment';
import type { GameLog, 聊天记录结构 } from '../../types';
import type { 场景图片档案 } from '../../models/imageGeneration';
import { isGeneralAvgAsset, normalizeAvgTheme } from './identity';
import { AVG_PRESET_PACK } from './manifest';
import { getAvgPackCatalog } from './packStore';

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
        for (const scene of item.structuredResponse?.avgPresentation?.scenes || []) {
            if (scene.placeKey && !scene.placeKey.startsWith('transient:') && scene.assetId) result.set(scene.placeKey, scene);
        }
    }
    return result;
};

const matchesFinalLocation = (hint: AvgSceneHint, env: 环境信息结构): boolean => {
    const location = hint.地点 || {};
    const parentsMatch = keyFields.slice(0, 3).every(key =>
        !location[key] || !env[key] || normalize(location[key]) === normalize(env[key]));
    if (!parentsMatch) return false;
    const sceneSpecific = normalize(location.具体地点);
    const settledSpecific = normalize(env.具体地点);
    if (!sceneSpecific || !settledSpecific || sceneSpecific === settledSpecific) return true;
    // A water-surface shot from a boat and the settled boat are the same vantage point.
    // Keep this exception narrow: cabins, docks and shores are different scenes.
    return (hint.分类.空间 === '江面' || hint.分类.空间 === '海面')
        && hint.分类.视点 === '舟上'
        && /^(?:江面|海面|湖面|河面|水面|舟上|船上)$/.test(sceneSpecific)
        && /[船舟舸艇筏]/.test(settledSpecific)
        && !/[舱坞厂岸港]|码头|渡口/.test(settledSpecific);
};

/** Only classify explicit location words when the model omitted the scene protocol. */
export const inferAvgSceneProfile = (env: { 具体地点?: unknown; 小地点?: unknown }): AvgSceneProfile => {
    const specific = String(env.具体地点 || '');
    const venue = String(env.小地点 || '');
    const text = `${venue}/${specific}`;
    const rules: Array<[RegExp, AvgSceneProfile['空间']]> = [
        [/客房|客栈.*卧房/, '客栈客房'], [/客栈.*大堂|客栈.*大厅/, '客栈大堂'],
        [/酒楼.*雅间|包厢/, '酒楼雅间'], [/酒楼.*大厅|酒楼.*大堂/, '酒楼大厅'],
        [/公堂/, '衙门公堂'], [/牢房|牢狱/, '牢房'], [/铁匠铺.*内|铁匠铺$/, '铁匠铺内'],
        [/医馆.*内|医馆$/, '医馆内'], [/卧室|卧房/, '民居卧室'], [/堂屋/, '民居堂屋'],
        [/厨房|灶房/, '厨房'], [/书房/, '书房'], [/院落|庭院|小院/, '院落'],
        [/甲板/, '舟船甲板'], [/船舱/, '船舱'], [/码头/, '码头'], [/渡口/, '渡口'],
        [/洞内|洞穴/, '洞内'], [/树林|林中/, '树林'], [/竹林/, '竹林'], [/山顶/, '山顶'],
        [/山腰/, '山腰'], [/山道/, '山道'], [/集市|市集/, '市集'],
        [/巷道|巷口|巷子/, '巷道'], [/十字路口|街口|街道|大街|街\//, '城内街道']
    ];
    const space = rules.find(([pattern]) => pattern.test(text))?.[1];
    return { 空间: space || '未知' };
};

const finalHint = (env: 环境信息结构): AvgSceneHint => ({
    ref: 'final',
    地点: Object.fromEntries(keyFields.map(key => [key, env[key] || ''])),
    分类: inferAvgSceneProfile(env)
});

/** Freeze chosen resources onto the turn stored in history. No image generation occurs here. */
export const buildAvgPresentation = (
    logs: GameLog[], hints: AvgSceneHint[] | undefined, env: 环境信息结构,
    history: 聊天记录结构[], assets: AvgSceneAsset[] = getAvgSceneAssets(),
    overrides: Record<string, string> = {}, theme?: string
): AvgPresentation => {
    const refs = logs.map(log => log.avgSceneRef).filter((value): value is string => !!value);
    const uniqueRefs = [...new Set(refs)];
    const byRef = new Map((hints || []).map(hint => [hint.ref, hint]));
    const finalRef = refs[refs.length - 1];
    const finalScene = finalRef ? byRef.get(finalRef) : undefined;
    const valid = uniqueRefs.length > 0 && logs.every(log => !!log.avgSceneRef && byRef.has(log.avgSceneRef))
        && uniqueRefs.every(ref => byRef.has(ref)) && !!finalScene && matchesFinalLocation(finalScene, env);
    const matchingFinalHint = [...(hints || [])].reverse().find(hint =>
        !!avgPlaceKey(hint.地点) && matchesFinalLocation(hint, env));
    const fallbackHint = matchingFinalHint
        ? { ...finalHint(env), 分类: matchingFinalHint.分类.空间 === '未知' ? inferAvgSceneProfile(env) : matchingFinalHint.分类 } : finalHint(env);
    const chosen = valid ? uniqueRefs.map(ref => byRef.get(ref)!) : [fallbackHint];
    const prior = previousScenes(history);
    const venueStyles = new Map<string, string>();
    for (const [place, binding] of prior) {
        const style = assets.find(asset => asset.id === binding.assetId)?.styleFamily;
        if (style) venueStyles.set(place.split('/').slice(0, 3).join('/'), style);
    }
    const scenes = chosen.map((hint, index): AvgResolvedScene => {
        const location = valid && hint.ref === finalRef
            ? Object.fromEntries(keyFields.map(key => [key, hint.地点?.[key] || env[key] || '']))
            : hint.地点;
        const placeKey = avgPlaceKey(location) || (valid ? `transient:${hash(JSON.stringify(hint.分类))}:${index}` : avgPlaceKey(finalHint(env).地点));
        const label = keyFields.map(key => location?.[key]).filter(Boolean).join(' / ') || hint.分类.空间;
        const overrideId = overrides[placeKey];
        const binding = overrideId ? undefined : prior.get(placeKey);
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
        mode: valid ? 'multi' : 'final',
        scenes,
        diagnostic: valid ? undefined : (uniqueRefs.length > 0 ? 'invalid-scene-timeline' : 'no-scene-markers')
    };
};
