import { normalizeCanonicalGameTime, 结构化时间转标准串 } from '../hooks/useGame/timeUtils';
import { normalizeStateCommandKey } from './stateHelpers';

export const AUXILIARY_INPUT_LIMITS = { recall: 14000, 'world-evolution': 48000, planning: 48000 } as const;
export type AuxiliaryTask = keyof typeof AUXILIARY_INPUT_LIMITS;
export type InputSectionName = 'rules' | 'identity' | 'schema' | 'analysis' | 'extra' | 'world' | 'social' | 'story' | 'heroine'
    | 'environment' | 'body' | 'history' | 'memory' | 'plan' | 'commands' | 'hints' | 'lore' | 'recall' | 'query' | 'trigger' | 'novel' | 'worldbook';
export type InputSectionMetric = {
    name: InputSectionName; sourceChars: number; sentChars: number;
    sourceItems?: number; sentItems?: number; omittedItems?: number;
};
export type AuxiliaryInputMetric = { version: 1; budgetChars: number; sections: InputSectionMetric[]; details?: InputSectionMetric[] };
export const countChars = (text: string): number => Array.from(text).length;
const excerptNote = '〔节选；省略部分不可用于推断或整对象覆盖〕';

// This bounds an excerpt, not the save. Every shortened field is marked.
export const boundedText = (text: string | undefined, limit: number): string => {
    const value = (text || '').trim();
    const chars = Array.from(value);
    if (chars.length <= limit) return value;
    if (limit <= countChars(excerptNote)) return '';
    return chars.slice(0, limit - countChars(excerptNote)).join('') + excerptNote;
};

// Keep complete lines/records. Retain section labels so omissions are explicit instead of broken facts.
export const budgetTextRecords = (text: string, limit: number): string => {
    if (limit <= 0 || countChars(text) <= limit) return text;
    const notice = '〔资料未完整展示；缺失条件不得视为已满足〕';
    if (limit < countChars(notice)) return '';
    const units: Array<{text: string; order: number; priority: number}> = [];
    let chapter = '', metadata: string[] = [], label = '', current: string[] = [], tree: string[] = [];
    const flush = () => {
        if (!current.some(line => line.trim())) return;
        const body = [chapter, ...metadata, ...tree, label, ...current].filter(Boolean).join('\n');
        units.push({text: body, order: units.length, priority:
            /原著硬约束|前置条件|触发条件|阻断条件|读者视角|最早|最晚|最迟/.test(body) ? 3 : /分解组号|章节范围|时间线范围/.test(body) ? 2 : 1});
        current = [];
    };
    // A numbered record includes all conditions and visibility lines until the next record.
    // It is either sent whole or omitted whole; a condition never floats under another event.
    for (const line of text.split(/\r?\n/)) {
        if (/^【[^】]+】$/.test(line.trim())) {
            flush();
            if (/^【(?:前一|当前|下一)章节内容】$/.test(line.trim())) {
                chapter = line; metadata = []; tree = []; label = '';
            } else if (chapter) { label = line; }
            else { chapter = line; }
            continue;
        }
        if (/^(?:分解组号|章节范围|章节标题|是否开局组|时间线范围)：/.test(line)) {
            flush(); metadata.push(/^章节标题：/.test(line) ? boundedText(line, 250) : line); continue;
        }
        const treeNode = line.match(/^((?:│  )*)(?:• |├─ )(.*)$/);
        if (treeNode) {
            flush(); label = '';
            const depth = line.includes('├─ ') ? (treeNode[1]?.length || 0) / 3 + 1 : 0;
            tree = tree.slice(0, depth); tree[depth] = line;
            continue;
        }
        if (/^[^\s：]{1,30}：$/.test(line)) {
            flush(); label = line; continue;
        }
        if (/^\[[^\]]+\](?:[：:]|\s|$)/.test(line) || /^\[\d+\]/.test(line)) flush();
        else if (/^(?:开局已成立事实|前组延续事实|本组结束状态|给下一组参考)：$/.test(label)
            && current.length && !/^(?:前置条件|触发条件|阻断条件|谁知道|谁不知道|是否仅读者视角可见)：/.test(line)) flush();
        current.push(line);
    }
    flush();
    let spent = countChars(notice) + 2;
    const selected: typeof units = [];
    for (const unit of [...units].sort((a, b) => b.priority - a.priority || a.order - b.order)) {
        const size = countChars(unit.text) + 2;
        if (spent + size > limit) continue;
        spent += size; selected.push(unit);
    }
    return [...selected.sort((a, b) => a.order - b.order).map(unit => unit.text), notice].join('\n\n');
};

