import {build} from 'esbuild';
import {mkdir, writeFile, access} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const out = 'work/regression/auxiliaryContextRegression';
await mkdir(out, {recursive: true});
const built = await build({
    stdin: {contents: [
        "export * from './utils/auxiliaryContext';",
        "export { applyStateCommand } from './utils/stateHelpers';",
        "export { 规范化接口设置, 设置功能API档案 } from './utils/apiConfig';",
        "export { 执行剧情回忆检索 } from './hooks/useGame/recallWorkflow';",
        "export { 构建世界演变上下文文本 } from './hooks/useGame/worldEvolutionUtils';",
        "export { 构建剧情回忆检索上下文, 预筛剧情回忆候选, 根据检索结果构建剧情回忆标签 } from './hooks/useGame/memoryRecall';",
        "export { generatePlanningAnalysis, generateWorldEvolutionUpdate, generateMemoryRecall } from './services/ai/storyTasks';",
        "export { exportApiDiagnostics } from './services/ai/apiDiagnostics';",
        "export { 构建世界书注入文本 } from './utils/worldbook';",
        "export { 获取激活小说拆分注入文本 } from './services/novelDecompositionInjection';",
        "export { 构建世界演变COT提示词 } from './prompts/runtime/worldEvolutionCot';"
    ].join('\n'), loader: 'ts', resolveDir: process.cwd()},
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{name: 'mock-novel-store', setup(build) {
        build.onResolve({filter: /novelDecompositionStore$/}, () => ({path: 'fixture-store', namespace: 'offline'}));
        build.onLoad({filter: /.*/, namespace: 'offline'}, () => ({loader: 'js', contents: [
            "export const 获取当前激活小说拆分数据集 = async () => globalThis.__auxiliaryNovel;",
            "export const 获取小说拆分数据集 = async () => globalThis.__auxiliaryNovel;",
            "export const 读取小说拆分注入快照列表 = async () => globalThis.__auxiliarySnapshots || [];"
        ].join('\n')}));
    }}]
});
await writeFile(out + '/bundle.mjs', built.outputFiles[0].text);
const savedFetch = globalThis.fetch;
const savedStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {
    getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value)
}});
const api = await import(pathToFileURL(process.cwd() + '/' + out + '/bundle.mjs').href);
const config = {id: 'offline', 供应商: 'openai_compatible', model: 'offline-model',
    baseUrl: 'https://offline.invalid/v1', apiKey: 'offline-only-no-real-credential', maxTokens: 65536};
