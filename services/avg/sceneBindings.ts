import type { AvgResolvedScene } from '../../models/avg';
import type { 聊天记录结构 } from '../../types';

export const avgSceneIdentity = (scene: AvgResolvedScene): string => scene.sceneId || `place:${scene.placeKey}`;
const persistentKey = (key: string) => !!key && !key.startsWith('transient:') && !!key.split('/')[3]?.trim();

/** Identity links are exact model declarations, never inferred from names or prose. */
export const indexAvgSceneBindings = (history: 聊天记录结构[]) => {
    const byId = new Map<string, AvgResolvedScene>();
    for (const turn of history) {
        const presentation = turn.structuredResponse?.avgPresentation;
        const legacyFallback = presentation?.diagnostic === 'invalid-scene-timeline'
            || (presentation?.diagnostic === 'no-scene-markers' && !turn.structuredResponse?.avgSceneHints?.length);
        for (const scene of presentation?.scenes || []) {
            if (legacyFallback && !scene.reason.startsWith('manual-')) continue;
            if ((!persistentKey(scene.placeKey) && !scene.sceneId) || (!scene.assetId && scene.reason !== 'manual-neutral')) continue;
            const id = avgSceneIdentity(scene);
            const earlier = byId.get(id);
            byId.delete(id);
            byId.set(id, { ...scene, sceneId: id, placeAliases: [...new Set([
                ...(earlier?.placeAliases || []), ...(scene.placeAliases || []), scene.placeKey
            ].filter(persistentKey))] });
        }
    }
    const byPlace = new Map<string, AvgResolvedScene>();
    const conflictingPlaces = new Set<string>();
    for (const scene of byId.values()) for (const key of scene.placeAliases || []) {
        const other = byPlace.get(key);
        if (other && other.sceneId !== scene.sceneId) conflictingPlaces.add(key);
        byPlace.set(key, scene);
    }
    for (const key of conflictingPlaces) byPlace.delete(key);
    return { byId, byPlace, conflictingPlaces };
};

export const lookupAvgSceneBinding = (index: ReturnType<typeof indexAvgSceneBindings>, placeKey: string, sceneId?: string) => {
    const byId = sceneId ? index.byId.get(sceneId) : undefined;
    const byPlace = index.byPlace.get(placeKey);
    const conflict = index.conflictingPlaces.has(placeKey) || !!(byId && byPlace && byId.sceneId !== byPlace.sceneId);
    return { binding: conflict ? undefined : byId || byPlace, conflict,
        lookupRule: byId ? 'model-scene-id' : byPlace && byPlace.placeKey !== placeKey ? 'declared-place-alias' : 'exact-place-key' };
};

/** Full saved history is independent of the narrative's clipped context window. */
export const buildAvgKnownScenesPrompt = (history: 聊天记录结构[]): string => {
    const bindings = [...indexAvgSceneBindings(history).byId.values()];
    if (!bindings.length) return '';
    const scenes = bindings.slice(-80).map(scene => ({ 场景ID: scene.sceneId,
        地点: persistentKey(scene.placeKey) ? Object.fromEntries(['大地点', '中地点', '小地点', '具体地点'].map((key, index) => [key, scene.placeKey.split('/')[index] || ''])) : undefined,
        地点别名: scene.placeAliases, 分类: scene.profile }));
    return `【AVG已绑定场景】\n${JSON.stringify({ 场景: scenes, 省略较早场景数: Math.max(0, bindings.length - scenes.length) })}\n`
        + '返回这些实际空间时，在<演出场景>引用对应场景ID，不必重复分类。当前地点写法不同但确属同一空间时，由你明确输出该ID和当前地点；客户端据此保存别名。不同房间、街道与室内各用自己的ID。未列出的新空间必须提供分类；不得因名称相似而复用。';
};