export type Projection = {
    text: string;
    metric: InputSectionMetric;
    arrays: Array<{ path: string; total: number; visible: number[]; identities?: Array<{value: string; index: number}> }>;
    incomplete: string[];
};
const identityKey = /^(?:id|ID|姓名|名字|名称|事件名|镜头标题|标题|当前分解组)$/;
const criticalKey = /条件|约束|门槛|谁知道|谁不知道|读者视角|最早|最晚|时间|期限|当前状态|原著推进状态/;
const hiddenSocialKey = /立绘|头像|图片|图像|资源|背包|装备|功法|技能|战斗|属性|数值|外貌描写/;
const dateValue = (raw: unknown): number | undefined => {
    const canonical = typeof raw === 'string' ? normalizeCanonicalGameTime(raw) : 结构化时间转标准串(raw);
    if (!canonical) return undefined;
    const [year, month, day, hour, minute] = canonical.split(':').map(Number);
    return ((((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute);
};
const searchable = (value: unknown): string => {
    if (typeof value === 'string') return value.slice(0, 2000);
    if (!value || typeof value !== 'object') return String(value ?? '');
    return Object.entries(value).filter(([key]) => !hiddenSocialKey.test(key))
        .slice(0, 32).map(([key, child]) => key + ':' + (typeof child === 'string' ? child.slice(0, 1500)
            : Array.isArray(child) ? child.slice(0, 16).map(item => typeof item === 'string' ? item.slice(0, 150) : '').join(' ')
            : '')).join(' ');
};
const queryTerms = (query: string): string[] => {
    const terms = new Set<string>();
    for (const block of query.toLowerCase().match(/[a-z0-9_]{2,}|[\u4e00-\u9fff]{2,}/g) || []) {
        if (block.length <= 30) terms.add(block);
        if (/[\u4e00-\u9fff]/.test(block)) {
            for (let i = 0; i < Math.min(block.length - 1, 1500); i++) terms.add(block.slice(i, i + 2));
        }
    }
    return [...terms].slice(0, 1200);
};
const keyPriority = (key: string) => identityKey.test(key) ? 6 : criticalKey.test(key) ? 5
    : /当前章节|下一章|规划|待执行|进行中|活跃|镜头/.test(key) ? 4
    : /关系|势力|位置|地点|目标|承接|影响|行动|记忆/.test(key) ? 3
    : /历史|史册|已结算|地图|建筑/.test(key) ? 1 : 2;

/** Indexed read-only task view. Paths refer to the original normalized state, never the visible order. */
export const projectAuxiliaryState = (value: unknown, options: {
    name: InputSectionName; root: string; maxChars: number; query?: string; currentTime?: string; social?: boolean;
}): Projection => {
    const sourceText = JSON.stringify(value ?? null);
    const terms = queryTerms(options.query || '');
    const now = dateValue(options.currentTime);
    const arrays: Projection['arrays'] = [];
    const incomplete = new Set<string>();
    const itemCount = (node: unknown): number => Array.isArray(node)
        ? node.length + node.reduce((sum, child) => sum + itemCount(child), 0)
        : node && typeof node === 'object' ? Object.values(node).reduce<number>((sum, child) => sum + itemCount(child), 0) : 0;
    const sourceItems = itemCount(value);
    const rank = (item: unknown, index: number, total: number): number => {
        const text = searchable(item).toLowerCase();
        let score = terms.reduce((sum, term) => sum + (text.includes(term) ? term.length >= 4 ? 8 : 1 : 0), 0);
        if (item && typeof item === 'object' && now !== undefined) {
            for (const [key, child] of Object.entries(item)) {
                if (!/行动结束时间|预计结束时间|计划执行时间|最早执行时间|最晚执行时间|触发时间|最晚触发时间|最早触发时间/.test(key)) continue;
                const time = dateValue(child);
                if (time !== undefined && time <= now) score += 100000;
                else if (time !== undefined && time - now <= 1440) score += 1000;
            }
        }
        if (/女主|跨章|未结|重要|全局/.test(text)) score += 30;
        return score + index / Math.max(1, total);
    };
    const walk = (node: unknown, path: string, budget: number, depth: number, field = ''): unknown => {
        if (node === null || node === undefined) return null;
        if (typeof node === 'string') {
            const limit = Math.max(0, Math.min(budget - 2, identityKey.test(field) || criticalKey.test(field) ? 2000 : 700));
            if (countChars(JSON.stringify(node)) <= Math.min(budget, limit + 2)) return node;
            incomplete.add(path);
            // Never present half of a condition or identifier as if it were the original.
            return identityKey.test(field) || criticalKey.test(field)
                ? '〔字段未完整展示，保持原值〕' : boundedText(node, limit);
        }
        if (typeof node !== 'object') return node;
        if (depth > 10 || budget < 80) { incomplete.add(path); return '〔未展示，保持原值〕'; }
        if (Array.isArray(node)) {
            const history = /历史卷宗|江湖史册|已结算/.test(path);
            const cap = history ? 4 : /地图|建筑/.test(path) ? 8 : options.social ? 20 : 24;
            const ranked = node.map((item, index) => ({item, index, score: rank(item, index, node.length)}))
                .sort((a, b) => b.score - a.score || b.index - a.index).slice(0, cap);
            const output: Record<string, unknown> = { __总数: node.length };
            const identities = node.flatMap((item, index) => item && typeof item === 'object' && !Array.isArray(item)
                ? Object.entries(item).filter(([key, child]) => identityKey.test(key) && typeof child === 'string' && child.trim())
                    .map(([key, child]) => ({value: key + '=' + String(child).trim(), index})) : []);
            const scope = {path, total: node.length, visible: [] as number[], identities};
            arrays.push(scope);
            for (const {item, index} of ranked) {
                const key = '[' + index + ']';
                const remaining = budget - countChars(JSON.stringify(output)) - countChars(key) - 6;
                if (remaining < 120) continue;
                const previousArrayCount = arrays.length;
                const previousIncomplete = new Set(incomplete);
                const child = walk(item, path + '[' + index + ']', Math.min(remaining, options.social ? 2200 : 3000), depth + 1);
                const proposed = {...output, [key]: child};
                if (countChars(JSON.stringify(proposed)) > budget) {
                    arrays.splice(previousArrayCount);
                    for (const p of incomplete) if (!previousIncomplete.has(p)) incomplete.delete(p);
                    continue;
                }
                output[key] = child; scope.visible.push(index);
            }
            if (scope.visible.length < node.length) incomplete.add(path);
            return output;
        }
        const output: Record<string, unknown> = {};
        const entries = Object.entries(node as Record<string, unknown>)
            .filter(([key]) => !key.startsWith('__') && !(options.social && hiddenSocialKey.test(key)))
            .sort(([a], [b]) => keyPriority(b) - keyPriority(a));
        // Read-only fields dropped from NPC profiles do not authorize replacing the profile.
        for (const key of Object.keys(node)) if (!entries.some(([visible]) => visible === key)) incomplete.add(path + '.' + key);
        for (const [key, child] of entries) {
            const childPath = path ? path + '.' + key : key;
            const remaining = budget - countChars(JSON.stringify(output)) - countChars(key) - 6;
            if (remaining < 60) { incomplete.add(childPath); continue; }
            const childBudget = Array.isArray(child) ? Math.min(remaining, Math.max(500, Math.floor(budget * 0.35))) : remaining;
            const previousArrayCount = arrays.length;
            const projected = walk(child, childPath, childBudget, depth + 1, key);
            const proposed = {...output, [key]: projected};
            if (countChars(JSON.stringify(proposed)) > budget) {
                arrays.splice(previousArrayCount); incomplete.add(childPath); continue;
            }
            output[key] = projected;
        }
        return output;
    };
    const projected = walk(value ?? {}, options.root, options.maxChars - 64, 0);
    const text = JSON.stringify(projected);
    const sentItems = arrays.reduce((sum, scope) => sum + scope.visible.length, 0);
    return {text, arrays, incomplete: [...incomplete], metric: {name: options.name,
        sourceChars: countChars(sourceText), sentChars: countChars(text), sourceItems, sentItems,
        omittedItems: Math.max(0, sourceItems - sentItems)}};
};

export const TASK_VIEW_RULES = [
    '【任务视图与写回约束】',
    '- 这是有预算的只读视图，不是完整存档。数组以 "[原始索引]" 为键，__总数是完整数组长度；命令仍写 数组[原始索引].字段，禁止按展示顺序重新编号。',
    '- 未展示或节选部分不是不存在、不是已完成，也不是条件已满足；据此不得切章、结算或清空遗漏项。证据不足保持原值。',
    '- 只写已展示且证据完整的最小字段补丁；禁止用视图覆盖整棵树、整张数组或截断对象。新条目使用 push 完整对象。',
    '- __总数等视图元数据禁止写入存档；同数组删除最后执行且按原始索引降序。'
].join('\n');
const relatedPath = (key: string, path: string) => key === path || key.startsWith(path + '.') || key.startsWith(path + '[');
const taskCommandKey = (key: string) => normalizeStateCommandKey(key).replace(/^gameState\./, '').replace(/\.(\d+)(?=\.|$)/g, '[$1]');
export const filterTaskViewCommands = <T extends {key: string; action: string; value?: unknown}>(commands: T[], projections: Projection[]): T[] => {
    const allowed = commands.filter(cmd => {
        const key = taskCommandKey(cmd.key);
        const value = JSON.stringify(cmd.value ?? null);
        if (/__总数|〔节选|〔未展示|〔字段未完整|资料未完整展示/.test(key + value)) return false;
        for (const view of projections) {
            for (const scope of view.arrays) {
                if (cmd.action === 'push' && key === scope.path) {
                    if (cmd.value && typeof cmd.value === 'object' && !Array.isArray(cmd.value)
                        && Object.entries(cmd.value).some(([field, child]) => (scope.identities || [])
                            .filter(item => item.value === field + '=' + String(child).trim()).some(item => {
                                const oldPath = scope.path + '[' + item.index + ']';
                                const removal = commands.find(candidate => candidate.action === 'delete'
                                    && taskCommandKey(candidate.key) === oldPath);
                                return !removal || filterTaskViewCommands([removal], projections).length === 0;
                            }))) return false;
                    continue;
                }
                if (scope.visible.length < scope.total && relatedPath(scope.path, key)) return false;
                if (key.startsWith(scope.path + '[')) {
                    const index = Number(key.slice(scope.path.length).match(/^\[(\d+)\]/)?.[1]);
                    if (!scope.visible.includes(index)) return false;
                }
            }
            if (cmd.action === 'push' && view.arrays.some(scope => scope.path === key)) continue;
            // A partially displayed array permits precise writes to its complete visible members.
            for (const path of view.incomplete) {
                const parts = path.split('.');
                for (let index = parts.length - 1; index > 0; index--) {
                    const field = parts[index].replace(/\[\d+\]$/, '');
                    if (!(criticalKey.test(field) || identityKey.test(field))) continue;
                    if (relatedPath(key, parts.slice(0, index).join('.'))) return false;
                    break;
                }
                if (view.arrays.some(scope => scope.path === path)) {
                    if (relatedPath(path, key)) return false;
                } else if (relatedPath(path, key) || relatedPath(key, path)) return false;
            }
        }
        return true;
    });
    // Preserve original indices through a batch: changes first, appends next, descending deletes last.
    return [...allowed].sort((a, b) => {
        const order = (action: string) => action === 'delete' ? 2 : action === 'push' ? 1 : 0;
        const delta = order(a.action) - order(b.action);
        if (delta) return delta;
        const aIndex = taskCommandKey(a.key).match(/^(.*)\[(\d+)\]$/), bIndex = taskCommandKey(b.key).match(/^(.*)\[(\d+)\]$/);
        return a.action === 'delete' && b.action === 'delete' && aIndex?.[1] === bIndex?.[1]
            ? Number(bIndex?.[2]) - Number(aIndex?.[2]) : 0;
    });
};

/** Final envelope, including fixed rules. Whole JSON fields must already have been projected. */
export const budgetAuxiliaryMessages = <T extends {role: string; content: string}>(task: AuxiliaryTask,
    sections: Array<{name: InputSectionName; message: T; limit?: number; required?: boolean; records?: boolean}>,
    details: InputSectionMetric[] = []): {messages: T[]; inputBreakdown: AuxiliaryInputMetric} => {
    const budgetChars = AUXILIARY_INPUT_LIMITS[task];
    // Leave room for separators added by compatible transports when merging message roles.
    let available = budgetChars - 256;
    const results = new Map<number, T>();
    const metrics: InputSectionMetric[] = [];
    // Structural rules and format are never silently truncated.
    sections.forEach((section, index) => {
        if (!section.required) return;
        available -= countChars(section.message.content);
        results.set(index, section.message);
        metrics.push({name: section.name, sourceChars: countChars(section.message.content), sentChars: countChars(section.message.content)});
    });
    if (available < 0) throw new Error('辅助任务固定规则超过输入预算');
    sections.forEach((section, index) => {
        if (section.required) return;
        const sourceChars = countChars(section.message.content);
        const limit = Math.min(section.limit ?? available, available);
        const text = limit <= 0 ? '' : section.records ? budgetTextRecords(section.message.content, limit) : boundedText(section.message.content, limit);
        available -= countChars(text);
        metrics.push({name: section.name, sourceChars, sentChars: countChars(text)});
        if (text) results.set(index, {...section.message, content: text});
    });
    return {messages: [...results.entries()].sort(([a], [b]) => a - b).map(([, message]) => message),
        inputBreakdown: {version: 1, budgetChars, sections: metrics.slice(0, 48), details: details.slice(0, 48)}};
};

export const auxiliaryOutputConfig = <T extends {maxTokens?: number}>(config: T, task: AuxiliaryTask): T => ({
    ...config, maxTokens: Math.min(Number(config.maxTokens) > 0 ? Number(config.maxTokens) : 8192, task === 'recall' ? 4096 : 8192)
});
