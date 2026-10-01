import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { strFromU8, unzipSync } from 'fflate';

const sourceImages = new Map([
    ['wuxia-asset://scene', 'data:image/png;base64,AA=='],
    ['wuxia-asset://portrait', 'data:image/png;base64,AQ==']
]);
const restoredImages = new Map();
globalThis.__avgSaveFixture = {
    saves: [{
        类型: '手动', 时间戳: 1, 角色数据: { 姓名: '测试' },
        历史记录: [{ role: 'assistant', content: '', timestamp: 1, structuredResponse: {
            logs: [{ sender: '林姑娘', text: '走吧。' }],
            avgPresentation: { schemaVersion: 1, mode: 'final', scenes: [
                { ref: 's1', placeKey: '江南/客栈', label: '客栈', profile: { 空间: '客栈大堂' }, image: 'wuxia-asset://scene', reason: 'selected' },
                { ref: 's2', placeKey: '江南/渡口', label: '渡口', profile: { 空间: '渡口' }, assetId: 'wuxia_fixture@1.0.0:huashan_test', image: 'avgpack://wuxia_fixture@1.0.0/scenes/huashan.webp', reason: 'preset' }
            ] },
            avgPortraitBindings: { 林姑娘: { npcId: 'npc-1', assetId: 'archive:1', image: 'wuxia-asset://portrait', reason: 'selected-archive' } }
        } }]
    }],
    sourceImages,
    restoredImages
};

const result = await build({
    entryPoints: ['services/saveArchiveService.ts'],
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{
        name: 'mock-save-database',
        setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^\.\/dbService$/ }, () => ({ path: 'dbService', namespace: 'fixture' }));
            pluginBuild.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
                contents: `
                    export const 导出存档数据 = async () => ({ version: 1, exportedAt: '', saves: globalThis.__avgSaveFixture.saves });
                    export const 读取图片资源 = async ref => globalThis.__avgSaveFixture.sourceImages.get(ref) || '';
                    export const 保存图片资源 = async dataUrl => {
                        const ref = 'wuxia-asset://restored-' + (globalThis.__avgSaveFixture.restoredImages.size + 1);
                        globalThis.__avgSaveFixture.restoredImages.set(ref, dataUrl);
                        return ref;
                    };
                `,
                loader: 'js'
            }));
        }
    }]
});
const { 导出ZIP存档文件, 解析ZIP存档文件 } = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);

const zip = await 导出ZIP存档文件();
const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
const manifest = JSON.parse(strFromU8(entries['manifest.json']));
const item = manifest.saves[0];
assert.equal(item.图片文件数, 2);
const exportedHistory = JSON.parse(strFromU8(entries[item.聊天记录文件])).records[0].structuredResponse;
assert.ok(exportedHistory.avgPresentation.scenes[0].image.startsWith('图片/'));
assert.equal(exportedHistory.avgPresentation.scenes[1].image, 'avgpack://wuxia_fixture@1.0.0/scenes/huashan.webp');
assert.ok(exportedHistory.avgPortraitBindings.林姑娘.image.startsWith('图片/'));
assert.equal(globalThis.__avgSaveFixture.saves[0].历史记录[0].structuredResponse.avgPresentation.scenes[0].image, 'wuxia-asset://scene');

const imported = await 解析ZIP存档文件(zip);
const response = imported.saves[0].历史记录[0].structuredResponse;
assert.equal(response.avgPresentation.scenes[0].placeKey, '江南/客栈');
assert.equal(response.avgPresentation.scenes[1].image, 'avgpack://wuxia_fixture@1.0.0/scenes/huashan.webp');
assert.equal(response.avgPresentation.scenes[1].assetId, 'wuxia_fixture@1.0.0:huashan_test');
assert.equal(response.avgPortraitBindings.林姑娘.npcId, 'npc-1');
assert.equal(restoredImages.get(response.avgPresentation.scenes[0].image), sourceImages.get('wuxia-asset://scene'));
assert.equal(restoredImages.get(response.avgPortraitBindings.林姑娘.image), sourceImages.get('wuxia-asset://portrait'));
console.log('AVG ZIP save roundtrip passed');
