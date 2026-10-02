import type { AvgSceneAsset, AvgSceneProfile } from '../../models/avg';
import { avgUnspecifiedField } from './sceneCompatibility';
import { AVG_SCENE_SPACES, AVG_VENUE_FUNCTION } from './vocabulary';

// These aliases are used only to search art when the model omitted its space.
// They never replace model fields, classify prose or establish a scene identity.
const roomAliases: ReadonlyArray<readonly [string, string]> = [
    ['柴房', '库房'], ['储藏室', '库房'], ['储物间', '库房'], ['杂物间', '库房'], ['仓房', '库房'],
    ['卧房', '民居卧室'], ['卧室', '民居卧室'], ['客房', '客栈客房'], ['寝室', '弟子寝舍'],
    ['后院', '院落'], ['前院', '院落'], ['小院', '院落'], ['庭院', '院落']
];
const caveSpaces = ['洞内', '静修洞穴', '石窟', '闭关石室'];
const caveAliases: ReadonlyArray<readonly [string, string]> = [
    ...['山洞', '岩洞', '洞穴', '洞府', '洞厅', '洞室', '溶洞', '熔洞', '岩穴', '洞隙']
        .map(term => [term, '洞内'] as const),
    ['洞外', '洞口'], ['洞前', '洞口']
];

export const avgLocationFallback = (profile: AvgSceneProfile, placeKey?: string, contextRegion?: string) => {
    if (!avgUnspecifiedField(profile.空间) || !placeKey || placeKey.startsWith('transient:')) return undefined;
    const parts = placeKey.split('/');
    const room = parts[3]?.trim();
    if (!room) return undefined;
    // A bare stone chamber is ambiguous. Only its declared mountain/rock venue
    // supplies a cave-art search context; well rooms and cellars remain distinct.
    const mountain = !/井室|地窖|货窖|墓室/.test(room)
        && !/衙门|客栈|府邸|宅院|祠堂|地窖|井室/.test(parts[2] || '')
        ? [parts[2], parts[1]].filter(Boolean).join(' ').match(/山|崖|谷|峰|岭|岩|洞|窟/)?.[0] : undefined;
    const entrance = room.match(/(?:山洞|岩洞|洞穴|洞府|溶洞|熔洞)(?:口|外|前|入口)/)?.[0];
    const terms: ReadonlyArray<readonly [string, string]> = [
        ...AVG_SCENE_SPACES.filter(space => !avgUnspecifiedField(space)).map(space => [space, space] as const),
        ...roomAliases, ...caveAliases,
        ...(entrance ? [[entrance, '洞口'] as const] : []),
        ...(mountain ? [['石室', '闭关石室'] as const] : [])
    ];
    // Prefer the most specific room term; the end of "后院柴房" identifies the room.
    const matches = terms.filter(([term]) => room.includes(term)).sort((a, b) =>
        (room.lastIndexOf(b[0]) + b[0].length) - (room.lastIndexOf(a[0]) + a[0].length) || b[0].length - a[0].length);
    let match = matches[0];
    if (mountain && match?.[1] === '地下石室') match = [match[0], '闭关石室'];
    const preferredSpaces = match && caveSpaces.includes(match[1]) ? caveSpaces
        : match?.[1] === '洞口' ? ['洞口'] : undefined;
    const venue = parts[2] || '';
    const venueFunction = AVG_VENUE_FUNCTION.filter(value => !avgUnspecifiedField(value) && venue.includes(value))
        .sort((a, b) => b.length - a.length)[0];
    const matchingProfile: AvgSceneProfile = { ...profile, 空间: match?.[1] || '未知' };
    if (avgUnspecifiedField(profile.场所功能) && venueFunction) matchingProfile.场所功能 = venueFunction;
    const region = avgUnspecifiedField(profile.地域) && !avgUnspecifiedField(contextRegion) ? contextRegion : undefined;
    if (region) matchingProfile.地域 = region;
    return { source: 'location' as const, term: match?.[0] || room, matchingProfile,
        tier: match ? 'space' as const : 'nearest-catalog' as const,
        ...(preferredSpaces ? { preferredSpaces: [...preferredSpaces] } : {}),
        ...(match && ['石室', '地下石室'].includes(match[0]) && mountain ? { contextTerm: mountain } : {}),
        ...(region ? { contextRegion: region } : {}) };
};

/** Rank missing-field art by the concrete place; its parent venue is weak evidence. */
export const avgLocationArtScore = (placeKey: string | undefined, asset: AvgSceneAsset, broad = false): number => {
    const parts = (placeKey || '').split('/');
    const label = asset.label || '';
    const ignored = new Set('的内外间房院城国前后大小南北东西');
    const overlap = (text: string) => [...new Set(text)].filter(char => !ignored.has(char) && label.includes(char)).length;
    if (!broad) return overlap(parts[3] || '') * 6 + overlap(parts[2] || '');
    const clean = (text: string) => text.replace(/未知|未识别|不明|地点|空间|某处|[\d\s\p{P}]/gu, '');
    const room = clean(parts[3] || '');
    const venue = clean(parts[2] || '');
    const broadIgnored = new Set([...ignored, ...'边缘处旁上下头']);
    const phraseScore = (text: string, target: string) => {
        const chars = [...text];
        const singles = [...new Set(chars)].filter(char => !broadIgnored.has(char) && target.includes(char)).length;
        const pairs = [...new Set(chars.slice(1).map((char, index) => chars[index] + char))];
        return singles * 2 + pairs.filter(pair => target.includes(pair)).length * 10;
    };
    // A new phrase is still ranked against all catalog labels and space tags.
    // It does not have to be added to an ever-growing list of exact aliases.
    const naturalTags = [asset.profile.地理环境, asset.profile.植被, asset.profile.地表, asset.profile.水域,
        ...(asset.profile.显著要素 || [])].filter(value => !avgUnspecifiedField(value)).join(' ');
    return phraseScore(room, asset.profile.空间) * 4 + phraseScore(room, label)
        + phraseScore(room, naturalTags) * 2
        + phraseScore(venue, asset.profile.空间) / 4 + phraseScore(venue, label) / 16;
};
