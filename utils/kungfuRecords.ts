import type { 功法结构 } from '../models/kungfu';

/** Empty arrays from malformed writebacks are not learned skills. */
export const filterValidKungfuRecords = (value: unknown): 功法结构[] =>
    Array.isArray(value) ? value.filter((item): item is 功法结构 =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
        && typeof item.ID === 'string' && item.ID.trim().length > 0
        && typeof item.名称 === 'string' && item.名称.trim().length > 0
    ) : [];
