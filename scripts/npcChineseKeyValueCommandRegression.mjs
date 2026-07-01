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

const commandText = [
  '登记NPC npcId=npc_liubian 姓名=刘辩 身份=少帝 简介="破庙中求助的少年皇帝" 是否在场=true 关系状态=惊惶',
  '更新NPC状态 npcId=npc_liubian 姓名=刘辩 是否在场=true 关系状态=信任',
  '添加NPC记忆 npcId=npc_liubian 内容="刘辩在破庙中向主角求助。" 时间=未知时间',
  '记录NPC互动 npcId=npc_liubian 摘要="刘辩把玉佩交给主角，请主角护送。" 时间=未知时间',
].join('\n');

const commands = 解析命令块(commandText);

assert.equal(commands.length, 4);
assert.equal(commands[0].action, 'registerNpc');
assert.equal(commands[0].npcId, 'npc_liubian');
assert.equal(commands[0].npcName, '刘辩');
assert.equal(commands[1].action, 'updateNpcState');
assert.equal(commands[1].npcId, 'npc_liubian');
assert.equal(commands[2].action, 'pushNpcMemory');
assert.equal(commands[2].npcId, 'npc_liubian');
assert.equal(commands[2].value.内容, '刘辩在破庙中向主角求助。');
assert.equal(commands[3].action, 'pushNpcMemory');
assert.equal(commands[3].value.内容, '刘辩把玉佩交给主角，请主角护送。');

for (const command of commands) {
  assert.equal(__testAllowGeneratedCommand(command), true);
}

const result = 执行响应命令处理(
  { logs: [], tavern_commands: commands },
  emptyState,
  deps,
  undefined,
  { applyState: false },
);

assert.equal(result.社交.length, 1);
assert.equal(result.社交[0].id, 'npc_liubian');
assert.equal(result.社交[0].姓名, '刘辩');
assert.equal(result.社交[0].身份, '少帝');
assert.equal(result.社交[0].简介, '破庙中求助的少年皇帝');
assert.equal(result.社交[0].是否在场, true);
assert.equal(result.社交[0].关系状态, '信任');
assert.equal(result.社交[0].记忆.length, 2);
assert.equal(result.社交[0].记忆[0].内容, '刘辩在破庙中向主角求助。');
assert.equal(result.社交[0].记忆[1].内容, '刘辩把玉佩交给主角，请主角护送。');

console.log('NPC Chinese key-value command regression passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'npcChineseKeyValueCommandRegression.entry.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const bundled = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
