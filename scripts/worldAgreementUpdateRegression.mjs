import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const out = 'work/regression/worldAgreementUpdateRegression';
await mkdir(out, {recursive: true});
const bundle = await build({
    stdin: {contents: [
        "export * from './utils/auxiliaryContext';",
        "export * from './services/ai/apiDiagnostics';",
        "export {generateWorldEvolutionUpdate,generateVariableCalibrationUpdate} from './services/ai/storyTasks';",
        "export {执行变量模型校准工作流} from './hooks/useGame/variableModelWorkflow';",
        "export {执行世界演变更新工作流} from './hooks/useGame/worldEvolutionWorkflow';",
        "export {执行响应命令处理} from './hooks/useGame/responseCommandProcessor';",
        "export {按世界演变分流净化响应} from './hooks/useGame/storyResponseGuards';",
        "export {规范化接口设置,设置功能API档案} from './utils/apiConfig';"
    ].join('\n'), resolveDir: process.cwd(), loader: 'ts'},
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{name: 'offline-data', setup(builder) {
        builder.onResolve({filter: /novelDecompositionStore$/}, () => ({path: 'store', namespace: 'fixture'}));
        builder.onResolve({filter: /novelDecompositionCalibration$/}, () => ({path: 'calibration', namespace: 'fixture'}));
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({loader: 'js', contents: args.path === 'store'
            ? 'export const 获取当前激活小说拆分数据集=async()=>undefined;export const 获取小说拆分数据集=async()=>undefined;export const 读取小说拆分注入快照列表=async()=>[];'
            : 'export const 规范化章节时间校准列表=()=>[];export const 应用剧情小说时间校准到分段=s=>s;export const 同步剧情小说分解时间校准=async({nextStory})=>nextStory;'}));
    }}]
});
await writeFile(out + '/bundle.mjs', bundle.outputFiles[0].text);
const savedFetch = globalThis.fetch;
const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)
}});
const api = await import(pathToFileURL(process.cwd() + '/' + out + '/bundle.mjs').href);
const clone = value => value === undefined ? undefined : structuredClone(value);
const config = {id: 'offline', 供应商: 'openai_compatible', model: 'offline-model',
    apiKey: 'offline-only', baseUrl: 'https://offline.invalid/v1', maxTokens: 65536};
let settings = api.规范化接口设置({activeConfigId: config.id, configs: [config]});
for (const feature of ['变量计算', '世界演变']) settings = api.设置功能API档案(settings, feature, config.id);
settings.功能模型占位.变量计算独立模型开关 = true;
settings.功能模型占位.世界演变独立模型开关 = true;
const state = {角色: {}, 环境: {时间: '1090:03:10:15:00'}, 社交: [], 世界: {进行中事件: []},
    战斗: {}, 玩家门派: {}, 任务列表: [], 约定列表: Array.from({length: 33}, (_, i) =>
        ({约定名: '既有约定' + i, 当前状态: '等待中', 内容: '已订立，未来履行'})), 剧情: {}, 剧情规划: {}};
const captured = {};
const processor = {};
for (const name of ['规范化环境信息','规范化社交列表','规范化世界状态','规范化战斗状态','规范化门派状态',
    '规范化剧情状态','规范化剧情规划状态','规范化女主剧情规划状态','规范化同人剧情规划状态',
    '规范化同人女主剧情规划状态','规范化角色物品容器映射','战斗结束自动清空']) processor[name] = clone;
