import type { AvgPresentation, AvgResolvedScene, AvgSceneAsset, AvgSceneHint, AvgSceneProfile } from '../../models/avg';
import type { 环境信息结构 } from '../../models/environment';
import type { GameLog, 聊天记录结构 } from '../../types';
import type { 场景图片档案 } from '../../models/imageGeneration';
import { isGeneralAvgAsset, normalizeAvgTheme } from './identity';
import { AVG_PRESET_PACK } from './manifest';
import { getAvgPackCatalog } from './packStore';
import { readAvgSceneProfile } from './vocabulary';
import { indexAvgSceneBindings, lookupAvgSceneBinding } from './sceneBindings';
import { avgCompatibleSpaces, avgRelatedSceneFunctions, avgRelatedSceneFunctionDistance, avgUnspecifiedField } from './sceneCompatibility';

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

const weights: Array<[Exclude<keyof AvgSceneProfile, '显著要素'>, number]> = [
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
        if (avgUnspecifiedField(a) || avgUnspecifiedField(b)) continue;
        total += a === b ? points : -Math.ceil(points / 3);
    }
    const features = new Set(available.显著要素 || []);
    total += (wanted.显著要素 || []).filter(item => features.has(item)).length * 3;
    return total;
};

/** Matching and diagnostics share the same filters; no prose/location classification occurs here. */
const sceneCandidatePool = (profile: AvgSceneProfile, assets: AvgSceneAsset[], preferredStyle?: string, theme?: string) => {
    const compatibleInstitution = (asset: AvgSceneAsset) => avgUnspecifiedField(profile.场所体系) || avgUnspecifiedField(asset.profile.场所体系)
        || profile.场所体系 === asset.profile.场所体系;
    const directFunction = (asset: AvgSceneAsset) => avgUnspecifiedField(profile.场所功能) || avgUnspecifiedField(asset.profile.场所功能)
        || profile.场所功能 === asset.profile.场所功能;
    const relatedFunction = (asset: AvgSceneAsset) => avgRelatedSceneFunctions(profile.空间, profile.场所功能, asset.profile.空间, asset.profile.场所功能);
    const alternatives = avgCompatibleSpaces(profile.空间);
    const matchesSpace = (asset: AvgSceneAsset) => asset.profile.空间 === profile.空间
        || alternatives.includes(asset.profile.空间);
    const known = assets.filter(asset => asset.profile.空间 !== '未知');
    const institution = known.filter(compatibleInstitution);
    const available = institution.filter(asset => directFunction(asset) || relatedFunction(asset));
    const exact = available.filter(asset => asset.profile.空间 === profile.空间);
    const categoryPool = available.filter(matchesSpace);
    const exactFunction = !avgUnspecifiedField(profile.场所功能)
        ? categoryPool.filter(asset => asset.profile.场所功能 === profile.场所功能) : [];
    const direct = categoryPool.filter(directFunction);
    const related = categoryPool.map(asset => ({ asset,
        distance: avgRelatedSceneFunctionDistance(profile.空间, profile.场所功能, asset.profile.空间, asset.profile.场所功能) }));
    const closestDistance = related.length ? Math.min(...related.map(item => item.distance)) : Infinity;
    const closest = related.filter(item => Number.isFinite(item.distance) && item.distance === closestDistance).map(item => item.asset);
    // Search related spaces before relaxing the function. An unrelated exact-space
    // asset must not hide a restaurant image just because its space label differs.
    const functionPool = exactFunction.length > 0 ? exactFunction : direct.length > 0 ? direct : closest;
    const sameSpace = functionPool.filter(asset => asset.profile.空间 === profile.空间);
    const spacePool = sameSpace.length > 0 ? sameSpace : functionPool;
    // Theme/style are preferences within the best metadata match, never reasons
    // to discard a better region, condition or scale supplied by the model.
    const ranked = spacePool.map(asset => ({ asset, points: score(profile, asset.profile) }));
    const top = ranked.length ? Math.max(...ranked.map(item => item.points)) : 0;
    const bestPool = ranked.filter(item => item.points === top).map(item => item.asset);
    const themed = normalizeAvgTheme(theme) ? bestPool.filter(asset => asset.themeId === normalizeAvgTheme(theme)) : [];
    const themePool = themed.length ? themed : bestPool;
    const sameStyle = preferredStyle ? themePool.filter(asset => asset.styleFamily === preferredStyle) : [];
    const pool = sameStyle.length > 0 ? sameStyle : themePool;
    const spacesBefore = known.filter(matchesSpace);
    const spacesAfterInstitution = institution.filter(matchesSpace);
    const failureStage = !spacesBefore.length ? 'space' : !spacesAfterInstitution.length ? 'institution'
        : !categoryPool.length ? 'function' : undefined;
    return { pool, failureStage, spacesBefore, spacesAfterInstitution,
        selection: { allowedSpaces: [profile.空间, ...alternatives],
            functionTier: !functionPool.length ? 'none' : exactFunction.length ? 'exact' : direct.length ? 'direct-or-general' : 'related-function',
            spaceTier: !spacePool.length ? 'none' : sameSpace.length ? 'exact' : 'compatible' },
        counts: { total: assets.length, knownSpace: known.length,
        exactSpaceBeforeFilters: known.filter(asset => asset.profile.空间 === profile.空间).length,
        exactSpaceAfterInstitution: institution.filter(asset => asset.profile.空间 === profile.空间).length,
        exactSpaceAfterFunction: exact.length,
        compatibleSpaceBeforeFilters: spacesBefore.length, compatibleSpaceAfterInstitution: spacesAfterInstitution.length,
        afterInstitution: institution.length, afterFunction: available.length,
        exactSpace: exact.length, category: categoryPool.length, afterFunctionPreference: functionPool.length,
        afterSpacePreference: spacePool.length,
        afterProfilePreference: bestPool.length,
        afterThemePreference: themePool.length, afterStylePreference: pool.length } };
};