const captures = [];
let reply = '<说明>- 无需更新</说明><命令>无</命令>', finishReason = 'stop';
globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://offline.invalid/'), 'No real API is permitted');
    const body = JSON.parse(init.body);
    captures.push(body);
    const payload = {choices: [{delta: {content: reply}, finish_reason: finishReason}]};
    return new Response('data: ' + JSON.stringify(payload) + '\n\ndata: [DONE]\n\n',
        {headers: {'content-type': 'text/event-stream'}});
};
const wireChars = body => body.messages.reduce((sum, m) => sum + api.countChars(m.content), 0);
const cmd = (key, value, action = 'set') => ({key, value, action});
const report = {scope: 'offline synthetic input characters, not tokens or provider latency', cases: {}};
try {
    const memory = {回忆档案: Array.from({length: 1000}, (_, i) => ({
        名称: '【回忆' + String(i + 1).padStart(3, '0') + '】', 回合: i + 1,
        原文: '原'.repeat(1500), 概括: '摘要' + i + '概'.repeat(100)
    }))};
    const beforeMemory = JSON.stringify(memory);
    let recallMetric;
    const candidates = api.预筛剧情回忆候选('询问甲', memory, 20);
    const corpus = api.构建剧情回忆检索上下文(memory, 20, {
        candidateIds: candidates.map(c => c.id), query: '询问甲', onMetric: m => recallMetric = m
    });
    assert.ok(candidates.length <= 24);
    assert.ok(api.countChars(corpus) <= 10000);
    assert.ok(!corpus.includes('摘要0概'));
    assert.equal(corpus.includes('原文：\n'), false);
    assert.equal(recallMetric.sourceItems, 1000);
    assert.ok(recallMetric.sentItems <= 24);
    assert.equal(JSON.stringify(memory), beforeMemory);
    const one = api.构建剧情回忆检索上下文(memory, 20, {candidateIds: ['【回忆099】']});
    assert.ok(one.includes('【回忆099】') && !one.includes('【回忆100】'));
    const empty = api.构建剧情回忆检索上下文(memory, 20, {candidateIds: []});
    assert.ok(!empty.includes('【回忆001】'));
    const oldClue = structuredClone(memory);
    oldClue.回忆档案[2].概括 = '钟灵托付解药给无量山山洞中的被困者，旧承诺仍未兑现';
    oldClue.回忆档案[2].原文 = oldClue.回忆档案[2].概括;
    assert.ok(api.预筛剧情回忆候选('去无量山山洞送钟灵的解药', oldClue, 20).some(c => c.id === '【回忆003】'));
    oldClue.回忆档案[2].概括 = '旧承诺';
    oldClue.回忆档案[2].原文 = '很长的旧正文'.repeat(1000) + '钟灵的解药藏在无量山山洞中';
    const lateClue = api.构建剧情回忆检索上下文(oldClue, 20, {candidateIds: ['【回忆003】'], query: '钟灵的解药在哪里'});
    assert.ok(lateClue.includes('钟灵的解药'), 'An unpunctuated old clue near the end must survive excerpting');
    const tag = api.根据检索结果构建剧情回忆标签(memory, {
        strongIds: memory.回忆档案.slice(-50).map(item => item.名称).concat('【回忆99999】'),
        weakIds: memory.回忆档案.slice(0, 50).map(item => item.名称)
    }, {query: '询问甲'});
    assert.ok(api.countChars(tag) <= 16000);
    assert.equal(tag.includes('【回忆99999】'), false);
    assert.equal((tag.match(/【回忆\d+】/g) || []).length, 11);
    await api.generateMemoryRecall('只输出两个编号列表', '【玩家输入】询问甲\n【回忆库】\n' + corpus, config, undefined,
        {stream: true}, undefined, undefined, [recallMetric]);
    assert.ok(wireChars(captures.at(-1)) <= 14000);
    assert.equal(captures.at(-1).max_tokens, 4096);
    report.cases.recall = {archives: 1000, candidates: candidates.length, corpusChars: api.countChars(corpus),
        oldCorpusChars: 149260, wireChars: wireChars(captures.at(-1)), metric: recallMetric};
    const recallSettings = api.设置功能API档案(api.规范化接口设置({
        activeConfigId: config.id, configs: [{...config, 名称: 'offline', createdAt: 1, updatedAt: 1}],
        功能模型占位: {剧情回忆独立模型开关: true}
    }), '剧情回忆', config.id);
    reply = '强回忆:无\n弱回忆:无'.replace(/\\n/g, '\n');
    const noRecall = await api.执行剧情回忆检索('询问甲', memory, recallSettings, {onDelta: () => {}});
    assert.equal(noRecall.previewText, '强回忆:无\n弱回忆:无'.replace(/\\n/g, '\n'));
    const bulkyMemory = structuredClone(memory);
    bulkyMemory.回忆档案.forEach(item => { item.概括 = '概'.repeat(1000); });
    reply = '强回忆:【回忆981】\n弱回忆:无'.replace(/\\n/g, '\n');
    const notSent = await api.执行剧情回忆检索('询问甲', bulkyMemory, recallSettings, {onDelta: () => {}});
    assert.ok(!captures.at(-1).messages.some(m => m.content.includes('【回忆981】')));
    assert.ok(!notSent.tagContent.includes('【回忆981】') && !notSent.previewText.includes('【回忆981】'));

    const world = {地图: Array.from({length: 150}, (_, i) => ({名称: '地点' + i, 描述: '描'.repeat(1800)})),
        建筑: [], 江湖史册: Array.from({length: 60}, (_, i) => ({标题: '旧事' + i, 归档内容: ['史'.repeat(1000)]})),
        活跃NPC列表: [], 待执行事件: [], 已结算事件: [],
        进行中事件: Array.from({length: 100}, (_, i) => ({事件名: '异地事件' + i, 事件说明: '后台行动',
            关联地点: ['远方城镇'], 预计结束时间: i === 93 ? '1090:01:01:09:00' : '1091:01:01:09:00',
            当前进展: '尚未结算', 前置条件: ['线索已成立']}))};
    const sourceWorld = JSON.stringify(world);
    let views, worldMetrics;
    const bodyMarker = 'CURRENT_BODY_UNIQUE';
    const context = api.构建世界演变上下文文本({
        worldData: world, envData: {大地点: '大理', 时间: '1090:01:01:10:00'}, storyData: {当前章节: {标题: '当前章'}},
        currentGameTime: '1090:01:01:10:00', currentTurnBody: bodyMarker, scriptText: bodyMarker,
        shortMemoryTexts: ['上一轮已发现线索'], dueHints: ['异地事件93到期'],
        onProjection: (v, m) => {views = v; worldMetrics = m;}
    });
    assert.ok(api.countChars(context) < 32000);
    assert.ok(context.includes('"[93]"') && context.includes('异地事件93'), 'Remote due event must survive');
    assert.equal(context.split(bodyMarker).length - 1, 1, 'Current body should not repeat in history');
    const eventScope = views[1].arrays.find(a => a.path === '世界.进行中事件');
    assert.ok(eventScope.visible.includes(93));
    const hidden = [...Array(100).keys()].find(index => !eventScope.visible.includes(index));
    const safe = api.filterTaskViewCommands([
        cmd('世界.进行中事件[93].当前进展', '已到结算窗口'),
        cmd('世界.进行中事件[' + hidden + '].当前进展', '错误'),
        cmd('世界.进行中事件.' + hidden + '.当前进展', '错误'),
        cmd('世界.进行中事件', []),
        cmd('世界.进行中事件', {事件名: '异地事件' + hidden}, 'push'),
        cmd('世界.进行中事件', {事件名: '全新事件', 当前进展: '有证据'}, 'push')
    ], views);
    assert.deepEqual(safe.map(c => c.value), ['已到结算窗口', {事件名: '全新事件', 当前进展: '有证据'}]);
    const migrated = api.filterTaskViewCommands([
        cmd('世界.进行中事件', {事件名: '异地事件93', 当前进展: '迁移后续段'}, 'push'),
        cmd('世界.进行中事件[93]', null, 'delete')
    ], views);
    assert.equal(migrated.length, 2, 'A complete visible old item may be migrated via push then delete');
    const deleted = api.filterTaskViewCommands(eventScope.visible.slice(0, 2).map(index =>
        cmd('世界.进行中事件[' + index + ']', null, 'delete')), views);
    assert.ok(Number(deleted[0].key.match(/\d+/)[0]) > Number(deleted[1].key.match(/\d+/)[0]));
    const missingConditions = api.projectAuxiliaryState({待执行事件: [{事件名: '条件超长',
        前置条件: ['完整条件'.repeat(10000)], 当前状态: '待执行'}]}, {name: 'world', root: '世界', maxChars: 3000});
    assert.equal(api.filterTaskViewCommands([cmd('世界.待执行事件[0].当前状态', '已启动')], [missingConditions]).length, 0);
    assert.equal(JSON.stringify(world), sourceWorld);
    reply = '<说明>- 推进到期项</说明><命令>set 世界.进行中事件[93].当前进展 = "已到结算窗口"\nset 世界.进行中事件[' +
        hidden + '].当前进展 = "错误"\nset 世界.进行中事件 = []</命令>';
    const evolved = await api.generateWorldEvolutionUpdate(context, config, undefined, '', '',
        api.构建世界演变COT提示词(), false, false, {views, metrics: worldMetrics});
    assert.equal(evolved.commands.length, 1);
    assert.equal(evolved.commands[0].key, '世界.进行中事件[93].当前进展');
    const applied = api.applyStateCommand({}, {}, [], world, {}, {}, {}, undefined, undefined, undefined,
        {}, [], [], evolved.commands[0].key, evolved.commands[0].value, evolved.commands[0].action);
    assert.equal(applied.world.进行中事件[93].当前进展, '已到结算窗口');
    assert.equal(applied.world.进行中事件[hidden].当前进展, '尚未结算');
    assert.equal(applied.world.进行中事件.length, 100);
    assert.equal(JSON.stringify(world), sourceWorld);
    assert.ok(wireChars(captures.at(-1)) <= 48000);
    assert.equal(captures.at(-1).max_tokens, 8192);
    assert.ok(!captures.at(-1).messages.some(m => m.content.includes('Step0~Step15')));
    report.cases.world = {sourceWorldChars: api.countChars(sourceWorld), contextChars: api.countChars(context),
        wireChars: wireChars(captures.at(-1)), remoteDueIndex: 93, visibleEventIndices: eventScope.visible};

    const social = Array.from({length: 100}, (_, i) => ({id: 'npc-' + i, 姓名: i === 74 ? '钟灵' : '路人' + i,
        与玩家关系: i === 74 ? '旧承诺未兑现' : '陌生', 记忆: ['记'.repeat(2000)],
        立绘: 'PRIVATE_ART_RESOURCE_' + 'x'.repeat(10000), 背包: [{名字: '无关物品'}]}));
    const storyPayload = {剧情: {当前章节: {标题: '无量山调查', 当前分解组: 1, 原著换章条件: ['找到解药']},
        历史卷宗: Array.from({length: 80}, (_, i) => ({标题: '旧章' + i, 记录: '卷'.repeat(1000)}))},
        剧情规划: {当前章任务: [{任务名: '给钟灵送解药', 当前状态: '进行中'}]}};
    const planParams = {playerName: '测试', currentStoryJson: JSON.stringify(storyPayload),
        currentHeroinePlanJson: '{}', worldJson: sourceWorld, socialJson: JSON.stringify(social),
        envJson: JSON.stringify({大地点: '大理', 小地点: '无量山', 时间: '1090:01:01:10:00'}),
        recentBodiesText: '钟灵在无量山等待解药。' + '文'.repeat(50000), currentPlanText: '送解药',
        auditFocusText: '钟灵旧承诺与异地事件93', heroineEnabled: false};
    const planBefore = JSON.stringify(planParams);
    reply = '<说明>- 调整任务</说明><命令>set 剧情规划.当前章任务[0].当前状态 = "进行中"</命令>';
    const planned = await api.generatePlanningAnalysis(planParams, config);
    assert.equal(planned.commands.length, 1);
    const planBody = captures.at(-1);
    assert.ok(wireChars(planBody) <= 48000);
    assert.ok(planBody.messages.some(m => m.content.includes('钟灵')));
    assert.ok(!planBody.messages.some(m => m.content.includes('PRIVATE_ART_RESOURCE_')));
    assert.equal(planBody.max_tokens, 8192);
    assert.ok(!planBody.messages.some(m => m.content.includes('Step0~Step9')));
    const logged = api.exportApiDiagnostics().calls.at(-1);
    assert.equal(logged.task, 'planning');
    assert.ok(logged.inputBreakdown.sections.length);
    assert.ok(logged.inputBreakdown.details.some(m => m.name === 'social' && m.sourceChars > m.sentChars));
    assert.ok(!JSON.stringify(logged).includes('钟灵'));
    report.cases.planning = {sourceWorldChars: api.countChars(sourceWorld), sourceSocialChars: api.countChars(planParams.socialJson),
        wireChars: wireChars(planBody), breakdown: logged.inputBreakdown};
    assert.equal(JSON.stringify(planParams), planBefore);
    const incompleteStory = {...storyPayload, 剧情规划: {当前章任务: Array.from({length: 100}, (_, i) =>
        ({任务名: '任务' + i, 当前状态: '进行中'}))}};
    reply = '<说明>- 换章</说明><命令>set 剧情.当前章节.当前分解组 = 2\nset 剧情规划.当前章任务 = []</命令>';
    const gate = await api.generatePlanningAnalysis({...planParams, currentStoryJson: JSON.stringify(incompleteStory)}, config);
    assert.equal(gate.commands.length, 0, 'Incomplete chapter gates must not advance or clear hidden tasks');
    assert.equal(gate.shouldUpdate, false);
    for (const heroineEnabled of [false, true]) for (const fandomEnabled of [false, true]) for (const gptMode of [false, true]) {
        reply = '<说明>- 无需更新</说明><命令>无</命令>';
        await api.generatePlanningAnalysis({...planParams, heroineEnabled, fandomEnabled, gptMode}, {...config, model: 'deepseek-v4.1-flash'});
        assert.ok(wireChars(captures.at(-1)) <= 48000, 'All feature/role combinations respect final wire budget');
    }

    const books = [{id: 'book', 名称: 'fixture', 启用: true, 条目: [100000, 1000].map((size, i) => ({
        id: 'entry' + i, 标题: '条目' + i, 内容: '书'.repeat(size), 启用: true, 类型: 'world_lore',
        作用域: ['world_evolution', 'story_plan'], 注入模式: 'always', 关键词: []}))}];
    const worldbook = api.构建世界书注入文本({books, scopes: ['world_evolution']});
    assert.equal(worldbook.selectedEntries.length, 1);
    assert.equal(worldbook.selectedEntries[0].id, 'entry1');
    assert.ok(api.countChars(worldbook.combinedText) <= 4000);
    const recordText = '【当前章节内容】\n分解组号：1\n原著硬约束：\n[1] 内容：不得提前切章\n谁不知道：钟灵\n' +
        '[2] 内容：' + '巨'.repeat(10000) + '\n谁知道：反派\n关键事件：\n[1] 完整事件\n前置条件：已取到解药\n阻断条件：毒未解\n';
    const records = api.budgetTextRecords(recordText, 300);
    assert.ok(records.includes('不得提前切章') && records.includes('谁不知道：钟灵'));
    assert.ok(!records.includes('谁知道：反派'), 'Visibility of an omitted record must be omitted with that record');
    assert.ok(records.includes('前置条件：已取到解药') && records.includes('阻断条件：毒未解'));
    assert.ok(api.countChars(records) <= 300);
    globalThis.__auxiliaryNovel = {id: 'novel', 名称: 'fixture', 注入树: [], 分段列表: [{
        id: 'segment', 组号: 1, 处理状态: '已完成', 启用注入: true, 章节范围: '第一章',
        章节标题: ['第一章'], 本组概括: '小说摘要', 前组延续事实: ['巨'.repeat(100000)],
        本组结束状态: ['巨'.repeat(100000)], 原著硬约束: [{内容: '不得提前切章'}], 关键事件: [], 角色推进: []
    }]};
    const features = {小说拆分功能启用: true, 小说拆分规划分析注入: true, 小说拆分世界演变注入: true};
    for (const target of ['planning', 'world_evolution']) {
        let novelMetric;
        const novel = await api.获取激活小说拆分注入文本({功能模型占位: features}, target, undefined, {当前章节: {当前分解组: 1}},
            undefined, metric => novelMetric = metric);
        assert.ok(api.countChars(novel) <= 4000);
        assert.ok(novel.includes('资料未完整展示'));
        assert.ok(novelMetric.sourceChars > 100000 && novelMetric.sentChars <= 4000);
    }
    globalThis.__auxiliaryNovel.分段列表 = [];
    globalThis.__auxiliarySnapshots = [{数据集ID: 'novel', 目标链路: 'planning', 文本: recordText}];
    const fallback = await api.获取激活小说拆分注入文本({功能模型占位: {...features, 小说拆分详细注入上限: 500}}, 'planning');
    assert.ok(api.countChars(fallback) <= 500);
    report.cases.materials = {worldbookChars: api.countChars(worldbook.combinedText), recordsChars: api.countChars(records),
        novelAuxiliaryDefaultLimit: 4000, snapshotChars: api.countChars(fallback)};

    reply = '<说明>- 截断</说明><命令>set 剧情规划.当前章任务[0].当前状态 = "完成"';
    finishReason = 'length';
    const beforePosts = captures.length;
    await assert.rejects(() => api.generatePlanningAnalysis(planParams, config), /输出被截断/);
    assert.equal(captures.length, beforePosts + 1, 'Output limit failures should not repeat the same expensive request');
    assert.equal(api.exportApiDiagnostics().calls.at(-1).errorKind, 'output-limit');
    finishReason = 'stop';
    await assert.rejects(() => api.generatePlanningAnalysis(planParams, config), /输出结构不完整/);
    reply = '{"commands":[{"action":"set","key":"剧情.当前章节.当前分解组","value":2}]';
    await assert.rejects(() => api.generatePlanningAnalysis(planParams, config), /输出结构不完整/);
    reply = '<说明>- 无需更新</说明><命令>无</命令>';
    await api.generatePlanningAnalysis({...planParams, extraPrompt: '【附加条目】\n' + '额'.repeat(100000)}, config);
    assert.ok(wireChars(captures.at(-1)) <= 48000);
    await api.generateWorldEvolutionUpdate(context, config, undefined, '【附加条目】\n' + '额'.repeat(100000),
        '', api.构建世界演变COT提示词(), true, true, {views, metrics: worldMetrics});
    assert.ok(wireChars(captures.at(-1)) <= 48000);
    assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes(config.apiKey));

    // Optional before/after evidence from the research bundle pinned to original bfca81e7.
    // A clean checkout can run every regression above without that research artifact.
    const originalBundle = process.cwd() + '/work/input-context-research-2026-10-02/bundles/original.mjs';
    let originalAvailable = false;
    try { await access(originalBundle); originalAvailable = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (originalAvailable) {
        const original = await import(pathToFileURL(originalBundle).href);
        const originalCandidates = original.预筛剧情回忆候选('询问甲', memory, 20);
        const originalCorpus = original.构建剧情回忆检索上下文(memory, 20, {candidateIds: originalCandidates.map(item => item.id)});
        assert.equal(api.countChars(originalCorpus), report.cases.recall.oldCorpusChars);
        const oldContext = original.构建世界演变上下文文本({
            worldData: world, envData: {大地点: '大理', 时间: '1090:01:01:10:00'}, storyData: {当前章节: {标题: '当前章'}},
            currentGameTime: '1090:01:01:10:00', currentTurnBody: bodyMarker, scriptText: bodyMarker,
            shortMemoryTexts: ['上一轮已发现线索'], dueHints: ['异地事件93到期']
        });
        await original.generateWorldEvolutionUpdate(oldContext, config, undefined, '', '', original.构建世界演变COT提示词());
        report.cases.world.beforeWireChars = wireChars(captures.at(-1));
        await original.generatePlanningAnalysis(planParams, config);
        report.cases.planning.beforeWireChars = wireChars(captures.at(-1));
        assert.ok(report.cases.world.beforeWireChars > report.cases.world.wireChars * 5);
        assert.ok(report.cases.planning.beforeWireChars > report.cases.planning.wireChars * 5);
    }

    await writeFile(out + '/REPORT.json', JSON.stringify(report, null, 2) + '\n');
    console.log('Auxiliary context regression passed: bounded recall, old clue, remote due/source indices, safe patches/deletes, chapter gates, all planning modes, material budgets, output truncation and private metrics.');
    console.log(JSON.stringify({recallChars: report.cases.recall.corpusChars,
        worldWireChars: report.cases.world.wireChars, planningWireChars: report.cases.planning.wireChars}));
} finally {
    globalThis.fetch = savedFetch;
    if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage); else delete globalThis.localStorage;
    delete globalThis.__auxiliaryNovel; delete globalThis.__auxiliarySnapshots;
}
