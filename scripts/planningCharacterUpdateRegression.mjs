import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const out = 'work/regression/planningCharacterUpdateRegression';
await mkdir(out, {recursive: true});
const bundle = await build({
    stdin: {contents: [
        "export * from './utils/auxiliaryContext';",
        "export * from './services/ai/apiDiagnostics';",
        "export {创建规划更新工作流} from './hooks/useGame/planningUpdateWorkflow';",
        "export {规范化接口设置,设置功能API档案} from './utils/apiConfig';",
        "export {构建统一规划分析专用上下文} from './prompts/runtime/planUpdateReference';"
    ].join('\n'), resolveDir: process.cwd(), loader: 'ts'},
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{name: 'offline-data', setup(builder) {
        builder.onResolve({filter: /novelDecompositionStore$/}, () => ({path: 'store', namespace: 'fixture'}));
        builder.onResolve({filter: /novelDecompositionCalibration$/}, () => ({path: 'calibration', namespace: 'fixture'}));
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({loader: 'js', contents: args.path === 'store'
            ? 'export const 获取当前激活小说拆分数据集=async()=>undefined;'
                + 'export const 获取小说拆分数据集=async()=>undefined;'
                + 'export const 读取小说拆分注入快照列表=async()=>[];'
            : 'export const 规范化章节时间校准列表=()=>[];'
                + 'export const 应用剧情小说时间校准到分段=s=>s;'
                + 'export const 同步剧情小说分解时间校准=async({nextStory})=>nextStory;'}));
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
const cmd = (key, value, action = 'set') => ({key, value, action});
const plan = {
    阶段推进: [{阶段名: '西南前夕相逢期', 主推女主: ['钟灵'], 阶段目标: ['救援钟灵'], 切换条件: ['安全脱险']}],
    女主条目: [{女主姓名: '钟灵', 类型: '原著女主', 当前关系状态: '信任/感激', 当前阶段: '信任建立与等待期',
        已成立事实: Array.from({length: 8}, (_, i) => '旧事实' + i + '钟灵被扣押需要救援'.repeat(6)),
        阶段目标: ['安全脱险'], 推进方式: ['取得解药'], 阻断因素: ['毒未解'],
        允许突破条件: ['当面交付解药'], 失败后回退: ['维持等待']}],
    女主互动事件: [], 女主镜头规划: []
};
const gan = {女主姓名: '甘宝宝', 类型: '原著人物', 当前关系状态: '合作', 当前阶段: '共同救援',
    已成立事实: ['已当面商定救援钟灵'], 阶段目标: ['救援钟灵'], 推进方式: ['共同调查'],
    阻断因素: ['尚未确认所在位置'], 允许突破条件: ['找到钟灵'], 失败后回退: ['保持合作']};
const root = '同人女主剧情规划';
try {
    const before = JSON.stringify(plan);
    const view = api.projectAuxiliaryState({[root]: plan}, {name: 'heroine', root: '', maxChars: 2600});
    assert.ok(view.incomplete.includes(root + '.女主条目[0].已成立事实'), 'Fixture must reproduce excerpted older facts');
    assert.ok(view.text.includes('女主姓名'));
    const addition = cmd(root + '.女主条目', gan, 'push');
    assert.equal(api.filterTaskViewCommands([addition], [view]).length, 1,
        'A new heroine may be appended without overwriting excerpted facts of an older heroine');
    assert.equal(api.filterTaskViewCommands([cmd(root + '.女主条目', {...gan, 女主姓名: '钟灵'}, 'push')], [view]).length, 0,
        'A hidden or visible existing heroine must not be duplicated');
    assert.equal(api.filterTaskViewCommands([cmd(root + '.女主条目', [])], [view]).length, 0);
    assert.equal(api.filterTaskViewCommands([cmd(root + '.女主条目[0].已成立事实', [])], [view]).length, 0);
    for (const [field, titleKey] of [['女主互动事件', '事件名'], ['女主镜头规划', '镜头标题']]) {
        const existing = {[root]: {...plan, [field]: [{女主姓名: '甘宝宝', [titleKey]: '共同救援', 当前状态: '待触发'}]}};
        const eventView = api.projectAuxiliaryState(existing, {name: 'heroine', root: '', maxChars: 4500});
        const candidate = name => cmd(root + '.' + field, {女主姓名: '甘宝宝', [titleKey]: name, 当前状态: '待触发'}, 'push');
        assert.equal(api.filterTaskViewCommands([candidate('后续会合')], [eventView]).length, 1);
        assert.equal(api.filterTaskViewCommands([candidate('共同救援')], [eventView]).length, 0);
        const identified = api.projectAuxiliaryState({[root]: {...plan,
            [field]: [{id: 'existing', 女主姓名: '甘宝宝', [titleKey]: '共同救援'}]}},
            {name: 'heroine', root: '', maxChars: 4500});
        assert.equal(api.filterTaskViewCommands([cmd(root + '.' + field,
            {id: 'other', 女主姓名: '甘宝宝', [titleKey]: '共同救援'}, 'push')], [identified]).length, 0);
        assert.equal(api.filterTaskViewCommands([cmd(root + '.' + field,
            {id: 'existing', 女主姓名: '甘宝宝', [titleKey]: '后续会合'}, 'push')], [identified]).length, 0);
    }
    const missing = api.projectAuxiliaryState({[root]: {女主互动事件: [{女主姓名: '钟灵', 事件名: '救援',
        前置条件: ['未验证条件'.repeat(10000)], 当前状态: '待触发'}]}}, {name: 'heroine', root: '', maxChars: 2600});
    assert.equal(api.filterTaskViewCommands([cmd(root + '.女主互动事件[0].当前状态', '已完成')], [missing]).length, 0);
    assert.equal(JSON.stringify(plan), before);

    const config = {id: 'offline', 供应商: 'openai_compatible', model: 'offline-model',
        apiKey: 'offline-only', baseUrl: 'https://offline.invalid/v1', maxTokens: 65536};
    let settings = api.规范化接口设置({activeConfigId: config.id, configs: [config]});
    settings = api.设置功能API档案(settings, '规划分析', config.id);
    settings.功能模型占位.规划分析独立模型开关 = true;
    const requests = [];
    for (const fandom of [true, false]) {
        const heroineRoot = fandom ? root : '女主剧情规划';
        const final = '<说明>- 同步已发生的合作和救援关系</说明><命令>'
            + 'set ' + heroineRoot + '.女主条目[0].当前关系状态 = "共同救援后的信任"\n'
            + 'push ' + heroineRoot + '.女主条目 = ' + JSON.stringify(gan) + '</命令>';
        globalThis.fetch = async (url, init) => {
            assert.ok(String(url).startsWith('https://offline.invalid/'), 'No real provider calls');
            requests.push(JSON.parse(init.body));
            return new Response('data: ' + JSON.stringify({choices: [{delta: {content: final}, finish_reason: 'stop'}]})
                + '\n\ndata: [DONE]\n\n', {headers: {'content-type': 'text/event-stream'}});
        };
        const state = {环境: {时间: '1090:03:10:15:00'}, 世界: {}, 社交: [{姓名: '甘宝宝', 与玩家关系: '合作'}],
            剧情: {}, 剧情规划: {}, 同人剧情规划: {},
            女主剧情规划: clone(plan), 同人女主剧情规划: clone(plan)};
        const body = '已与甘宝宝当面商定救援钟灵；钟灵确认双方的保护与合作，信任关系得到巩固。';
        const deps = {apiConfig: settings, gameConfig: {启用女主剧情规划: true}, 角色: {姓名: '测试'},
            开局配置: fandom ? {同人融合: {enabled: true, 作品名: '天龙八部'}} : undefined,
            环境: clone(state.环境), 世界: {}, 战斗: {}, 玩家门派: {}, 任务列表: [], 约定列表: [],
            历史记录: [], prompts: [], worldbooks: [], 深拷贝: clone,
            收集最近完整正文回合: () => [{}], 构建最近完整正文上下文: () => body,
            去重文本数组: rows => [...new Set(rows)], 提取响应完整正文文本: () => body,
            performAutoSave: async snapshot => { deps.saved = clone(snapshot); }};
        for (const name of ['规范化环境信息','规范化社交列表','规范化世界状态','规范化战斗状态','规范化门派状态',
            '规范化剧情状态','规范化剧情规划状态','规范化女主剧情规划状态','规范化同人剧情规划状态','规范化同人女主剧情规划状态'])
            deps[name] = clone;
        for (const name of ['收集女主规划时间触发原因','收集女主正文命中原因','收集剧情规划时间触发原因','收集剧情正文命中原因'])
            deps[name] = () => [];
        for (const name of ['设置剧情','设置剧情规划','设置女主剧情规划','设置同人剧情规划','设置同人女主剧情规划'])
            deps[name] = value => { deps[name + '结果'] = clone(value); };
        const result = await api.创建规划更新工作流(deps).后台执行统一规划分析({state: clone(state),
            playerInput: '与甘宝宝合作救援钟灵', gameTime: state.环境.时间, response: {logs: []}});
        assert.equal(result.heroinePlanCommands.length, 2);
        const saved = fandom ? deps.saved.fandomHeroinePlan : deps.saved.heroinePlan;
        assert.equal(saved.女主条目[0].当前关系状态, '共同救援后的信任');
        assert.ok(saved.女主条目.some(item => item.女主姓名 === '甘宝宝'));
        assert.deepEqual(saved.女主条目[0].已成立事实, plan.女主条目[0].已成立事实);
        const sent = requests.at(-1).messages.map(m => m.content).join('\n');
        assert.ok(sent.includes('才允许额外写入 `' + heroineRoot + '.*`'));
        assert.ok(sent.includes('<女主剧情规划协议>'));
        assert.ok(!sent.includes('<同人女主剧情规划协议>'));
        assert.ok(requests.at(-1).messages.reduce((n, m) => n + api.countChars(m.content), 0) <= 48000);
        const metric = api.exportApiDiagnostics().calls.at(-1).result;
        assert.equal(metric.status, 'applied');
        assert.equal(metric.parsedHeroineCommands, 2);
        assert.equal(metric.acceptedHeroineCommands, 2);
        assert.equal(metric.appliedHeroineCommands, 2);
        assert.deepEqual(state.同人女主剧情规划, plan);
    }
    assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('甘宝宝'));
    console.log('Planning character update regression passed: append alongside excerpted facts, duplicate identities, distinct same-heroine events/shots, condition guards, original/fandom writeback and autosave, bounded private diagnostics.');
} finally {
    globalThis.fetch = savedFetch;
    if (savedStorage) Object.defineProperty(globalThis, 'localStorage', savedStorage); else delete globalThis.localStorage;
}
