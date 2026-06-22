import assert from 'node:assert/strict';
import {
  filterUnsafeNpcCommands,
  isDangerousIndexedSocialWrite,
  isInvalidSocialNpcRecord,
} from '../utils/npcCommandSafety.ts';

const dangerousCommands = [
  { action: 'set', key: '社交[7].是否在场', value: true },
  { action: 'set', key: 'gameState.社交[9].好感度', value: 20 },
  { action: 'set', key: '社交[3].关系状态', value: '友善' },
  { action: 'push', key: '社交[4].记忆', value: { 内容: '错位记忆', 时间: '未知时间' } },
  { action: 'set', key: '社交[2].最近互动', value: '同游' },
  { action: 'push', key: '社交[5].关系记忆', value: '曾救援' },
];

for (const command of dangerousCommands) {
  assert.equal(
    isDangerousIndexedSocialWrite(command),
    true,
    `${command.key} should be blocked`,
  );
}

assert.equal(
  isDangerousIndexedSocialWrite({
    action: 'pushNpcMemory',
    key: '',
    npcId: 'npc_zhangrang',
    value: { 内容: '稳定写入', 时间: '未知时间' },
  }),
  false,
);

assert.equal(
  isDangerousIndexedSocialWrite({
    action: 'push',
    key: '社交',
    value: { id: 'npc_zhangrang', 姓名: '张让', 身份: '宦官' },
  }),
  false,
);

assert.equal(
  isDangerousIndexedSocialWrite({
    action: 'updateNpcState',
    key: '',
    npcId: 'npc_zhangrang',
    value: { 是否在场: true, 关系状态: '戒备' },
  }),
  false,
);

assert.equal(
  isDangerousIndexedSocialWrite({
    action: 'registerNpc',
    key: '',
    npcId: 'npc_liubian',
    npcName: '刘辩',
    value: { id: 'npc_liubian', 姓名: '刘辩', 身份: '少帝' },
  }),
  false,
);

const filtered = filterUnsafeNpcCommands([
  { action: 'set', key: '角色.姓名', value: '弦月' },
  { action: 'set', key: '社交[8].是否在场', value: true },
  { action: 'pushNpcMemory', key: '', npcId: 'npc_liubian', value: { 内容: '自身经历', 时间: '未知时间' } },
  { action: 'updateNpcState', key: '', npcId: 'npc_liubian', value: { 是否在场: true } },
]);

assert.deepEqual(
  filtered,
  [
    { action: 'set', key: '角色.姓名', value: '弦月' },
    { action: 'pushNpcMemory', key: '', npcId: 'npc_liubian', value: { 内容: '自身经历', 时间: '未知时间' } },
    { action: 'updateNpcState', key: '', npcId: 'npc_liubian', value: { 是否在场: true } },
  ],
);

assert.equal(isInvalidSocialNpcRecord({}), true);
assert.equal(isInvalidSocialNpcRecord({ 是否在场: true }), true);
assert.equal(
  isInvalidSocialNpcRecord({
    id: 'npc_7',
    姓名: '角色7',
    身份: '未知身份',
    简介: '暂无简介',
    记忆: [],
    是否在场: true,
    好感度: 0,
    关系状态: '未知',
  }),
  true,
);

assert.equal(isInvalidSocialNpcRecord({ id: 'npc_zhangrang', 姓名: '张让' }), false);
assert.equal(isInvalidSocialNpcRecord({ 姓名: '少帝刘辩', 身份: '皇帝' }), false);

console.log('NPC command safety regression passed');
