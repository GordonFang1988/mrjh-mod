import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../components/features/Chat/MessageRenderers.tsx', import.meta.url), 'utf8');
const visualSettings = await readFile(new URL('../utils/visualSettings.ts', import.meta.url), 'utf8');

assert.equal(renderer.includes('bg-[#fcfaf7]'), false, 'dialogue bubble must not use the near-white background');
assert.equal((renderer.match(/bg-\[#1c1c19\]/g) || []).length, 2, 'bubble and pointer must share the warm ink background');
assert.match(renderer, /border-wuxia-gold\/15/, 'dialogue bubble should retain a restrained edge against the story background');
assert.match(visualSettings, /角色对话: \{[^\n]*字体颜色: '#dedbd2'/, 'dialogue default text should be readable on the dark bubble');
assert.match(visualSettings, /角色对话: '#dedbd2'/, 'theme-linked dialogue text should be readable on the dark bubble');

console.log('dialogue bubble theme regression passed');
