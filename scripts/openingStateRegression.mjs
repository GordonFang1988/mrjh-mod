import assert from 'node:assert/strict';
import { normalizeBodyPartVitals } from '../utils/characterVitals.ts';

assert.deepEqual(
  normalizeBodyPartVitals(0, 30, '正常'),
  { current: 30, max: 30, status: '正常' },
);

assert.deepEqual(
  normalizeBodyPartVitals(0, 30, ''),
  { current: 30, max: 30, status: '正常' },
);

assert.deepEqual(
  normalizeBodyPartVitals(0, 30, '重伤'),
  { current: 0, max: 30, status: '重伤' },
);

assert.deepEqual(
  normalizeBodyPartVitals(45, 30, '正常'),
  { current: 30, max: 30, status: '正常' },
);

assert.deepEqual(
  normalizeBodyPartVitals(12, 30, '受伤'),
  { current: 12, max: 30, status: '受伤' },
);

console.log('Opening state regression passed');
