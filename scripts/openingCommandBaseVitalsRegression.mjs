import assert from 'node:assert/strict';
import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import { 创建开场命令基态 } from './hooks/useGame/storyState.ts';
import { 执行响应命令处理 } from './hooks/useGame/responseCommandProcessor.ts';
import {
  规范化环境信息,
  规范化角色物品容器映射,
  规范化社交列表
} from './hooks/useGame/stateTransforms.ts';

const roleBase = {
  姓名: '方小腊',
  性别: '男',
  年龄: 22,
  出生日期: '1月1日',
  外貌: '',
  性格: '',
  称号: '初出茅庐',
  境界: '凡人',
  境界层级: 1,
  天赋列表: [],
  出身背景: { 名称: '', 描述: '', 效果: '' },
  所属门派ID: 'none',
  门派职位: '无',
  门派贡献: 0,
  金钱: { 金元宝: 0, 银子: 5, 铜钱: 500 },
  当前精力: 100,
  最大精力: 100,
  当前内力: 0,
  最大内力: 0,
  当前饱腹: 80,
  最大饱腹: 100,
  当前口渴: 80,
  最大口渴: 100,
  当前负重: 0,
  最大负重: 100,
  当前坐标X: 0,
  当前坐标Y: 0,
  力量: 10,
  敏捷: 10,
  体质: 10,
  根骨: 10,
  悟性: 10,
  福源: 10,
  头部当前血量: 30,
  头部最大血量: 30,
  头部状态: '正常',
  胸部当前血量: 44,
  胸部最大血量: 44,
  胸部状态: '正常',
  腹部当前血量: 40,
  腹部最大血量: 40,
  腹部状态: '正常',
  左手当前血量: 22,
  左手最大血量: 22,
  左手状态: '正常',
  右手当前血量: 22,
  右手最大血量: 22,
  右手状态: '正常',
  左腿当前血量: 21,
  左腿最大血量: 21,
  左腿状态: '正常',
  右腿当前血量: 21,
  右腿最大血量: 21,
  右腿状态: '正常',
  装备: {
    头部: '无',
    胸部: '无',
    盔甲: '无',
    内衬: '无',
    腿部: '无',
    手部: '无',
    足部: '无',
    主武器: '无',
    副武器: '无',
    暗器: '无',
    背部: '无',
    腰部: '无',
    坐骑: '无'
  },
  物品列表: [],
  功法列表: [],
  当前经验: 0,
  升级经验: 100,
  玩家BUFF: [],
  突破条件: []
};

const commandBase = 创建开场命令基态(roleBase);

assert.equal(commandBase.角色.姓名, '方小腊');
assert.equal(commandBase.角色.头部当前血量, 30);
assert.equal(commandBase.角色.胸部当前血量, 44);
assert.equal(commandBase.角色.腹部当前血量, 40);

const deps = {
  规范化环境信息,
  规范化社交列表,
  规范化世界状态: (value) => value || {},
  规范化战斗状态: (value) => value || {},
  规范化门派状态: (value) => value || {},
  规范化剧情状态: (value) => value || {},
  规范化剧情规划状态: (value) => value || {},
  规范化女主剧情规划状态: (value) => value,
  规范化同人剧情规划状态: (value) => value,
  规范化同人女主剧情规划状态: (value) => value,
  规范化角色物品容器映射,
  战斗结束自动清空: (value) => value || {},
};

const commands = [
  { action: 'set', key: '角色.左手.当前血量', value: 100 },
  { action: 'set', key: '角色.左手.最大血量', value: 100 },
  { action: 'set', key: '角色.右手.当前血量', value: 100 },
  { action: 'set', key: '角色.右手.最大血量', value: 100 },
  { action: 'set', key: '角色.左腿.当前血量', value: 100 },
  { action: 'set', key: '角色.左腿.最大血量', value: 100 },
  { action: 'set', key: '角色.右腿.当前血量', value: 100 },
  { action: 'set', key: '角色.右腿.最大血量', value: 100 },
];

const next = 执行响应命令处理(
  { logs: [], tavern_commands: commands },
  commandBase,
  deps,
  undefined,
  { applyState: false },
);

assert.equal(next.角色.头部当前血量, 30);
assert.equal(next.角色.头部最大血量, 30);
assert.equal(next.角色.胸部当前血量, 44);
assert.equal(next.角色.胸部最大血量, 44);
assert.equal(next.角色.腹部当前血量, 40);
assert.equal(next.角色.腹部最大血量, 40);
assert.equal(next.角色.左手当前血量, 100);
assert.equal(next.角色.右手当前血量, 100);
assert.equal(next.角色.左腿当前血量, 100);
assert.equal(next.角色.右腿当前血量, 100);

console.log('Opening command base vitals regression passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'openingCommandBaseVitalsRegression.entry.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const bundled = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
