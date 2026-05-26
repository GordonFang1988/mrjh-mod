import {
    TavernCommand,
    GameResponse,
    角色数据结构,
    环境信息结构,
    世界数据结构,
    战斗状态结构,
    详细门派结构,
    剧情系统结构,
    剧情规划结构,
    女主剧情规划结构,
    同人剧情规划结构,
    同人女主剧情规划结构
} from '../../types';
import { applyStateCommand } from '../../utils/stateHelpers';
import { normalizeCanonicalGameTime } from './timeUtils';

export type 响应命令处理状态 = {
    角色: 角色数据结构;
    环境: 环境信息结构;
    社交: any[];
    世界: 世界数据结构;
    战斗: 战斗状态结构;
    玩家门派: 详细门派结构;
    任务列表: any[];
    约定列表: any[];
    剧情: 剧情系统结构;
    剧情规划: 剧情规划结构;
    女主剧情规划?: 女主剧情规划结构;
    同人剧情规划?: 同人剧情规划结构;
    同人女主剧情规划?: 同人女主剧情规划结构;
};

type 响应命令处理依赖 = {
    规范化环境信息: (envLike?: any) => 环境信息结构;
    规范化社交列表: (raw?: any[], options?: { 合并同名?: boolean }) => any[];
    规范化世界状态: (raw?: any) => 世界数据结构;
    规范化战斗状态: (raw?: any) => 战斗状态结构;
    规范化门派状态: (raw?: any) => 详细门派结构;
    规范化剧情状态: (raw?: any) => 剧情系统结构;
    规范化剧情规划状态: (raw?: any) => 剧情规划结构;
    规范化女主剧情规划状态: (raw?: any) => 女主剧情规划结构 | undefined;
    规范化同人剧情规划状态: (raw?: any) => 同人剧情规划结构 | undefined;
    规范化同人女主剧情规划状态: (raw?: any) => 同人女主剧情规划结构 | undefined;
    规范化角色物品容器映射: (raw?: any) => 角色数据结构;
    战斗结束自动清空: (battle: 战斗状态结构, story?: 剧情系统结构) => 战斗状态结构;
    设置角色?: (value: 角色数据结构) => void;
    设置环境?: (value: 环境信息结构) => void;
    设置社交?: (value: any[]) => void;
    设置世界?: (value: 世界数据结构) => void;
    设置战斗?: (value: 战斗状态结构) => void;
    设置玩家门派?: (value: 详细门派结构) => void;
    设置任务列表?: (value: any[]) => void;
    设置约定列表?: (value: any[]) => void;
    设置剧情?: (value: 剧情系统结构) => void;
    设置剧情规划?: (value: 剧情规划结构) => void;
    设置女主剧情规划?: (value: 女主剧情规划结构 | undefined) => void;
    设置同人剧情规划?: (value: 同人剧情规划结构 | undefined) => void;
    设置同人女主剧情规划?: (value: 同人女主剧情规划结构 | undefined) => void;
    命令后校准?: (state: 响应命令处理状态) => { state: 响应命令处理状态; corrections?: string[] } | 响应命令处理状态;
};

const 读取文本 = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const 归一化匹配键 = (value: unknown): string => (
    读取文本(value).replace(/\s+/g, '').toLowerCase()
);