export const inspectAvgSceneCandidates = (profile: AvgSceneProfile, assets: AvgSceneAsset[], theme?: string) => {
    const { pool, counts, selection, failureStage, spacesBefore, spacesAfterInstitution } = sceneCandidatePool(profile, assets, undefined, theme);
    const rejected = failureStage === 'institution' ? spacesBefore : failureStage === 'function' ? spacesAfterInstitution : [];
    return { counts, selection, candidateIds: pool.slice(0, 12).map(asset => asset.id), candidatesTruncated: pool.length > 12,
        candidates: pool.slice(0, 12).map(asset => ({ id: asset.id, profile: asset.profile,
            profileScore: score(profile, asset.profile), themeId: asset.themeId, styleFamily: asset.styleFamily })),
        failure: failureStage ? { stage: failureStage, requested: profile,
            rejectedCandidates: rejected.slice(0, 12).map(asset => ({ id: asset.id, profile: asset.profile })),
            rejectedCandidatesTruncated: rejected.length > 12 } : null };
};

const resolveAsset = (profile: AvgSceneProfile, placeKey: string, assets: AvgSceneAsset[], preferredStyle?: string, theme?: string): AvgSceneAsset | undefined => {
    const { pool } = sceneCandidatePool(profile, assets, preferredStyle, theme);
    if (pool.length === 0) return undefined;
    const ties = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    return ties[hash(placeKey) % ties.length];
};

