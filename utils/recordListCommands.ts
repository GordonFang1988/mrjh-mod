import { filterValidKungfuRecords } from './kungfuRecords';

const worldFields: Record<string, string[]> = {
    待执行事件: ['事件名', '事件说明'],
    进行中事件: ['事件名', '事件说明'],
    已结算事件: ['事件名', '事件说明'],
    活跃NPC列表: ['姓名', '当前状态', '当前行动'],
    世界镜头规划: ['镜头标题', '镜头内容'],
    江湖史册: ['标题', '归档内容']
};

/** Validate whole-record writes before the generic path executor can append nested arrays. */
export const isValidRecordListCommand = (key: string, action: string, value: unknown): boolean => {
    const match = key.match(/^(?:gameState\.)?(角色\.功法列表|世界\.([^.[\]]+))(?:\[\d+\])?$/);
    if (!match) return true;
    const fields = worldFields[match[2]];
    const isSkill = match[1] === '角色.功法列表';
    if (!isSkill && !fields) return true;
    if (action === 'delete') return true;
    const validRecord = (item: any): boolean => {
        if (isSkill) return filterValidKungfuRecords([item]).length === 1;
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        return fields.some(field => typeof item[field] === 'string' ? item[field].trim().length > 0
            : Array.isArray(item[field]) && item[field].some((v: unknown) => typeof v === 'string' && v.trim().length > 0));
    };
    if (action === 'push' || /\[\d+\]$/.test(key)) return validRecord(value);
    // set [] intentionally clears the list; malformed replacements must preserve existing records.
    return action === 'set' && Array.isArray(value) && value.every(validRecord);
};
