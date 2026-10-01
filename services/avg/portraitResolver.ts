import type { AvgPortraitAsset, AvgPortraitBinding, AvgPortraitProfile, AvgVisualAge } from '../../models/avg';
import type { GameLog, NPC结构, 聊天记录结构 } from '../../types';
import { avgBindingForAsset, avgSamePersonOptions, isAvgBasePortrait, isGeneralAvgAsset, namedAvgCharacterKey, normalizeAvgTheme } from './identity';
import { AVG_PRESET_PACK } from './manifest';
import { getAvgPackCatalog } from './packStore';
import { archetypeFromOutfit, normalizeAvgPortraitProfile } from './portraitVocabulary';

export const ENGINEERING_AVG_PORTRAITS: AvgPortraitAsset[] = AVG_PRESET_PACK.portraits;
export const getAvgPortraitAssets = (): AvgPortraitAsset[] => [...ENGINEERING_AVG_PORTRAITS, ...getAvgPackCatalog().portraits];

const visualArchetype = (profile?: AvgPortraitProfile): string | undefined => {
    return archetypeFromOutfit(profile?.服饰类别) || profile?.江湖形象;
};

const compatibleArchetype = (npcProfile: AvgPortraitProfile | undefined, asset: AvgPortraitAsset): boolean =>
    visualArchetype(npcProfile) === visualArchetype(asset.profile);

const featureScore = (expected: string | undefined, actual: string | undefined, match: number, mismatch: number): number =>
    expected && actual ? (expected === actual ? match : -mismatch) : 0;

const visibleAge = (npc: NPC结构): AvgVisualAge | undefined => {
    const classified = normalizeAvgPortraitProfile(npc.AVG立绘特征)?.视觉年龄;
    if (classified) return classified;
    const description = (npc.外貌描写 || '').trim();
    if (/老者|老妪|年逾花甲|垂暮/.test(description)) return 'elder';
    if (/中年/.test(description)) return 'middle';
    if (/少年|少女|十六七/.test(description)) return 'teen';
    if (/孩童|幼童|稚童/.test(description)) return 'child';
    if (/青年|年轻|二十余岁|三十来岁/.test(description)) return 'young';
    const age = Number(npc.年龄);
    if (!Number.isFinite(age) || age <= 0 || age > 150) return undefined;
    return age < 40 ? 'young' : age < 60 ? 'middle' : 'elder';
};

const hash = (value: string): number => {
    let result = 2166136261;
    for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return result >>> 0;
};

const existingBindings = (history: 聊天记录结构[]): Map<string, AvgPortraitBinding> => {
    const result = new Map<string, AvgPortraitBinding>();
    for (const turn of history) {
        for (const binding of Object.values(turn.structuredResponse?.avgPortraitBindings || {})) {
            if (binding.npcId && binding.assetId) result.set(binding.npcId, binding);
        }
    }
    return result;
};

