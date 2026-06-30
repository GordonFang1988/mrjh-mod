import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import { 解析命令块 } from './services/ai/storyResponseParser.ts';
import { 执行响应命令处理 } from './hooks/useGame/responseCommandProcessor.ts';
import { __testAllowGeneratedCommand } from './hooks/useGame/variableModelWorkflow.ts';

const emptyState = {
  角色: {},
  环境: {},
  社交: [],
  世界: {},
  战斗: {},
  玩家门派: {},
  任务列表: [],
  约定列表: [],
  剧情: {},
  剧情规划: {},
};

const deps = {
  规范化环境信息: (value) => value || {},
  规范化社交列表: (value) => (Array.isArray(value) ? value : []),
  规范化世界状态: (value) => value || {},
  规范化战斗状态: (value) => value || {},
  规范化门派状态: (value) => value || {},
  规范化剧情状态: (value) => value || {},
  规范化剧情规划状态: (value) => value || {},
  规范化女主剧情规划状态: (value) => value,
  规范化同人剧情规划状态: (value) => value,
  规范化同人女主剧情规划状态: (value) => value,
  规范化角色物品容器映射: (value) => value || {},
  战斗结束自动清空: (value) => value || {},
};

const commands = 解析命令块('updateNpcState npc_liubian = {"姓名":"刘辩","是否在场":true,"关系状态":"惊惶"}\npushNpcMemory npc_liubian = {"内容":"在破庙遇见主角。","时间":"未知时间"}');

assert.equal(commands.length, 2);
assert.equal(commands[0].action, 'updateNpcState');
assert.equal(commands[0].key, 'npc_liubian');
assert.equal(commands[1].action, 'pushNpcMemory');
assert.equal(commands[1].key, 'npc_liubian');
assert.equal(__testAllowGeneratedCommand(commands[0]), true);
assert.equal(__testAllowGeneratedCommand(commands[1]), true);

const created = 执行响应命令处理(
  { logs: [], tavern_commands: commands },
  emptyState,
  deps,
  undefined,
  { applyState: false },
);

assert.equal(created.社交.length, 1);
assert.equal(created.社交[0].id, 'npc_liubian');
assert.equal(created.社交[0].姓名, '刘辩');
assert.equal(created.社交[0].是否在场, true);
assert.equal(created.社交[0].关系状态, '惊惶');
assert.equal(created.社交[0].记忆.length, 1);
assert.equal(created.社交[0].记忆[0].内容, '在破庙遇见主角。');

const registerCommands = 解析命令块('registerNpc npc_zhangrang = {"id":"npc_zhangrang","姓名":"张让","身份":"宦官","简介":"宫中宦官","记忆":[]}\nupdateNpcState npc_zhangrang = {"是否在场":true,"关系状态":"试探"}');

assert.equal(__testAllowGeneratedCommand(registerCommands[0]), true);
assert.equal(__testAllowGeneratedCommand(registerCommands[1]), true);

const registered = 执行响应命令处理(
  { logs: [], tavern_commands: registerCommands },
  emptyState,
  deps,
  undefined,
  { applyState: false },
);

assert.equal(registered.社交.length, 1);
assert.equal(registered.社交[0].id, 'npc_zhangrang');
assert.equal(registered.社交[0].姓名, '张让');
assert.equal(registered.社交[0].身份, '宦官');
assert.equal(registered.社交[0].关系状态, '试探');

console.log('NPC stable command regression passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'npcStableCommandRegression.entry.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const bundled = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