const 规范化NPC记忆值 = (value: any): { 内容: string; 时间: string } | null => {
    if (typeof value === 'string') {
        const content = value.trim();
        return content ? { 内容: content, 时间: '未知时间' } : null;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const content = 读取文本(value.内容 ?? value.content ?? value.memory ?? value.text);
    if (!content) return null;
    const rawTime = 读取文本(value.时间 ?? value.time ?? value.timestamp);
    return {
        内容: content,
        时间: normalizeCanonicalGameTime(rawTime) || rawTime || '未知时间'
    };
};

const 从安全命令写入NPC记忆 = (
    social: any[],
    command: TavernCommand
): { social: any[]; applied: boolean } => {
    const list = Array.isArray(social) ? social : [];
    const memory = 规范化NPC记忆值(command.value);
    if (!memory) return { social: list, applied: false };

    const npcId = 读取文本(command.npcId || command.value?.npcId || command.value?.NPCID || command.key);
    const npcName = 读取文本(command.npcName || command.value?.npcName || command.value?.NPC姓名);
    const idKey = 归一化匹配键(npcId);
    const nameKey = 归一化匹配键(npcName);

    let targetIndex = -1;
    if (idKey) {
        targetIndex = list.findIndex((npc) => 归一化匹配键(npc?.id) === idKey || 归一化匹配键(`id:${npc?.id || ''}`) === idKey);
    }
    if (targetIndex < 0 && nameKey) {
        const matched = list
            .map((npc, index) => ({ npc, index }))
            .filter(({ npc }) => 归一化匹配键(npc?.姓名) === nameKey);
        if (matched.length === 1) targetIndex = matched[0].index;
    }
    if (targetIndex < 0) return { social: list, applied: false };

    const next = list.map((npc, index) => {
        if (index !== targetIndex) return npc;
        const oldMemory = Array.isArray(npc?.记忆) ? npc.记忆 : [];
        const duplicated = oldMemory.some((item: any) => (
            读取文本(item?.内容) === memory.内容 && 读取文本(item?.时间) === memory.时间
        ));
        if (duplicated) return npc;
        return {
            ...npc,
            记忆: [...oldMemory, memory]
        };
    });

    return { social: next, applied: true };
};

const 旧式NPC记忆命令带归属信息 = (command: TavernCommand): boolean => {
    if (command?.action !== 'push') return false;
    if (!/^社交\[\d+\]\.记忆$/u.test(读取文本(command.key))) return false;
    const value = command.value;
    return Boolean(
        value && typeof value === 'object' && !Array.isArray(value) && (
            读取文本(value.npcId || value.NPCID)
            || 读取文本(value.npcName || value.NPC姓名)
        )
    );
};

export const 执行响应命令处理 = (
    response: GameResponse,
    currentState: 响应命令处理状态,
    deps: 响应命令处理依赖,
    baseState?: Partial<响应命令处理状态>,
    options?: {
        applyState?: boolean;
    }
): 响应命令处理状态 => {
    const shouldApplyState = options?.applyState !== false;
    let charBuffer = baseState?.角色 || currentState.角色;
    let envBuffer = deps.规范化环境信息(baseState?.环境 || currentState.环境);
    let socialBuffer = Array.isArray(baseState?.社交) ? baseState.社交 : currentState.社交;
    let worldBuffer = deps.规范化世界状态(baseState?.世界 || currentState.世界);
    let battleBuffer = deps.规范化战斗状态(baseState?.战斗 || currentState.战斗);
    let sectBuffer = deps.规范化门派状态(baseState?.玩家门派 || currentState.玩家门派);
    let tasksBuffer = Array.isArray(baseState?.任务列表) ? baseState.任务列表 : currentState.任务列表;
    let agreementsBuffer = Array.isArray(baseState?.约定列表) ? baseState.约定列表 : currentState.约定列表;
    let storyBuffer = deps.规范化剧情状态(baseState?.剧情 || currentState.剧情);
    let storyPlanBuffer = deps.规范化剧情规划状态(baseState?.剧情规划 || currentState.剧情规划);
    let heroinePlanBuffer = deps.规范化女主剧情规划状态(baseState?.女主剧情规划 ?? currentState.女主剧情规划);
    let fandomStoryPlanBuffer = deps.规范化同人剧情规划状态(baseState?.同人剧情规划 ?? currentState.同人剧情规划);
    let fandomHeroinePlanBuffer = deps.规范化同人女主剧情规划状态(baseState?.同人女主剧情规划 ?? currentState.同人女主剧情规划);

    if (Array.isArray(response.tavern_commands)) {
        response.tavern_commands.forEach(cmd => {
            if (cmd?.action === 'pushNpcMemory') {
                const result = 从安全命令写入NPC记忆(socialBuffer, cmd);
                if (result.applied) {
                    socialBuffer = deps.规范化社交列表(result.social, { 合并同名: false });
                }
                return;
            }
            if (旧式NPC记忆命令带归属信息(cmd)) {
                const result = 从安全命令写入NPC记忆(socialBuffer, {
                    ...cmd,
                    action: 'pushNpcMemory',
                    npcId: 读取文本(cmd.value?.npcId || cmd.value?.NPCID),
                    npcName: 读取文本(cmd.value?.npcName || cmd.value?.NPC姓名)
                });
                if (result.applied) {
                    socialBuffer = deps.规范化社交列表(result.social, { 合并同名: false });
                }
                return;
            }
            const result = applyStateCommand(
                charBuffer,
                envBuffer,
                socialBuffer,
                worldBuffer,
                battleBuffer,
                storyBuffer,
                storyPlanBuffer,
                heroinePlanBuffer,
                fandomStoryPlanBuffer,
                fandomHeroinePlanBuffer,
                sectBuffer,
                tasksBuffer,
                agreementsBuffer,
                cmd.key,
                cmd.value,
                cmd.action
            );
            charBuffer = result.char;
            envBuffer = deps.规范化环境信息(result.env);
            socialBuffer = deps.规范化社交列表(result.social, { 合并同名: false });
            worldBuffer = deps.规范化世界状态(result.world);
            battleBuffer = result.battle;
            sectBuffer = deps.规范化门派状态(result.sect);
            tasksBuffer = Array.isArray(result.tasks) ? result.tasks : [];
            agreementsBuffer = Array.isArray(result.agreements) ? result.agreements : [];
            storyBuffer = result.story;
            storyPlanBuffer = deps.规范化剧情规划状态(result.storyPlan);
            heroinePlanBuffer = deps.规范化女主剧情规划状态(result.heroinePlan);
            fandomStoryPlanBuffer = deps.规范化同人剧情规划状态(result.fandomStoryPlan);
            fandomHeroinePlanBuffer = deps.规范化同人女主剧情规划状态(result.fandomHeroinePlan);
        });

        battleBuffer = deps.战斗结束自动清空(battleBuffer, storyBuffer);
        charBuffer = deps.规范化角色物品容器映射(charBuffer);
        socialBuffer = deps.规范化社交列表(socialBuffer);
        storyBuffer = deps.规范化剧情状态(storyBuffer);

        let finalState: 响应命令处理状态 = {
            角色: charBuffer,
            环境: deps.规范化环境信息(envBuffer),
            社交: socialBuffer,
            世界: deps.规范化世界状态(worldBuffer),
            战斗: battleBuffer,
            玩家门派: deps.规范化门派状态(sectBuffer),
            任务列表: Array.isArray(tasksBuffer) ? tasksBuffer : [],
            约定列表: Array.isArray(agreementsBuffer) ? agreementsBuffer : [],
            剧情: storyBuffer,
            剧情规划: deps.规范化剧情规划状态(storyPlanBuffer),
            女主剧情规划: deps.规范化女主剧情规划状态(heroinePlanBuffer),
            同人剧情规划: deps.规范化同人剧情规划状态(fandomStoryPlanBuffer),
            同人女主剧情规划: deps.规范化同人女主剧情规划状态(fandomHeroinePlanBuffer)
        };
        const calibrated = deps.命令后校准?.(finalState);
        if (calibrated) {
            finalState = 'state' in calibrated ? calibrated.state : calibrated;
        }

        if (shouldApplyState) {
            deps.设置角色?.(finalState.角色);
            deps.设置环境?.(finalState.环境);
            deps.设置社交?.(finalState.社交);
            deps.设置世界?.(finalState.世界);
            deps.设置战斗?.(finalState.战斗);
            deps.设置玩家门派?.(finalState.玩家门派);
            deps.设置任务列表?.(finalState.任务列表);
            deps.设置约定列表?.(finalState.约定列表);
            deps.设置剧情?.(finalState.剧情);
            deps.设置剧情规划?.(finalState.剧情规划);
            deps.设置女主剧情规划?.(finalState.女主剧情规划);
            deps.设置同人剧情规划?.(finalState.同人剧情规划);
            deps.设置同人女主剧情规划?.(finalState.同人女主剧情规划);
        }

        return finalState;
    }

    let finalState: 响应命令处理状态 = {
        角色: charBuffer,
        环境: deps.规范化环境信息(envBuffer),
        社交: deps.规范化社交列表(socialBuffer),
        世界: deps.规范化世界状态(worldBuffer),
        战斗: battleBuffer,
        玩家门派: deps.规范化门派状态(sectBuffer),
        任务列表: Array.isArray(tasksBuffer) ? tasksBuffer : [],
        约定列表: Array.isArray(agreementsBuffer) ? agreementsBuffer : [],
        剧情: deps.规范化剧情状态(storyBuffer),
        剧情规划: deps.规范化剧情规划状态(storyPlanBuffer),
        女主剧情规划: deps.规范化女主剧情规划状态(heroinePlanBuffer),
        同人剧情规划: deps.规范化同人剧情规划状态(fandomStoryPlanBuffer),
        同人女主剧情规划: deps.规范化同人女主剧情规划状态(fandomHeroinePlanBuffer)
    };
    const calibrated = deps.命令后校准?.(finalState);
    if (calibrated) {
        finalState = 'state' in calibrated ? calibrated.state : calibrated;
        if (shouldApplyState) {
            deps.设置角色?.(finalState.角色);
            deps.设置环境?.(finalState.环境);
            deps.设置社交?.(finalState.社交);
            deps.设置世界?.(finalState.世界);
            deps.设置战斗?.(finalState.战斗);
            deps.设置玩家门派?.(finalState.玩家门派);
            deps.设置任务列表?.(finalState.任务列表);
            deps.设置约定列表?.(finalState.约定列表);
            deps.设置剧情?.(finalState.剧情);
            deps.设置剧情规划?.(finalState.剧情规划);
            deps.设置女主剧情规划?.(finalState.女主剧情规划);
            deps.设置同人剧情规划?.(finalState.同人剧情规划);
            deps.设置同人女主剧情规划?.(finalState.同人女主剧情规划);
        }
    };
    return finalState;
};