/** Matches only unambiguous, registered NPCs. Name alone never becomes the stored identity. */
export const resolveAvgPortraits = (
    logs: GameLog[], social: NPC结构[], history: 聊天记录结构[],
    assets: AvgPortraitAsset[] = getAvgPortraitAssets(), theme?: string
): Record<string, AvgPortraitBinding> => {
    const result: Record<string, AvgPortraitBinding> = {};
    const prior = existingBindings(history);
    const occupied = new Set([...prior.values()].map(item => item.baseAssetId || item.assetId)
        .filter(id => id && assets.find(asset => asset.id === id)?.reusePolicy === 'unique'));
    const names = [...new Set(logs.map(log => (log.sender || '').trim()).filter(name => name && name !== '旁白' && !/判定/.test(name)))];

    for (const sender of names) {
        const matches = social.filter(npc => npc?.姓名?.trim() === sender && !!npc.id);
        if (matches.length !== 1) continue;
        const npc = matches[0];
        const selectedId = npc.图片档案?.已选立绘图片ID;
        const selected = npc.图片档案?.生图历史?.find(item => item.id === selectedId && item.状态 === 'success'
            && (item.构图 === '立绘' || item.构图 === '半身'));
        const manual = npc.AVG美术选择;
        const priorBinding = prior.get(npc.id);
        const establishedBase = priorBinding?.baseAssetId || (priorBinding?.assetId?.startsWith('archive:') ? undefined
            : assets.find(asset => asset.id === priorBinding?.assetId)?.baseAssetId || priorBinding?.assetId);
        const manualBase = manual?.baseAssetId && (!establishedBase || establishedBase === manual.baseAssetId)
            ? assets.find(asset => asset.id === manual.baseAssetId && isAvgBasePortrait(asset)) : undefined;
        const manualOptions = avgSamePersonOptions(manualBase ? avgBindingForAsset(npc.id, manualBase, 'manual-prefab') : priorBinding, assets);
        const manualAsset = manualOptions.find(asset => asset.id === manual?.assetId);
        if (manual?.source === 'prefab' && manualAsset) {
            result[sender] = avgBindingForAsset(npc.id, manualAsset, 'manual-prefab');
            continue;
        }
        if (selected?.id) {
            const rawImage = selected.本地路径 || selected.图片URL || '';
            result[sender] = {
                npcId: npc.id, assetId: `archive:${selected.id}`, version: 1,
                baseAssetId: manualBase?.id || priorBinding?.baseAssetId,
                characterKey: manualBase?.characterKey || priorBinding?.characterKey,
                faceFamilyKey: manualBase?.faceFamilyKey || priorBinding?.faceFamilyKey,
                image: rawImage || undefined,
                reason: 'selected-archive'
            };
            continue;
        }
        const appearance = normalizeAvgPortraitProfile(npc.AVG立绘特征);
        const age = visibleAge(npc);
        const actualAge = Number(npc.年龄);
        const bound = prior.get(npc.id);
        if (bound && !(manual?.source === 'prefab' && bound.assetId?.startsWith('archive:'))) {
            // This asset represents this NPC's established face. A later change of sect,
            // clothing, role, or age must never rematch them to a stranger's prefab.
            const image = bound.image || assets.find(asset => asset.id === bound.assetId)?.image;
            result[sender] = { ...bound, image, reason: 'existing-binding' };
            continue;
        }
        const characterKey = namedAvgCharacterKey(npc, assets, theme);
        const selectedTheme = normalizeAvgTheme(theme);
        const exactNamed = characterKey ? assets.filter(asset => asset.portraitVerified && isAvgBasePortrait(asset)
            && asset.characterKey === characterKey && asset.gender === npc.性别
            && Number.isFinite(actualAge) && actualAge >= asset.ageRange.min && actualAge <= asset.ageRange.max
            && (asset.reusePolicy === 'crowd' || !occupied.has(asset.id))
            && (!asset.themeId || asset.themeId === selectedTheme)) : [];
        if (exactNamed.length) {
            const choice = exactNamed.sort((a, b) => a.id.localeCompare(b.id))[0];
            result[sender] = avgBindingForAsset(npc.id, choice, 'first-match');
            occupied.add(choice.id);
            continue;
        }
        const compatible = assets.filter(asset => isAvgBasePortrait(asset) && (!asset.characterKey || isGeneralAvgAsset(asset))
            && (isGeneralAvgAsset(asset) || asset.themeId === selectedTheme) && asset.portraitVerified && asset.gender === npc.性别
            && Number.isFinite(actualAge) && actualAge >= asset.ageRange.min && actualAge <= asset.ageRange.max
            && !!age && asset.visualAge === age
            && compatibleArchetype(appearance, asset)
            && (asset.reusePolicy === 'crowd' || !occupied.has(asset.id)));
        const themed = selectedTheme ? compatible.filter(asset => asset.themeId === selectedTheme) : [];
        const candidates = themed.length ? themed : compatible;
        if (candidates.length === 0) {
            result[sender] = { npcId: npc.id, reason: 'no-compatible-art' };
            continue;
        }
        const source = `${npc.身份 || ''} ${npc.衣着风格 || ''} ${npc.外貌描写 || ''}`;
        const ranked = candidates.map(asset => {
            const assetProfile = asset.profile;
            let score = Math.min(3, (asset.roleTags || []).filter(tag => source.includes(tag)).length) * 8
                + Math.min(3, (asset.appearanceTags || []).filter(tag => source.includes(tag)).length) * 5;
            if (appearance?.身份类别 && assetProfile?.身份类别) {
                score += appearance.身份类别 === assetProfile.身份类别 ? 32 : -8;
            }
            if (appearance?.服饰类别 && assetProfile?.服饰类别) {
                score += appearance.服饰类别 === assetProfile.服饰类别 ? 40 : -50;
            }
            if (appearance?.体态 && assetProfile?.体态) score += appearance.体态 === assetProfile.体态 ? 12 : -6;
            score += featureScore(appearance?.身高, assetProfile?.身高, 10, 6);
            score += featureScore(appearance?.发型, assetProfile?.发型, 9, 4);
            score += featureScore(appearance?.衣装剪裁, assetProfile?.衣装剪裁, 12, 6);
            score += featureScore(appearance?.上身轮廓, assetProfile?.上身轮廓, 18, 12);
            score += featureScore(appearance?.腰臀轮廓, assetProfile?.腰臀轮廓, 18, 12);
            score += featureScore(appearance?.露肤程度, assetProfile?.露肤程度, 15, 10);
            if (appearance?.发色 && assetProfile?.发色) score += appearance.发色 === assetProfile.发色 ? 16 : -10;
            const features = new Set(assetProfile?.显著特征 || []);
            score += (appearance?.显著特征 || []).filter(feature => features.has(feature)).length * 5;
            return { asset, score };
        });
        const top = Math.max(...ranked.map(item => item.score));
        if (appearance?.服饰类别 && top < 0) {
            result[sender] = { npcId: npc.id, reason: 'no-compatible-art' };
            continue;
        }
        const ties = ranked.filter(item => item.score === top).map(item => item.asset).sort((a, b) => a.id.localeCompare(b.id));
        const choice = ties[hash(npc.id) % ties.length];
        result[sender] = avgBindingForAsset(npc.id, choice, 'first-match');
        if (choice.reusePolicy === 'unique') occupied.add(choice.id);
    }
    return result;
};
