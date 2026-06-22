const 读取文本 = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const 提取社交索引路径 = (rawKey: unknown): { index: number; fieldPath: string } | null => {
    const key = 读取文本(rawKey).replace(/^gameState\./u, '');
    const matched = /^社交\[(\d+)\](?:\.(.*))?$/u.exec(key);
    if (!matched) return null;
    return {
        index: Number(matched[1]),
        fieldPath: 读取文本(matched[2] || '')
    };
};

const 是带归属的旧式NPC记忆命令 = (command: any): boolean => {
    if (command?.action !== 'push') return false;
    const socialPath = 提取社交索引路径(command?.key);
    if (!socialPath || socialPath.fieldPath !== '记忆') return false;
    const value = command?.value;
    return Boolean(
        value && typeof value === 'object' && !Array.isArray(value) && (
            读取文本(value.npcId || value.NPCID)
            || 读取文本(value.npcName || value.NPC姓名)
        )
    );
};

export const isDangerousIndexedSocialWrite = (command: any): boolean => {
    const action = 读取文本(command?.action);
    if (!['add', 'set', 'push', 'delete'].includes(action)) return false;
    if (!提取社交索引路径(command?.key)) return false;

    // Legacy memory commands that carry a stable owner are converted by the executor.
    if (是带归属的旧式NPC记忆命令(command)) return false;
    return true;
};

export const filterUnsafeNpcCommands = <T extends any>(commands: T[]): T[] => (
    Array.isArray(commands) ? commands.filter((cmd) => !isDangerousIndexedSocialWrite(cmd)) : []
);

const 默认空值 = new Set([
    '',
    '未知',
    '未知身份',
    '未知境界',
    '暂无简介',
    '陌生',
    '萍水相逢',
    '未定义关系'
]);

const 默认字段 = new Set([
    'id',
    '姓名',
    '性别',
    '年龄',
    '身份',
    '境界',
    '简介',
    '是否在场',
    '是否队友',
    '是否主要角色',
    '好感度',
    '关系状态',
    '记忆',
    '总结记忆'
]);

const 是默认编号ID = (value: unknown): boolean => /^npc_\d+$/iu.test(读取文本(value));
const 是默认编号姓名 = (value: unknown): boolean => /^角色\d+$/u.test(读取文本(value));

const 有有效记忆 = (value: unknown): boolean => (
    Array.isArray(value) && value.some((item) => {
        if (typeof item === 'string') return item.trim().length > 0;
        return Boolean(item && typeof item === 'object' && 读取文本((item as any).内容 || (item as any).content));
    })
);

const 有非默认值 = (value: unknown): boolean => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return false;
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'string') return !默认空值.has(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return Boolean(value);
};

export const isInvalidSocialNpcRecord = (rawNpc: any): boolean => {
    if (!rawNpc || typeof rawNpc !== 'object' || Array.isArray(rawNpc)) return true;

    const id = 读取文本(rawNpc.id);
    const name = 读取文本(rawNpc.姓名);
    const hasStableId = id.length > 0 && !是默认编号ID(id);
    const hasRealName = name.length > 0 && !是默认编号姓名(name) && !默认空值.has(name);
    if (hasStableId || hasRealName) return false;

    if (有有效记忆(rawNpc.记忆) || 有有效记忆(rawNpc.总结记忆)) return false;

    const hasMeaningfulField = Object.entries(rawNpc).some(([key, value]) => (
        !默认字段.has(key) && 有非默认值(value)
    ));
    return !hasMeaningfulField;
};

export const filterValidSocialNpcRecords = <T extends any>(list: T[]): T[] => (
    Array.isArray(list) ? list.filter((npc) => !isInvalidSocialNpcRecord(npc)) : []
);
