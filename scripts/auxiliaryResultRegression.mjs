import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, writeFile, access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const out = 'work/regression/auxiliaryResultRegression';
await mkdir(out, {recursive: true});
const bundle = await build({
    stdin: {contents: [
        "export * from './utils/auxiliaryContext';",
        "export * from './services/ai/apiDiagnostics';",
        "export {请求模型文本} from './services/ai/chatCompletionClient';",
        "export {generatePlanningAnalysis} from './services/ai/storyTasks';",
        "export {获取激活小说拆分注入文本} from './services/novelDecompositionInjection';",
        "export {创建规划更新工作流} from './hooks/useGame/planningUpdateWorkflow';",
        "export {规范化接口设置,设置功能API档案} from './utils/apiConfig';"
    ].join('\n'), resolveDir: process.cwd(), loader: 'ts'},
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{name: 'offline-store', setup(builder) {
        builder.onResolve({filter: /novelDecompositionStore$/}, () => ({path: 'store', namespace: 'fixture'}));
        builder.onResolve({filter: /novelDecompositionCalibration$/}, () => ({path: 'calibration', namespace: 'fixture'}));
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({loader: 'js', contents: args.path === 'store'
            ? 'export const 获取当前激活小说拆分数据集=async()=>globalThis.__novel;'
                + 'export const 获取小说拆分数据集=async()=>globalThis.__novel;'
                + 'export const 读取小说拆分注入快照列表=async()=>globalThis.__snapshots||[];'
            : 'export const 规范化章节时间校准列表=()=>[];'
                + 'export const 应用剧情小说时间校准到分段=(segment)=>segment;'
                + 'export const 同步剧情小说分解时间校准=async({nextStory})=>nextStory;'}));
    }}]
});
await writeFile(out + '/bundle.mjs', bundle.outputFiles[0].text);
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)
}});
const api = await import(pathToFileURL(process.cwd() + '/' + out + '/bundle.mjs').href);
const config = {id: 'fixture', 供应商: 'openai_compatible', model: 'deepseek-v4.1-flash',
    apiKey: 'offline-only', baseUrl: 'https://offline.invalid/v1', maxTokens: 65536};
const finalAnswer = '<说明>- 更新已发生的承接</说明><命令>set 剧情规划.当前章任务[0].当前状态 = "已完成"</命令>';
let frames = [{delta: {content: finalAnswer}, finish_reason: 'stop'}];
const requests = [];
globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://offline.invalid/'), 'Real API calls are forbidden');
    requests.push(JSON.parse(init.body));
    const text = frames.map(choice => 'data: ' + JSON.stringify({choices: [choice]}) + '\n\n').join('')
        + 'data: [DONE]\n\n';
    return new Response(text, {headers: {'content-type': 'text/event-stream'}});
};
const state = {环境: {时间: '1090:03:10:15:00', 大地点: '大理', 小地点: '无量山'},
    社交: [], 世界: {待执行事件: [], 进行中事件: []},
    剧情: {当前章节: {标题: '山道调查', 当前分解组: 1}},
    剧情规划: {当前章任务: [{任务名: '调查山道', 当前状态: '进行中'}]}};
const params = {playerName: '测试', currentStoryJson: JSON.stringify({剧情: state.剧情, 剧情规划: state.剧情规划}),
    currentHeroinePlanJson: '{}', worldJson: JSON.stringify(state.世界), socialJson: '[]',
    envJson: JSON.stringify(state.环境), recentBodiesText: '调查山道已完成。', auditFocusText: '已完成任务'};
