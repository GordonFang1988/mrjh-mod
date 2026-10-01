import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const built = await build({stdin:{contents:`export * from './utils/apiConfig';
export { 请求模型文本 } from './services/ai/chatCompletionClient';
export { 创建图片预设工作流 } from './hooks/useGame/imagePresetWorkflow';`,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
const bundle = process.cwd()+'/work/regression/apiProfileReuseRegression.bundle.mjs';
await writeFile(bundle,built.outputFiles[0].text);
const api = await import(pathToFileURL(bundle).href);
const main = {id:'fixture-main',名称:'main',供应商:'deepseek',协议覆盖:'deepseek',baseUrl:'https://main-profile.invalid/v1',apiKey:'offline-main',model:'deepseek-chat',maxTokens:1536,temperature:0.25,createdAt:1,updatedAt:1};
const other = {id:'fixture-opencode',名称:'other',供应商:'openai_compatible',协议覆盖:'openai',baseUrl:'https://opencode.ai/zen/go/v1',apiKey:'offline-other',model:'glm-5',模型列表:['glm-5','deepseek-v4-flash'],maxTokens:3072,temperature:0.6,createdAt:1,updatedAt:1};
let settings = api.规范化接口设置({activeConfigId:main.id,configs:[main,other],功能模型占位:{剧情回忆独立模型开关:true,记忆总结独立模型开关:true,文章优化独立模型开关:true,变量计算独立模型开关:true,世界演变独立模型开关:true,规划分析独立模型开关:true,小说拆分功能启用:true,小说拆分独立模型开关:true,文生图功能启用:true,场景生图独立接口启用:true,词组转化器启用独立模型:true,PNG提炼启用独立模型:true}});
const getters = {
    剧情回忆:api.获取剧情回忆接口配置,记忆总结:api.获取记忆总结接口配置,文章优化:api.获取文章优化接口配置,
    变量计算:api.获取变量计算接口配置,世界演变:api.获取世界演变接口配置,规划分析:api.获取规划分析接口配置,
    小说拆分:api.获取小说拆分接口配置,文生图:api.获取文生图接口配置,场景生图:api.获取场景文生图接口配置,
    词组转化器:api.获取生图词组转化器接口配置,PNG提炼:api.获取PNG提炼接口配置
};
for (const usage of Object.keys(getters)) settings=api.设置功能API档案(settings,usage,other.id);
for (const [usage,getter] of Object.entries(getters)) {
    const config=getter(settings);
    for (const key of ['id','供应商','协议覆盖','baseUrl','apiKey','model','temperature']) assert.equal(config[key],other[key],usage+' '+key);
    assert.equal(config.maxTokens,usage==='小说拆分'?32768:other.maxTokens);
    assert.deepEqual(config.模型列表,other.模型列表);
}
assert.equal(api.获取女主规划接口配置(settings).id,other.id);
assert.equal(api.获取剧情规划接口配置(settings).id,other.id);
assert.equal(settings.功能模型占位.世界演变API地址,'');
assert.equal(settings.功能模型占位.世界演变API密钥,'');
const edited={...settings,configs:settings.configs.map(profile=>profile.id===other.id?{...profile,供应商:'claude',协议覆盖:'claude',baseUrl:'https://edited-profile.invalid/v1',apiKey:'offline-edited',temperature:0.4}:profile)};
for (const getter of Object.values(getters)) {
    const config=getter(edited);
    assert.equal(config.baseUrl,'https://edited-profile.invalid/v1');assert.equal(config.apiKey,'offline-edited');
    assert.equal(config.供应商,'claude');assert.equal(config.协议覆盖,'claude');assert.equal(config.temperature,0.4);
}
for (const supplier of ['openai','openai_compatible','deepseek','zhipu','gemini','claude']) {
    const sample={...settings,configs:settings.configs.map(profile=>profile.id===other.id?{...profile,供应商:supplier}:profile)};
    assert.equal(api.获取世界演变接口配置(sample).供应商,supplier);
}
const cached=api.记录接口档案模型列表(settings,other.id,['glm-5','deepseek-v4-flash','glm-5']);
assert.deepEqual(cached.configs.find(profile=>profile.id===other.id).模型列表,['glm-5','deepseek-v4-flash']);
assert.deepEqual(api.记录接口档案模型列表(edited,other.id,['stale-model'],other).configs,edited.configs);
const reloaded=api.规范化接口设置(JSON.parse(JSON.stringify(cached)));
assert.deepEqual(reloaded.功能模型占位.功能API档案,cached.功能模型占位.功能API档案);
assert.deepEqual(reloaded.configs,cached.configs);
const stale={...settings,功能模型占位:{...settings.功能模型占位,世界演变API地址:'https://legacy-profile.invalid/v1',世界演变API密钥:'offline-legacy'}};
assert.equal(api.获取世界演变接口配置(stale).baseUrl,other.baseUrl);
const followsMain=api.设置功能API档案(stale,'世界演变','');
assert.equal(api.获取世界演变接口配置(followsMain).id,main.id);
assert.equal(api.获取世界演变接口配置(followsMain).apiKey,main.apiKey);
assert.equal(followsMain.功能模型占位.世界演变API密钥,'offline-legacy');
assert.equal(api.规范化接口设置(JSON.parse(JSON.stringify(followsMain))).功能模型占位.功能API档案.世界演变,'');
const legacy=api.设置功能API档案(stale,'世界演变',undefined);
assert.equal(api.获取世界演变接口配置(legacy).baseUrl,'https://legacy-profile.invalid/v1');
assert.equal(api.获取世界演变接口配置(legacy).apiKey,'offline-legacy');
assert.equal(api.获取世界演变接口配置(legacy).协议覆盖,'auto');
assert.equal(api.获取世界演变接口配置(legacy).模型列表,undefined);
const missing={...settings,configs:[settings.configs[0]]};
for (const getter of Object.values(getters)) assert.equal(getter(missing),null);
assert.equal(api.获取规划分析接口配置或主剧情回退(missing),null);
assert.equal(api.获取词组转化器接口配置或主剧情回退(missing),null);
const disabled={...settings,功能模型占位:{...settings.功能模型占位,世界演变独立模型开关:false,变量计算独立模型开关:false,规划分析独立模型开关:false}};
assert.equal(api.获取世界演变接口配置(disabled),null);assert.equal(api.获取变量计算接口配置(disabled),null);assert.equal(api.获取规划分析接口配置(disabled),null);
assert.equal(api.设置功能API档案(disabled,'世界演变',other.id).功能模型占位.世界演变独立模型开关,false);
const disabledMissing={...missing,功能模型占位:{...missing.功能模型占位,规划分析独立模型开关:false,剧情规划独立模型开关:false,女主规划独立模型开关:false,词组转化器启用独立模型:false}};
assert.equal(api.获取规划分析接口配置或主剧情回退(disabledMissing).id,main.id);
assert.equal(api.获取词组转化器接口配置或主剧情回退(disabledMissing).id,main.id);
const standalone=api.规范化接口设置({configs:[],功能模型占位:{小说拆分API地址:'https://legacy-profile.invalid/v1',小说拆分API密钥:'offline-legacy',小说拆分使用模型:'legacy-model'}});
assert.equal(api.获取小说拆分接口配置(standalone).id,'novel_decomposition_dedicated');
assert.equal(api.获取小说拆分接口配置(standalone).maxTokens,32768);
const noOverride={...settings,功能模型占位:{...settings.功能模型占位,世界演变使用模型:''}};
assert.equal(api.获取世界演变接口配置(noOverride).model,other.model);

const originalFetch=globalThis.fetch;
const descriptors=Object.fromEntries(['localStorage','navigator','FileReader'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
const storage=new Map();const calls=[];
try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_key,callback)=>callback()}}});
    globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({choices:[{message:{content:'offline result'}}]});};
    for (const getter of [api.获取世界演变接口配置,api.获取变量计算接口配置,api.获取规划分析接口配置]) {
        assert.equal(await api.请求模型文本(getter(settings),[{role:'user',content:'offline fixture'}],{temperature:0.2}),'offline result');
    }
    const session=calls[0].init.headers.get('x-opencode-session');
    for (const call of calls) {
        assert.equal(call.url,'https://simc-llm-proxy.gordonfang1988.workers.dev/proxy');
        assert.equal(call.init.headers.get('X-LLM-Target-URL'),other.baseUrl+'/chat/completions');
        assert.equal(call.init.headers.get('Authorization'),'Bearer '+other.apiKey);
        assert.equal(call.init.headers.get('x-opencode-session'),session);
        const body=JSON.parse(call.init.body);assert.equal(body.model,other.model);assert.equal(body.max_tokens,other.maxTokens);assert.equal(body.temperature,other.temperature);
    }
    assert.ok(storage.has('mrjh-opencode-api-session:v1:'+other.id));
    assert.equal(storage.has('mrjh-opencode-api-session:v1:'+main.id),false);
    // Exercise the actual PNG workflow rather than only its configuration getter.
    Object.defineProperty(globalThis,'FileReader',{configurable:true,value:class { readAsDataURL(){this.result='data:image/png;base64,AA==';this.onloadend();} }});
    let pngConfig;let finish;
    const saved=new Promise(resolve=>{finish=resolve;});
    const workflow=api.创建图片预设工作流({获取接口配置:()=>settings,获取社交列表:()=>[],保存图片资源:async()=> 'wuxia-asset://fixture',推送右下角提示:toast=>{if(toast.tone==='error')finish(new Error(toast.message));},更新接口配置:updater=>{settings=updater(settings);finish();},加载图片AI服务:async()=>({解析PNG文件元数据:async()=>({正面提示词:'offline style',来源:'fixture'}),提炼PNG画风标签:async(_parsed,config)=>{pngConfig=config;return {正面提示词:'offline style'};},净化PNG复刻参数:()=>({})})});
    await workflow.parsePngStylePreset(new File(['fixture'],'fixture.png',{type:'image/png'}));
    const result=await saved;if(result instanceof Error)throw result;
    assert.equal(pngConfig.id,other.id);assert.equal(pngConfig.供应商,other.供应商);assert.equal(pngConfig.协议覆盖,other.协议覆盖);assert.equal(pngConfig.maxTokens,other.maxTokens);
} finally {
    globalThis.fetch=originalFetch;
    for (const [key,descriptor] of Object.entries(descriptors)) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]; }
}
console.log('API profile reuse passed: 11 feature routes, shared connection edits/types/models, legacy/follow-main/deleted profiles, unchanged enablement, config roundtrip, real request headers/bodies/proxy session and actual PNG workflow. Offline fixtures only.');
