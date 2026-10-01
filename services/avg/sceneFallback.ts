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

export const avgLocationFallback = (profile: AvgSceneProfile, placeKey?: string) => {
    if (!avgUnspecifiedField(profile.空间) || !placeKey || placeKey.startsWith('transient:')) return undefined;
    const parts = placeKey.split('/');
    const room = parts[3]?.trim();
    if (!room) return undefined;
    const terms: ReadonlyArray<readonly [string, string]> = [
        ...AVG_SCENE_SPACES.filter(space => !avgUnspecifiedField(space)).map(space => [space, space] as const),
        ...roomAliases
    ];
    // Prefer the most specific room term; the end of "后院柴房" identifies the room.
    const matches = terms.filter(([term]) => room.includes(term)).sort((a, b) =>
        b[0].length - a[0].length || room.lastIndexOf(b[0]) - room.lastIndexOf(a[0]));
    const match = matches[0];
    if (!match) return undefined;
    const venue = parts[2] || '';
    const venueFunction = AVG_VENUE_FUNCTION.filter(value => !avgUnspecifiedField(value) && venue.includes(value))
        .sort((a, b) => b.length - a.length)[0];
    const matchingProfile: AvgSceneProfile = { ...profile, 空间: match[1] };
    if (avgUnspecifiedField(profile.场所功能) && venueFunction) matchingProfile.场所功能 = venueFunction;
    return { source: 'location' as const, term: match[0], matchingProfile };
};

/** Only breaks metadata ties in the approximate pool; concrete room text has priority. */
export const avgLocationArtScore = (placeKey: string | undefined, asset: AvgSceneAsset): number => {
    const parts = (placeKey || '').split('/');
    const label = asset.label || '';
    const ignored = new Set('的内外间房院城国前后大小南北东西');
    const overlap = (text: string) => [...new Set(text)].filter(char => !ignored.has(char) && label.includes(char)).length;
    return overlap(parts[3] || '') * 6 + overlap(parts[2] || '');
};
