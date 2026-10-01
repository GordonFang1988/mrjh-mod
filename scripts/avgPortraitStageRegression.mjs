import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../components/features/AVG/portraitStage.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { portraitStageForStep } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const steps = [
  { sender: '旁白', text: '客栈里有人等候。', avgSceneRef: 's1' },
  { sender: '甲', text: '来了。', avgSceneRef: 's1' },
  { sender: '旁白', text: '她望向门口。', avgSceneRef: 's1' },
  { sender: '乙', text: '请进。', avgSceneRef: 's1' },
  { sender: '旁白', text: '甲的立绘不再显示。', avgSceneRef: 's1' },
  { sender: '旁白', text: '来到竹林。', avgSceneRef: 's2' },
  { sender: '甲', text: '小心。', avgSceneRef: 's2' },
  { sender: '【判定】', text: '通过。', avgSceneRef: 's2' },
  { sender: '旁白', text: '返回客栈。', avgSceneRef: 's1' }
];

assert.deepEqual(steps.map((_, index) => portraitStageForStep(steps, index, true)), [
  null,
  { sender: '甲', mode: 'active' },
  { sender: '甲', mode: 'receded' },
  { sender: '乙', mode: 'active' },
  { sender: '乙', mode: 'receded' },
  null,
  { sender: '甲', mode: 'active' },
  { sender: '甲', mode: 'receded' },
  null
]);
assert.deepEqual(portraitStageForStep(steps, 5, false), { sender: '乙', mode: 'receded' });
assert.deepEqual(portraitStageForStep([{ sender: '防御大师', text: '开口。' }], 0, true),
  { sender: '防御大师', mode: 'active' });
assert.equal(portraitStageForStep([], 0, true), null);
console.log('AVG portrait speaker, narration, replacement, and scene boundary: passed');