const report = {scope: 'offline evidence/output regressions; no real provider or player save'};
try {
    // A single SSE frame can carry both channels, including an empty reasoning key.
    for (const delta of [
        {reasoning_content: '内部假设 set 剧情规划.当前章任务[0].当前状态 = "失败"', content: finalAnswer},
        {reasoning_content: '', content: finalAnswer}
    ]) {
        frames = [{delta, finish_reason: 'stop'}];
        const result = await api.generatePlanningAnalysis(params, config);
        assert.equal(result.commands.length, 1);
        assert.equal(result.commands[0].value, '已完成');
        assert.equal(api.exportApiDiagnostics().calls.at(-1).result.status, 'ready');
        const sent = requests.at(-1);
        assert.equal(sent.messages.at(-1).role, 'user');
        assert.ok(!sent.messages.some(message => message.content.includes('将以<正文>')));
        assert.ok(sent.messages.reduce((n, m) => n + api.countChars(m.content), 0) <= 48000);
    }
    frames = [{delta: {reasoning_content: '最后一步思考'}, finish_reason: null},
        {delta: {reasoning_content: ''}, message: {content: finalAnswer}, finish_reason: 'stop'}];
    assert.equal((await api.generatePlanningAnalysis(params, config)).commands.length, 1);
    assert.ok(api.exportApiDiagnostics().calls.at(-1).attempts[0].contentChars > 0);

    frames = [{delta: {reasoning_content: '我可能输出：' + finalAnswer}, finish_reason: 'stop'}];
    const posts = requests.length;
    await assert.rejects(() => api.generatePlanningAnalysis(params, config), /仅返回思考/);
    assert.equal(requests.length, posts + 1, 'Do not repeat a paid response merely because it lacks a final answer');
    let logged = api.exportApiDiagnostics().calls.at(-1);
    assert.equal(logged.status, 'success', 'Transport and application outcomes are separate');
    assert.equal(logged.result.status, 'invalid-output');
    assert.equal(logged.result.reason, 'reasoning-only');
    assert.ok(api.exportApiDiagnostics().byTask.find(row => row.task === 'planning').invalidResults >= 1);
    frames = [{delta: {reasoning_content: '</think>' + finalAnswer}, finish_reason: 'stop'}];
    await assert.rejects(() => api.generatePlanningAnalysis(params, config), /仅返回思考/);
    frames = [{delta: {}, finish_reason: 'stop'}];
    await assert.rejects(() => api.generatePlanningAnalysis(params, config), /空结果/);
    assert.equal(api.exportApiDiagnostics().calls.at(-1).result.reason, 'empty-output');
    frames = [{delta: {reasoning_content: finalAnswer,
        content: '<说明>- 无需更新</说明><命令>无</命令>'}, finish_reason: 'stop'}];
    const none = await api.generatePlanningAnalysis(params, config);
    assert.equal(none.commands.length, 0, 'Commands imagined during thinking are never applied');
    assert.equal(api.exportApiDiagnostics().calls.at(-1).result.status, 'no-update');

    // Build a real sliding window with huge descriptions/metadata but complete small gates.
    const segment = (group, name) => ({id: 's' + group, 组号: group, 处理状态: '已完成', 启用注入: true,
        章节范围: '第' + group + '章', 章节标题: Array.from({length: 3000}, (_, i) => name + i),
        本组概括: '描述'.repeat(50000), 前组延续事实: ['旧线索仍待承接'],
        本组结束状态: ['找到解药才可切章'], 登场角色: ['钟灵'], 原著硬约束: [
            {内容: '不得把读者暗线当作钟灵已知', 信息可见性: {谁知道: ['反派'], 谁不知道: ['钟灵'], 是否仅读者视角可见: true}}
        ], 关键事件: [{事件名: '解药交接' + group, 事件说明: '说明'.repeat(50000),
            前置条件: ['已找到解药'], 触发条件: ['当面交付'], 阻断条件: ['毒未解'],
            事件结果: ['交接完成'], 信息可见性: {谁知道: ['反派'], 谁不知道: ['钟灵'], 是否仅读者视角可见: true}}],
        角色推进: []});
    globalThis.__novel = {id: 'novel', 注入树: [], 分段列表: [segment(1, '当前'), segment(2, '下一')]};
    const sourceBefore = JSON.stringify(globalThis.__novel);
    const feature = {小说拆分功能启用: true, 小说拆分规划分析注入: true, 小说拆分世界演变注入: true};
    const novelCounts = {};
    for (const target of ['planning', 'world_evolution']) {
        let metric;
        const text = await api.获取激活小说拆分注入文本({功能模型占位: feature}, target,
            undefined, state.剧情, undefined, value => { metric = value; });
        assert.ok(api.countChars(text) <= 4000);
        assert.ok(text.includes('【当前章节内容】') && text.includes('【下一章节内容】'));
        assert.ok(text.includes('分解组号：1') && text.includes('分解组号：2'));
        assert.ok(text.includes('不得把读者暗线当作钟灵已知'));
        assert.ok(text.includes('前置条件：已找到解药'));
        assert.ok(text.includes('触发条件：当面交付') && text.includes('阻断条件：毒未解'));
        assert.ok(text.includes('谁不知道：钟灵') && text.includes('是否仅读者视角可见：是'));
        assert.ok(text.includes('解药交接1') && text.includes('解药交接2'));
        assert.ok(metric.sourceChars > 200000 && metric.sentChars > 1000);
        novelCounts[target] = {sourceChars: metric.sourceChars, sentChars: metric.sentChars};
        frames = [{delta: {content: finalAnswer}, finish_reason: 'stop'}];
        await api.generatePlanningAnalysis({...params, extraPrompt: text}, config);
        assert.ok(requests.at(-1).messages.some(message => message.content.includes('前置条件：已找到解药')),
            'Actual wire must include useful novel evidence, not just local preprocessing counts');
    }
    assert.equal(JSON.stringify(globalThis.__novel), sourceBefore);
    const main = await api.获取激活小说拆分注入文本({功能模型占位: feature}, 'main_story', undefined, state.剧情);
    assert.ok(api.countChars(main) > 100000 && main.includes('不得把读者暗线当作钟灵已知'),
        'Main-story material policy remains independent of auxiliary budgets');
    const small = await api.获取激活小说拆分注入文本({功能模型占位: {...feature, 小说拆分详细注入上限: 500}},
        'planning', undefined, state.剧情);
    assert.ok(api.countChars(small) <= 500 && small.includes('不得把读者暗线当作钟灵已知'),
        'A small configured budget must still select a complete useful current-group record when one fits');
    // Legacy tree snapshots used to form one giant unit and collapse to a 21-character notice.
    globalThis.__novel = {id: 'novel', 注入树: [], 分段列表: []};
    const treeText = '【规划分析小说分解注入】\n• 巨型背景\n│  ' + '无关'.repeat(100000)
        + '\n• 当前组硬约束\n│  不得提前切章\n│  谁不知道：钟灵\n'
        + '├─ 关键事件\n│  前置条件：找到解药\n│  阻断条件：毒未解';
    globalThis.__snapshots = [{数据集ID: 'novel', 目标链路: 'planning', 文本: treeText}];
    const legacy = await api.获取激活小说拆分注入文本({功能模型占位: feature}, 'planning');
    assert.ok(api.countChars(legacy) <= 4000 && legacy.includes('不得提前切章'));
    assert.ok(legacy.includes('前置条件：找到解药') && legacy.includes('谁不知道：钟灵'));
    const priorPath = process.cwd() + '/work/release-auxiliary-input-2026-10-02/work/regression/auxiliaryContextRegression/bundle.mjs';
    let priorAvailable = false;
    try { await access(priorPath); priorAvailable = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (priorAvailable) {
        const prior = await import(pathToFileURL(priorPath).href);
        report.legacyBeforeChars = prior.countChars(prior.budgetTextRecords(treeText, 4000));
        assert.equal(report.legacyBeforeChars, 21, 'Reproduce v1.1.1 giant-tree omission');
    }

    // Exercise the real planning workflow and state command applier; save only to a mock object.
    globalThis.__novel = undefined; globalThis.__snapshots = [];
    let settings = api.规范化接口设置({activeConfigId: 'fixture', configs: [config]});
    settings = api.设置功能API档案(settings, '规划分析', 'fixture');
    settings.功能模型占位.规划分析独立模型开关 = true;
    const clone = value => value === undefined ? undefined : structuredClone(value);
    const deps = {apiConfig: settings, gameConfig: {启用女主剧情规划: false}, 角色: {姓名: '测试'},
        环境: clone(state.环境), 世界: clone(state.世界), 战斗: {}, 玩家门派: {}, 任务列表: [], 约定列表: [],
        历史记录: [], prompts: [], worldbooks: [], 深拷贝: clone,
        收集最近完整正文回合: () => [{}], 构建最近完整正文上下文: () => params.recentBodiesText,
        去重文本数组: rows => [...new Set(rows)], 提取响应完整正文文本: () => params.recentBodiesText,
        performAutoSave: async snapshot => { deps.saved = clone(snapshot); }};
    for (const name of ['规范化环境信息','规范化社交列表','规范化世界状态','规范化战斗状态','规范化门派状态',
        '规范化剧情状态','规范化剧情规划状态','规范化女主剧情规划状态','规范化同人剧情规划状态','规范化同人女主剧情规划状态'])
        deps[name] = clone;
    for (const name of ['收集女主规划时间触发原因','收集女主正文命中原因','收集剧情规划时间触发原因','收集剧情正文命中原因'])
        deps[name] = () => [];
    for (const name of ['设置剧情','设置剧情规划','设置女主剧情规划','设置同人剧情规划','设置同人女主剧情规划'])
        deps[name] = value => { deps[name + '结果'] = clone(value); };
    const workflow = api.创建规划更新工作流(deps);
    frames = [{delta: {content: finalAnswer}, finish_reason: 'stop'}];
    const args = {state: clone(state), playerInput: '调查山道', gameTime: '1090:03:10:15:00', response: {logs: []}};
    const updated = await workflow.后台执行统一规划分析(args);
    assert.equal(updated.updated, true);
    assert.equal(deps.设置剧情规划结果.当前章任务[0].当前状态, '已完成');
    assert.equal(deps.saved.storyPlan.当前章任务[0].当前状态, '已完成');
    logged = api.exportApiDiagnostics().calls.at(-1);
    assert.equal(logged.result.status, 'applied');
    assert.equal(logged.result.parsedCommands, 1);
    assert.equal(logged.result.appliedCommands, 1);
    const appliedBefore = JSON.stringify(deps.saved);
    frames = [{delta: {reasoning_content: finalAnswer}, finish_reason: 'stop'}];
    await assert.rejects(() => workflow.后台执行统一规划分析(args), /仅返回思考/);
    assert.equal(JSON.stringify(deps.saved), appliedBefore, 'A reasoning-only result must not write state or saves');
    assert.equal(JSON.stringify(args.state), JSON.stringify(state), 'Canonical input state is unchanged');
    report.novel = novelCounts;
    report.legacySnapshotChars = api.countChars(legacy);
    report.appliedCommands = logged.result.appliedCommands;
    report.reasoningOnlyRejected = true;
    assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('钟灵'));
    await writeFile(out + '/REPORT.json', JSON.stringify(report, null, 2) + '\n');
    console.log('Auxiliary result regression passed: real bounded novel evidence, legacy tree, same-frame SSE, final/no-update/invalid results, actual planning patch/save and private diagnostics.');
    console.log(JSON.stringify(report));
} finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else delete globalThis.localStorage;
    delete globalThis.__novel; delete globalThis.__snapshots;
}