processor.设置世界 = value => { captured.world = clone(value); };
processor.设置约定列表 = value => { captured.agreements = clone(value); };
const requests = [];
const reply = (delta, finish = 'stop') => {
    globalThis.fetch = async (url, init) => {
        assert.ok(String(url).startsWith('https://offline.invalid/'), 'No real provider calls');
        requests.push(JSON.parse(init.body));
        return new Response('data: ' + JSON.stringify({choices: [{delta, finish_reason: finish}]})
            + '\n\ndata: [DONE]\n\n', {headers: {'content-type': 'text/event-stream'}});
    };
};
try {
    const before = JSON.stringify(state);
    const final = '<说明>- 已赴约，并订立新的会面约定</说明><命令>set 约定列表[32].当前状态 = "已履行"\n'
        + 'push 约定列表 = {"约定名":"明日会合","当前状态":"等待中","内容":"双方已约定明日会合"}</命令>';
    reply({content: final});
    const result = await api.执行变量模型校准工作流({playerInput: '赴约并约定明日再见',
        parsedResponse: {logs: [{sender: '旁白', text: '双方完成约定并约定明日会合。'}], tavern_commands: []},
        baseState: clone(state), promptPool: [], worldEvolutionEnabled: true, onStreamDelta: () => {}},
        {apiConfig: settings, gameConfig: {}});
    assert.equal(result.commands.length, 2);
    const wire = requests.at(-1).messages.map(m => m.content).join('\n');
    assert.ok(wire.includes('既有约定32'), 'Newest agreements beyond index 29 must reach the model');
    assert.ok(wire.includes('双方已明确订立'));
    let metric = api.exportApiDiagnostics().calls.at(-1).result;
    assert.equal(metric.parsedAgreementCommands, 2);
    assert.equal(metric.acceptedAgreementCommands, 2);
    assert.equal(metric.appliedAgreementCommands, 0);
    const simulated = api.执行响应命令处理({logs: [], tavern_commands: result.commands}, state, processor,
        undefined, {applyState: false});
    assert.equal(captured.agreements, undefined);
    assert.equal(simulated.约定列表[32].当前状态, '已履行');
    const applied = api.执行响应命令处理({logs: [], tavern_commands: result.commands}, state, processor);
    assert.equal(captured.agreements.length, 34);
    assert.equal(captured.agreements[0].当前状态, '等待中');
    assert.equal(captured.agreements[32].当前状态, '已履行');
    assert.equal(captured.agreements[33].当前状态, '等待中');
    assert.deepEqual(clone({agreements: applied.约定列表}).agreements, captured.agreements);

    const old = {事件名: '旧事件', 已成立事实: Array.from({length: 12}, (_, i) => '旧事实' + i + '保持事实'.repeat(40))};
    const view = api.projectAuxiliaryState({世界: {进行中事件: [old]}}, {name: 'world', root: '', maxChars: 2600});
    assert.ok(view.incomplete.length > 0);
    const event = {事件名: '山门会合', 当前进展: '双方已抵达'};
    const worldFinal = '<说明>- 山门会合已经发生</说明><命令>push 世界.进行中事件 = ' + JSON.stringify(event) + '</命令>';
    reply({content: worldFinal});
    const world = await api.generateWorldEvolutionUpdate(view.text, config, undefined, undefined, undefined,
        undefined, false, false, {views: [view], metrics: []});
    assert.equal(world.commands.length, 1, 'Appending a world event must survive excerpted older facts');
    assert.equal(api.filterTaskViewCommands([{action: 'push', key: '世界.进行中事件', value: old}], [view]).length, 0);
    const split = api.按世界演变分流净化响应({logs: [], tavern_commands: [
        {action: 'set', key: '世界.进行中事件[0].当前进展', value: '双方已在山门会合'}]}, true);
    assert.equal(split.response.tavern_commands.length, 0);
    assert.equal(split.appendedDynamicHints.length, 1);
    const deps = {apiSettings: settings, gameConfig: {}, 角色: {}, 环境: state.环境, 世界: state.世界,
        剧情: {}, 记忆系统: {}, 历史记录: [], prompts: [], worldbooks: [],
        世界演变进行中Ref: {current: false}, 世界演变去重签名Ref: {current: ''},
        已进入主剧情回合: () => true, 按回合窗口裁剪历史: h => h,
        规范化环境信息: clone, 规范化世界状态: clone, 规范化剧情状态: clone,
        processResponseCommands: (response, base, options) => api.执行响应命令处理(response, state, processor, base, options)};
    for (const name of ['setWorldEvents','set世界演变更新中','set世界演变状态文本','set世界演变最近更新时间',
        'set世界演变最近摘要','set世界演变最近原始消息','追加系统消息']) deps[name] = () => {};
    delete captured.world;
    for (const applyCommands of [false, true]) {
        reply({content: worldFinal});
        const updated = await api.执行世界演变更新工作流({force: true, 来源: 'story_dynamic', applyCommands,
            stateBase: clone(state), currentResponse: {logs: [{sender: '旁白', text: '山门会合已经发生'}]},
            动态世界线索: split.appendedDynamicHints}, deps);
        assert.equal(updated.ok, true, updated.statusText);
        assert.equal(updated.commands.length, 1);
        assert.ok(requests.at(-1).messages.some(m => m.content.includes(split.appendedDynamicHints[0])));
        metric = api.exportApiDiagnostics().calls.at(-1).result;
        assert.equal(metric.status, applyCommands ? 'applied' : 'ready');
        assert.equal(metric.appliedCommands, applyCommands ? 1 : 0);
        assert.equal(captured.world?.进行中事件.length, applyCommands ? 1 : undefined);
    }
    for (const task of ['world', 'variable']) {
        const run = () => task === 'world' ? api.generateWorldEvolutionUpdate('{}', config)
            : api.generateVariableCalibrationUpdate({stateJson: '{}', response: {logs: []}}, config,
                undefined, undefined, () => {});
        reply({reasoning_content: task === 'world' ? worldFinal : final});
        await assert.rejects(run, /缺少最终回答/);
        assert.equal(api.exportApiDiagnostics().calls.at(-1).result.reason, 'reasoning-only');
        reply({content: task === 'world' ? worldFinal : final}, 'length');
        await assert.rejects(run, /截断|上限|不完整/);
        reply({reasoning_content: '分析已发生事实', content: task === 'world' ? worldFinal : final});
        assert.ok((await run()).commands.length > 0, 'Same-frame reasoning and content must preserve final commands');
    }
    assert.equal(JSON.stringify(state), before);
    const diagnostics = JSON.stringify(api.exportApiDiagnostics());
    for (const privateText of ['既有约定32','山门会合','offline-only']) assert.ok(!diagnostics.includes(privateText));
    console.log('World/agreement update regression passed: full agreement indices, future promises, state setters, world append guards, forwarded clues, preview/application counts, reasoning-only/truncated rejection and private diagnostics.');
} finally {
    globalThis.fetch = savedFetch;
    if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage); else delete globalThis.localStorage;
}
