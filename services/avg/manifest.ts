import manifestJson from '../../public/assets/avg/manifest.json';
import type { AvgPortraitAsset, AvgSceneAsset } from '../../models/avg';
import { normalizeAvgTheme } from './identity';
import { normalizeAvgProfile } from './vocabulary';
import { archetypeFromOutfit, normalizeAvgPortraitProfile } from './portraitVocabulary';

type PackResult = { scenes: AvgSceneAsset[]; portraits: AvgPortraitAsset[]; errors: string[] };
const pathOk = (value: unknown): value is string => typeof value === 'string'
    && /^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:png|webp|jpe?g)$/i.test(value)
    && !value.split('/').includes('..');
const idOk = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,79}$/.test(value);
const legacyIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.@:-]{2,239}$/.test(id)))] : [];
const tags = (value: unknown): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim()).slice(0, 16)
    : [];
const legacyZhongLingPortraitIds = new Set(['TF005', 'TV009', 'TV010']);

/** Metadata is the only matching source. ZIP packs provide their own image references. */
export const parseAvgManifest = (raw: unknown, imageForFile: (file: string, id: string) => string =
    file => `/assets/avg/${file}`): PackResult => {
    const result: PackResult = { scenes: [], portraits: [], errors: [] };
    if (!raw || typeof raw !== 'object' || (raw as any).version !== 1) {
        result.errors.push('manifest version must be 1');
        return result;
    }
    const source = raw as Record<string, unknown>;
    if (source.themeId && (typeof source.themeId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(source.themeId))) {
        result.errors.push('invalid pack themeId');
        return result;
    }
    const used = new Set<string>();
    const styleFamily = typeof source.styleFamily === 'string' ? source.styleFamily.trim() : '';
    const readCommon = (entry: unknown, kind: 'scene' | 'portrait', index: number) => {
        const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        const id = item.id;
        const file = item.file;
        if ((item.themeId && (typeof item.themeId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(item.themeId)))
            || (item.characterKey !== undefined && (typeof item.characterKey !== 'string'
                || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,159}$/.test(item.characterKey)))
            || (item.baseAssetId !== undefined && !idOk(item.baseAssetId))) {
            result.errors.push(`${kind}[${index}] invalid theme/character/base metadata`);
            return null;
        }
        if (!idOk(id) || !pathOk(file) || used.has(id)) {
            result.errors.push(`${kind}[${index}] invalid or duplicate id/file`);
            return null;
        }
        used.add(id);
        return { item, id, image: imageForFile(file, id), version: Number.isInteger(item.version) && Number(item.version) > 0 ? Number(item.version) : 1 };
    };
    for (const [index, entry] of (Array.isArray(source.scenes) ? source.scenes : []).entries()) {
        const common = readCommon(entry, 'scene', index);
        if (!common) continue;
        const profile = normalizeAvgProfile(common.item.profile);
        if (!profile) { result.errors.push(`scene[${index}] invalid fixed vocabulary profile`); continue; }
        result.scenes.push({ id: common.id, image: common.image, version: common.version, profile, legacyAssetIds: legacyIds(common.item.legacyAssetIds),
            themeId: normalizeAvgTheme(common.item.themeId || source.themeId) || undefined,
            styleFamily, label: typeof common.item.label === 'string' ? common.item.label.slice(0, 100) : common.id });
    }
    const ages = ['child', 'teen', 'young', 'middle', 'elder'];
    for (const [index, entry] of (Array.isArray(source.portraits) ? source.portraits : []).entries()) {
        const common = readCommon(entry, 'portrait', index);
        if (!common) continue;
        const item = common.item;
        const profile = normalizeAvgPortraitProfile(item.profile);
        const rawAgeRange = item.ageRange && typeof item.ageRange === 'object' && !Array.isArray(item.ageRange)
            ? item.ageRange as Record<string, unknown> : {};
        const ageMin = rawAgeRange.min;
        const ageMax = rawAgeRange.max;
        const rawProfile = item.profile && typeof item.profile === 'object' && !Array.isArray(item.profile)
            ? item.profile as Record<string, unknown> : {};
        const outfitArchetype = archetypeFromOutfit(profile?.服饰类别);
        if ((item.gender !== '男' && item.gender !== '女') || !ages.includes(String(item.visualAge))
            || typeof ageMin !== 'number' || typeof ageMax !== 'number'
            || !Number.isInteger(ageMin) || !Number.isInteger(ageMax)
            || Number(ageMin) < 0 || Number(ageMax) < Number(ageMin)
            || (item.reusePolicy !== 'unique' && item.reusePolicy !== 'crowd') || item.portraitVerified !== true
            || !profile?.服饰类别 || (profile.视觉年龄 && profile.视觉年龄 !== item.visualAge)
            || (typeof rawProfile.江湖形象 === 'string' && outfitArchetype
                && rawProfile.江湖形象.trim() !== outfitArchetype)) {
            result.errors.push(`portrait[${index}] missing or conflicting verified gender/ageRange/visualAge/archetype/outfit/reusePolicy`);
            continue;
        }
        // The approved Zhong Ling base and two outfits shipped with an 18–23
        // design range. Read-time calibration makes these same images usable at 16;
        // keep the installed manifest, NPC age, visual design and identity unchanged.
        const legacyZhongLing = legacyZhongLingPortraitIds.has(common.id)
            && item.characterKey === 'tianlong:zhong-ling' && item.gender === '女'
            && normalizeAvgTheme(item.themeId || source.themeId) === 'tianlong'
            && ageMin === 18 && ageMax === 23;
        const calibratedAgeMin = legacyZhongLing ? 16
            : item.characterKey === 'shuihu_jinpingmei:wu-da-lang' && Number(ageMin) === 35 ? 30 : Number(ageMin);
        result.portraits.push({ id: common.id, image: common.image, version: common.version, legacyAssetIds: legacyIds(common.item.legacyAssetIds),
            gender: item.gender,
            ageRange: { min: calibratedAgeMin, max: Number(ageMax) },
            visualAge: item.visualAge as AvgPortraitAsset['visualAge'],
            reusePolicy: item.reusePolicy, portraitVerified: true, styleFamily,
            roleTags: tags(item.roleTags), appearanceTags: tags(item.appearanceTags), profile,
            themeId: normalizeAvgTheme(item.themeId || source.themeId) || undefined,
            characterKey: typeof item.characterKey === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,159}$/.test(item.characterKey) ? item.characterKey : undefined,
            label: typeof item.name === 'string' ? item.name.slice(0, 100) : typeof item.label === 'string' ? item.label.slice(0, 100) : common.id,
            aliases: tags(item.aliases),
            baseAssetId: idOk(item.baseAssetId) ? item.baseAssetId : undefined,
            faceFamilyKey: typeof item.faceFamilyKey === 'string' ? item.faceFamilyKey.slice(0, 160) : undefined,
            variantStage: typeof item.variantStage === 'string' ? item.variantStage.slice(0, 100) : undefined,
            variantLabel: typeof item.variantLabel === 'string' ? item.variantLabel.slice(0, 100) : undefined });
    }
    for (const asset of result.portraits) {
        if (asset.variantStage && !asset.baseAssetId) result.errors.push(`portrait ${asset.id} variant requires baseAssetId`);
        if (!asset.baseAssetId || asset.baseAssetId === asset.id) continue;
        const base = result.portraits.find(candidate => candidate.id === asset.baseAssetId);
        if (!base || (base.baseAssetId && base.baseAssetId !== base.id) || base.gender !== asset.gender
            || base.characterKey !== asset.characterKey || base.themeId !== asset.themeId
            || (base.faceFamilyKey && base.faceFamilyKey !== asset.faceFamilyKey)) {
            result.errors.push(`portrait ${asset.id} has invalid same-person base`);
        }
    }
    return result;
};

export const AVG_PRESET_PACK = parseAvgManifest(manifestJson);
