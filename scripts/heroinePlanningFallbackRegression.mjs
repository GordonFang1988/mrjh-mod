import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import {
  获取规划分析接口配置,
  获取规划分析接口配置或主剧情回退,
  接口配置是否可用,
} from './utils/apiConfig.ts';
import { 开局配置启用同人运行时 } from './prompts/runtime/fandom.ts';

const baseSettings = {
  activeConfigId: 'main',
  configs: [
    {
      id: 'main',
      名称: '主接口',
      供应商: 'openai_compatible',
      协议覆盖: 'auto',
      baseUrl: 'https://example.test/v1',
      apiKey: 'test-key',
      model: 'main-model',
      createdAt: 1,
      updatedAt: 1,
    },
  ],
  功能模型占位: {
    主剧情使用模型: '',
    规划分析独立模型开关: false,
    剧情规划独立模型开关: false,
    女主规划独立模型开关: false,
    规划分析使用模型: '',
    剧情规划使用模型: '',
    女主规划使用模型: '',
    规划分析API地址: '',
    剧情规划API地址: '',
    女主规划API地址: '',
    规划分析API密钥: '',
    剧情规划API密钥: '',
    女主规划API密钥: '',
  },
};

assert.equal(获取规划分析接口配置(baseSettings), null);

const fallback = 获取规划分析接口配置或主剧情回退(baseSettings);
assert.equal(接口配置是否可用(fallback), true);
assert.equal(fallback.model, 'main-model');

const dedicated = 获取规划分析接口配置或主剧情回退({
  ...baseSettings,
  功能模型占位: {
    ...baseSettings.功能模型占位,
    规划分析独立模型开关: true,
    规划分析使用模型: 'planner-model',
  },
});
assert.equal(接口配置是否可用(dedicated), true);
assert.equal(dedicated.model, 'planner-model');

const featureMainFallback = 获取规划分析接口配置或主剧情回退({
  ...baseSettings,
  configs: [{ ...baseSettings.configs[0], model: '' }],
  功能模型占位: {
    ...baseSettings.功能模型占位,
    主剧情使用模型: 'feature-main-model',
  },
});
assert.equal(接口配置是否可用(featureMainFallback), true);
assert.equal(featureMainFallback.model, 'feature-main-model');

assert.equal(开局配置启用同人运行时({
  同人融合: {
    enabled: true,
    作品名: '水浒传/金瓶梅',
    启用附加小说: false,
  },
}), true);
assert.equal(开局配置启用同人运行时({
  同人融合: {
    enabled: true,
    作品名: '   ',
    启用附加小说: true,
  },
}), false);

console.log('Heroine planning fallback regression passed');
`;

const result = await build({
  stdin: {
    contents: source,
    loader: 'ts',
    resolveDir: process.cwd(),
    sourcefile: 'heroinePlanningFallbackRegression.entry.ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});

const bundled = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`);