/** Diagnostic inspection uses exactly the same identity lookup as playback. */
export const inspectAvgSceneBindings = (history: 聊天记录结构[], placeKey: string, _currentProfile?: AvgSceneProfile, sceneId?: string) => {
    const index = indexAvgSceneBindings(history);
    const { binding, conflict, lookupRule } = lookupAvgSceneBinding(index, placeKey, sceneId);
    return { lookupPlaceKey: placeKey, lookupSceneId: sceneId, lookupRule, bindingFound: !!binding,
        binding, reuseAllowedByCurrentResolver: !!binding,
        blockReason: conflict ? 'conflicting-scene-identity' : !binding ? 'no-exact-place-binding' : undefined,
        knownBindingCount: index.byId.size,
        knownBindings: [...index.byId.values()].slice(-100).map(scene => ({ sceneId: scene.sceneId,
            placeKey: scene.placeKey, placeAliases: scene.placeAliases,
            label: scene.label, profile: scene.profile, assetId: scene.assetId, version: scene.version, reason: scene.reason })),
        knownBindingsTruncated: index.byId.size > 100 };
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
        if (profile || hint.场景ID || hint.地点?.具体地点)
            byRef.set(hint.ref, { ...hint, 分类: profile || undefined });
    }
    for (const [ref, count] of refCounts) if (count > 1) byRef.delete(ref);
    const multi = uniqueRefs.length > 0;
    const complete = multi && logs.every(log => !!log.avgSceneRef && byRef.has(log.avgSceneRef));
    // Without markers only a single supplied scene is addressable. Never infer from a place name.
    const singleHint = !multi && byRef.size === 1 ? [...byRef.values()][0] : undefined;
    const chosen: AvgSceneHint[] = multi
        ? uniqueRefs.map(ref => byRef.get(ref) || { ref })
        : [{ ref: 'final', 场景ID: singleHint?.场景ID,
            地点: singleHint?.地点 || (singleHint?.场景ID || byRef.size > 1 ? undefined : Object.fromEntries(keyFields.map(key => [key, env[key] || '']))),
            分类: singleHint?.分类 }];
    const prior = indexAvgSceneBindings(history);
    const venueStyles = new Map<string, string>();
    for (const [place, binding] of prior.byPlace) {
        const style = assets.find(asset => asset.id === binding.assetId)?.styleFamily;
        if (style) venueStyles.set(place.split('/').slice(0, 3).join('/'), style);
    }
    const scenes: AvgResolvedScene[] = [];
    let identityConflict = false;
    chosen.forEach((hint, index) => {
        const location = hint.地点;
        // A county/building without a concrete room is a display location, not a
        // stable room identity. An explicit scene ID can still bind this scene.
        const declaredKey = location?.具体地点?.trim() ? avgPlaceKey(location) : '';
        const lookup = lookupAvgSceneBinding(prior, declaredKey, hint.场景ID);
        identityConflict ||= lookup.conflict;
        const placeKey = declaredKey || lookup.binding?.placeKey || `transient:${hash(JSON.stringify(hint.分类 || {}))}:${index}`;
        const previous = lookup.binding;
        const profile = readAvgSceneProfile(hint.分类) || previous?.profile || { 空间: '未知' };
        const label = keyFields.map(key => location?.[key]).filter(Boolean).join(' / ') || previous?.label || profile.空间;
        const overrideId = overrides[placeKey] || previous?.placeAliases?.map(key => overrides[key]).find(Boolean);
        const binding = !overrideId ? previous : undefined;
        const asset = overrideId
            ? assets.find(candidate => candidate.id === overrideId)
            : binding
            ? assets.find(candidate => candidate.id === binding.assetId && candidate.version === binding.version)
            : lookup.conflict || profile.空间 === '未知' ? undefined
            : resolveAsset(profile, placeKey, assets, venueStyles.get(placeKey.split('/').slice(0, 3).join('/')), theme);
        if (asset?.styleFamily) venueStyles.set(placeKey.split('/').slice(0, 3).join('/'), asset.styleFamily);
        const scene: AvgResolvedScene = {
            ref: hint.ref, placeKey, label, profile,
            sceneId: previous?.sceneId || hint.场景ID || (!placeKey.startsWith('transient:') ? `place:${placeKey}` : undefined),
            placeAliases: placeKey.startsWith('transient:') ? undefined : [...new Set([...(previous?.placeAliases || []), placeKey])],
            assetId: binding?.assetId || asset?.id,
            image: binding?.image || asset?.image,
            version: binding?.version || asset?.version,
            reason: overrideId ? (asset ? 'manual-place-override' : 'manual-neutral')
                : binding?.reason === 'manual-neutral' ? 'manual-neutral'
                : binding ? 'existing-binding' : asset ? 'first-match' : 'neutral-background'
        };
        scenes.push(scene);
        // Later refs in this same reply can return to the first selected binding too.
        if (!lookup.conflict && scene.sceneId && (scene.assetId || scene.reason === 'manual-neutral')) {
            prior.byId.set(scene.sceneId, scene);
            for (const key of scene.placeAliases || []) if (key.split('/')[3]?.trim()) prior.byPlace.set(key, scene);
        }
    });
    return {
        schemaVersion: 1,
        mode: multi ? 'multi' : 'final',
        scenes,
        diagnostic: identityConflict ? 'conflicting-scene-identity'
            : multi ? complete ? undefined : 'incomplete-scene-timeline'
            : singleHint || scenes[0]?.reason === 'existing-binding' || scenes[0]?.reason === 'manual-neutral' ? undefined
            : byRef.size > 1 ? 'no-scene-markers' : 'missing-scene-fields'
    };
};
