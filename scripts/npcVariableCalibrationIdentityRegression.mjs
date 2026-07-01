import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import { __testParseVariableCalibrationResponse } from './services/ai/storyTasks.ts';
import { __testAllowGeneratedCommand } from './hooks/useGame/variableModelWorkflow.ts';
import { 执行响应命令处理 } from './hooks/useGame/responseCommandProcessor.ts';

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

const rawText = [
  '<命令>',
  '{"action":"registerNpc","npcId":"npc_wuzhi","npcName":"武植","value":{"姓名":"武植","身份":"炊饼小贩","是否在场":true,"关系状态":"街坊/敬畏","记忆":[{"内容":"初到清河县紫石街卖炊饼，遇到方小腊。","时间":"1110:09:01:06:30"}]}}',
  '{"action":"pushNpcMemory","npcId":"npc_wuzhi","npcName":"武植","value":{"内容":"方小腊坚持付钱买炊饼，令武植感激敬畏。","时间":"1110:09:01:06:45"}}',
  '{"action":"updateNpcState","npcId":"npc_wuzhi","npcName":"武植","value":{"好感度":35,"关系状态":"极度感激/敬畏","是否在场":true}}',
  '</命令>',
].join('\n');

const parsed = __testParseVariableCalibrationResponse(rawText);

assert.equal(parsed.commands.length, 3);
assert.equal(parsed.commands[0].action, 'registerNpc');
assert.equal(parsed.commands[0].npcId, 'npc_wuzhi');
assert.equal(parsed.commands[0].npcName, '武植');
assert.equal(parsed.commands[1].action, 'pushNpcMemory');
assert.equal(parsed.commands[1].npcId, 'npc_wuzhi');
assert.equal(parsed.commands[1].npcName, '武植');
assert.equal(parsed.commands[2].action, 'updateNpcState');
assert.equal(parsed.commands[2].npcId, 'npc_wuzhi');
assert.equal(parsed.commands[2].npcName, '武植');

for (const command of parsed.commands) {
  assert.equal(__testAllowGeneratedCommand(command), true);
}

const result = 执行响应命令处理(
  { logs: [], tavern_commands: parsed.commands },
  emptyState,
  deps,
  undefined,
  { applyState: false },
);

assert.equal(result.社交.length, 1);
assert.equal(result.社交[0].id, 'npc_wuzhi');
assert.equal(result.社交[0].姓名, '武植');
assert.equal(result.社交[0].关系状态, '极度感激/敬畏');
assert.equal(result.社交[0].记忆.length, 2);
assert.equal(result.社交[0].记忆[1].内容, '方小腊坚持付钱买炊饼，令武植感激敬畏。');

console.log('NPC variable calibration identity regression passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'npcVariableCalibrationIdentityRegression.entry.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const bundled = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
