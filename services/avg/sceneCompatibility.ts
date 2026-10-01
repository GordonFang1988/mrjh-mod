/** Resource relationships only. Model fields are never rewritten or inferred from prose. */
const spaceGroups: readonly (readonly string[])[] = [
    ['客栈大堂', '酒楼大厅', '茶馆', '驿站大厅'],
    ['院落', '门派前庭', '门派广场', '寺观外院', '帮会院落', '驿站院落', '镖局货院', '猎户小院'],
    ['会客厅', '民居堂屋', '门派议事厅', '掌门议事室', '商会大厅', '镖局大厅', '山寨大厅'],
    ['客舍', '客栈客房', '弟子寝舍', '民居卧室'],
    ['练剑坪', '露天练武场'], ['练功房', '室内演武厅'],
    ['藏经阁', '藏书阁'], ['牢房', '地牢'], ['斋堂', '膳堂'],
    ['铁匠铺内', '铸剑房'], ['医馆内', '药房', '炼药房'],
    ['山道', '后山小径'], ['树林', '林间空地'], ['竹林', '竹林小径'],
    ['洞内', '静修洞穴', '石窟'], ['湿地', '沼泽'],
    ['官道', '乡间土路', '村道'], ['渡口', '码头', '水上栈桥']
];
const additionalSpaces: readonly (readonly [string, readonly string[]])[] = [
    ['山道', ['山腰']], ['山腰', ['山道', '山脚']], ['山脚', ['山腰']],
    ['后山小径', ['林间小径']], ['林间小径', ['后山小径']],
    ['思过崖', ['悬崖边']], ['山中茅屋内', ['民居堂屋']]
];
const spaces = new Map<string, Set<string>>();
const addSpaces = (space: string, alternatives: readonly string[]) => {
    const values = spaces.get(space) || new Set<string>();
    alternatives.forEach(value => { if (value !== space) values.add(value); });
    spaces.set(space, values);
};
for (const group of spaceGroups) for (const space of group) addSpaces(space, group);
for (const [space, alternatives] of additionalSpaces) addSpaces(space, alternatives);
export const avgCompatibleSpaces = (space: string): string[] => [...(spaces.get(space) || [])];

const functionGroups = [
    { functions: ['茶馆', '酒楼', '客栈'], spaces: ['茶馆', '酒楼大厅', '客栈大堂'] },
    { functions: ['客栈', '驿站'], spaces: ['客栈大堂', '驿站大厅', '客栈客房', '客舍', '院落', '驿站院落'] },
    { functions: ['医馆', '药铺'], spaces: ['医馆内', '药房', '炼药房', '店铺内'] },
    { functions: ['铁匠铺', '铸剑坊'], spaces: ['铁匠铺内', '铸剑房'] },
    { functions: ['铁匠铺', '铸剑坊', '工坊'], spaces: ['铁匠铺内', '铸剑房'], distance: 2 },
    { functions: ['民居', '府邸'], spaces: ['民居堂屋', '民居卧室', '会客厅', '书房', '厢房', '院落', '厨房', '园林'] },
    { functions: ['门派', '武馆'], spaces: ['练功房', '室内演武厅', '练剑坪', '露天练武场', '院落', '门派前庭', '门派广场'] },
    { functions: ['衙门', '牢狱'], spaces: ['牢房', '地牢'] }
] as const;
export const avgRelatedSceneFunctionDistance = (wantedSpace: string, wanted: string | undefined, availableSpace: string, available: string | undefined): number => {
    if (!wanted || !available) return Infinity;
    const matches = functionGroups.filter(group => (group.spaces as readonly string[]).includes(wantedSpace)
        && (group.spaces as readonly string[]).includes(availableSpace)
        && (group.functions as readonly string[]).includes(wanted) && (group.functions as readonly string[]).includes(available));
    return matches.length ? Math.min(...matches.map(group => 'distance' in group ? group.distance : 1)) : Infinity;
};
export const avgRelatedSceneFunctions = (wantedSpace: string, wanted: string | undefined, availableSpace: string, available: string | undefined): boolean =>
    Number.isFinite(avgRelatedSceneFunctionDistance(wantedSpace, wanted, availableSpace, available));

/** These protocol values explicitly express no preference; keep them in saved model fields. */
export const avgUnspecifiedField = (value?: string): boolean => !value || ['通用', '未知', '不适用'].includes(value);
