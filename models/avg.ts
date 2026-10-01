/** AVG data belongs to presentation. It must never be executed as a game command. */
export interface AvgSceneProfile {
    空间: string;
    地域?: string;
    地理环境?: string;
    植被?: string;
    地表?: string;
    水域?: string;
    视点?: string;
    场所体系?: string;
    /** The venue's concrete use, independent of the camera's room or yard. */
    场所功能?: string;
    装潢档次?: string;
    完好程度?: string;
    空间规模?: string;
    显著要素?: string[];
}

export interface AvgSceneHint {
    ref: string;
    /** Model-declared persistent identity; ref itself remains turn-local. */
    场景ID?: string;
    地点?: Record<string, string>;
    /** Required for a new scene; omitted when referencing an existing binding. */
    分类?: AvgSceneProfile;
}

export interface AvgSceneAsset {
    legacyAssetIds?: string[];
    themeId?: string;
    id: string;
    image: string;
    profile: AvgSceneProfile;
    version: number;
    styleFamily?: string;
    /** Engineering sample and hand selected art can both be described here. */
    label?: string;
}

export interface AvgSceneBinding {
    placeKey: string;
    assetId: string;
    version: number;
    profile: AvgSceneProfile;
}

export interface AvgResolvedScene {
    ref: string;
    sceneId?: string;
    /** Exact location keys explicitly linked by the model through sceneId. */
    placeAliases?: string[];
    placeKey: string;
    label: string;
    profile: AvgSceneProfile;
    assetId?: string;
    image?: string;
    version?: number;
    reason: string;
    /** Approximate art search evidence; profile remains the original model data. */
    fallback?: { source: 'location'; term: string; matchingProfile: AvgSceneProfile;
        tier?: 'space' | 'nearest-catalog'; contextRegion?: string };
}

export interface AvgPresentation {
    schemaVersion: 1;
    mode: 'multi' | 'final';
    scenes: AvgResolvedScene[];
    /** An explicit failure is retained for diagnostics; the story remains playable. */
    diagnostic?: string;
}

export interface AvgSceneFieldSnapshot {
    hintCount: number;
    hintRefs: string[];
    logCount: number;
    markedLogCount: number;
    sceneRefs: string[];
}

/** Minimal request/processing evidence; no prompts, credentials or image bytes. */
export interface AvgSceneTrace {
    schemaVersion: 1;
    appVersion: string;
    request: {
        source: 'main' | 'opening';
        enabledAtRequest: boolean;
        protocolIncluded: boolean;
        protocolVersion: string;
        protocolMessageIndexes: number[];
        bindingRegistryIncluded?: boolean;
        bindingRegistrySceneCount?: number;
        parserOptions: { enableTagRepair: boolean; validateTagCompleteness: boolean };
    };
    parsed: AvgSceneFieldSnapshot;
    afterPolish?: AvgSceneFieldSnapshot;
    afterVariableGeneration?: AvgSceneFieldSnapshot;
    final?: AvgSceneFieldSnapshot;
}

export type AvgVisualAge = 'child' | 'teen' | 'young' | 'middle' | 'elder';

/** Stable, visible traits for prefab matching. Free prose remains in the NPC archive for image generation. */
export interface AvgPortraitProfile {
    视觉年龄?: AvgVisualAge;
    /** Broad visible role, separate from the NPC's free-text current identity. */
    身份类别?: string;
    /** Visual archetype only; never a named sect or current membership. */
    江湖形象?: string;
    服饰类别?: string;
    体态?: string;
    身高?: string;
    发型?: string;
    衣装剪裁?: string;
    上身轮廓?: string;
    腰臀轮廓?: string;
    露肤程度?: string;
    发色?: string;
    显著特征?: string[];
}

export interface AvgPortraitAsset {
    legacyAssetIds?: string[];
    themeId?: string;
    characterKey?: string;
    label?: string;
    aliases?: string[];
    baseAssetId?: string;
    faceFamilyKey?: string;
    variantStage?: string;
    variantLabel?: string;
    id: string;
    version: number;
    image: string;
    gender: '男' | '女';
    /** Inclusive chronological NPC age range for automatic prefab matching. */
    ageRange: { min: number; max: number };
    visualAge: AvgVisualAge;
    roleTags?: string[];
    appearanceTags?: string[];
    profile?: AvgPortraitProfile;
    styleFamily?: string;
    /** A prefab portrait must be inspected as a single character image, not a sprite sheet. */
    portraitVerified: boolean;
    reusePolicy: 'unique' | 'crowd';
}

export interface AvgPortraitBinding {
    baseAssetId?: string;
    characterKey?: string;
    faceFamilyKey?: string;
    npcId: string;
    assetId?: string;
    version?: number;
    image?: string;
    reason: 'selected-archive' | 'existing-binding' | 'first-match' | 'no-compatible-art' | 'manual-prefab';
}

export interface AvgPortraitSelection {
    source: 'auto' | 'prefab';
    baseAssetId?: string;
    assetId?: string;
}
