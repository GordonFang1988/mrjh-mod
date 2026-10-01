import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Exercise the opening workflow and real HTTP serialization with an offline fetch fixture.
const source = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { 执行开场剧情生成工作流 } from './hooks/useGame/openingStoryWorkflow';
import { parseAvgManifest } from './services/avg/manifest';
import { AVG_FULL_PROTOCOL_PROMPT } from './services/avg/vocabulary';
import { buildAvgSceneSourceEvidence, diagnoseAvgSceneSource } from './services/avg/sceneEvidence';

const env = {大地点:'大理',中地点:'大理城',小地点:'城南',具体地点:'关帝庙',时间:'1110:03:01:06:00'};
const role = {姓名:'方小腊',年龄:24};
const catalogPath = process.argv[2] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const catalog = parseAvgManifest(JSON.parse(readFileSync(catalogPath,'utf8').replace(/^\uFEFF/,'')));
assert.deepEqual(catalog.errors, []);
assert.ok(catalog.scenes.some(asset => asset.profile.空间 === '破庙内'));
globalThis.openingFixtureCatalog = catalog;
const hint = {ref:'temple',场景ID:'dali-guandi-interior',地点:env,分类:{空间:'破庙内',地域:'西南',完好程度:'残破'}};
const body = '<正文>【旁白】庙内漏进晨光。\n【旁白】少年端来面汤。\n【旁白】你接过碗。</正文>';
const sceneBody = body.replace('<正文>', '<正文><镜头 ref="temple"/>\n') + '<演出场景>' + JSON.stringify({场景:[hint]}) + '</演出场景>';
const baseProtocol = '【开局输出协议测试】请按正文标签输出开场。';
const preset = {
 prompts:[{identifier:'fixture',role:'system',content:'离线酒馆预设'}],
 prompt_order:[{character_id:100000,order:[{identifier:'fixture',enabled:true},{identifier:'worldInfoBefore',enabled:true},{identifier:'userInput',enabled:true}]}]
};
const context = {
 shortMemoryContext:'',
 contextPieces: new Proxy({AI角色声明:'开局剧情模型',worldPrompt:'测试世界',输出协议提示词:baseProtocol,格式提示词:baseProtocol}, {
  get: (value,key) => value[key] ?? ''
 })
};
const api = {供应商:'openai',baseUrl:'https://opening-fixture.invalid/v1',apiKey:'offline-fixture',model:'offline-fixture'};
const originalFetch = globalThis.fetch;
const originalErrors = console.error;
let cases = 0;
try {
 for (const mode of ['normal','gpt','tavern']) for (const avg of [true,false]) for (const cot of [true,false]) for (const stream of [true,false]) {
  const name = JSON.stringify({mode,avg,cot,stream});
  const sent = [];
  const errors = [];
  let history = [];
  let saved;
  globalThis.fetch = async (url, options) => {
   assert.equal(String(url),'https://opening-fixture.invalid/v1/chat/completions');
   const request = JSON.parse(options.body);
   sent.push(request);
   const protocolMessages = request.messages.filter(message => message.content.includes(AVG_FULL_PROTOCOL_PROMPT));
   assert.equal(protocolMessages.length,avg ? 1 : 0,name+' actual HTTP payload');
   assert.equal(request.stream,stream,name+' transport mode');
   if (mode !== 'tavern') assert.ok(request.messages.some(message => message.role === 'system' && message.content.includes(baseProtocol)),name+' base output protocol');
   const raw = avg ? sceneBody : body;
   if (stream) return new Response('data: '+JSON.stringify({choices:[{delta:{content:raw}}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
   return Response.json({choices:[{message:{content:raw}}]});
  };
  console.error = (...args) => errors.push(args);
  const deps = {
   apiConfig:{},环境:env,角色:role,世界:{},战斗:{},玩家门派:{},任务列表:[],约定列表:[],剧情:{},剧情规划:{},
   gameConfig:{启用AVG演出:avg,启用GPT模式:mode === 'gpt',启用COT伪装注入:cot,启用修炼体系:false,启用女主剧情规划:false,启用标签修复:false,启用标签检测完整性:false,启用酒馆预设模式:mode === 'tavern',酒馆预设:preset},
   memoryConfig:{},builtinPromptEntries:[],worldbooks:[],abortControllerRef:{current:null},
   构建系统提示词:()=>context,
   设置历史记录: next => {history = typeof next === 'function' ? next(history) : next;},
   processResponseCommands:(_response,state)=>state,
   游戏设置启用自动重试:()=>false,
   执行带自动重试的生成请求:({action})=>action(),
   获取原始AI消息:raw=>raw,
   提取解析失败原始信息:error=>error.message,
   估算消息Token:()=>0,估算AI输出Token:()=>0,计算回复耗时秒:()=>0,
   提取新增NPC列表:()=>[],performAutoSave:async snapshot=>{saved=snapshot;}
  };
  for (const key of ['规范化环境信息','规范化剧情状态','规范化剧情规划状态','规范化女主剧情规划状态','规范化同人剧情规划状态','规范化同人女主剧情规划状态','规范化角色物品容器映射','规范化社交列表','规范化世界状态','规范化战斗状态','规范化门派状态']) deps[key] = value=>value;
  for (const key of ['setPrompts','设置角色','设置环境','设置社交','设置世界','设置战斗','设置剧情','设置剧情规划','设置女主剧情规划','设置同人剧情规划','设置同人女主剧情规划','设置玩家门派','设置任务列表','设置约定列表','设置开局变量生成进度','设置开局世界演变进度','设置开局规划进度','设置游戏初始时间','记录变量生成上下文','setWorldEvents','应用并同步记忆系统','触发新增NPC自动生图','触发场景自动生图']) deps[key]=()=>{};
  await 执行开场剧情生成工作流({角色:role,环境:env},[],stream,api,undefined,deps as any);
  assert.deepEqual(errors,[],name+' opening completed');
  assert.equal(sent.length,1,name+' exactly one offline request');
  const turn = history.find(message=>message.structuredResponse);
  assert.ok(turn,name+' retained response');
  assert.equal(turn.avgSceneTrace.request.source,'opening');
  assert.equal(turn.avgSceneTrace.request.enabledAtRequest,avg);
  assert.equal(turn.avgSceneTrace.request.protocolIncluded,avg);
  assert.equal(turn.avgSceneTrace.request.protocolMessageIndexes.length,avg ? 1 : 0);
  assert.equal(turn.structuredResponse.logs.length,3);
  assert.deepEqual(saved.history.at(-1).avgSceneTrace,turn.avgSceneTrace);
  const diagnosis = diagnoseAvgSceneSource(buildAvgSceneSourceEvidence(turn));
  assert.equal(diagnosis.code,avg ? 'scene-fields-present' : 'avg-disabled-at-request');
  if (avg) {
   const response = turn.structuredResponse;
   assert.deepEqual(response.avgSceneHints[0].分类,hint.分类);
   assert.ok(response.logs.every(log=>log.avgSceneRef === 'temple'));
   const scene = response.avgPresentation.scenes.find(scene=>scene.ref === 'temple');
   assert.ok(scene.image,name+' resolved image');
   assert.ok(catalog.scenes.some(asset=>asset.id === scene.assetId && asset.profile.空间 === '破庙内'),name+' real catalog asset');
   assert.deepEqual(saved.history.at(-1).structuredResponse.avgPresentation,response.avgPresentation);
  } else {
   assert.equal(turn.structuredResponse.avgSceneHints?.length || 0,0);
   // Disabled AVG omits model fields/protocol. Cached presentation may still
   // contain local approximate art, with the absent source classification preserved.
   assert.ok(turn.structuredResponse.avgPresentation.scenes.every(scene=>scene.profile.空间 === '未知'));
   assert.ok(turn.structuredResponse.avgPresentation.scenes.every(scene=>!scene.image || scene.reason === 'location-fallback'));
  }
  cases++;
 }
} finally {
 globalThis.fetch = originalFetch;
 console.error = originalErrors;
 delete globalThis.openingFixtureCatalog;
}
console.log('AVG opening request regression passed: '+cases+' normal/GPT/Tavern, AVG on/off, COT on/off and streaming cases; real HTTP payload, parsing, catalog matching, diagnostics and saved trace. No network or player-save writes.');
`;

// Replace persistence only; keep opening assembly, generation, HTTP client, parser and resolvers real.
const offlineStores = {name:'offline-opening-stores',setup(builder){
 builder.onResolve({filter:/services\/dbService$/},args=>args.importer.endsWith('openingStoryWorkflow.ts') ? {path:'db',namespace:'fixture'} : undefined);
 builder.onResolve({filter:/services\/novelDecompositionInjection$/},()=>({path:'novel',namespace:'fixture'}));
 builder.onResolve({filter:/services\/novelDecompositionCalibration$/},args=>args.importer.endsWith('openingStoryWorkflow.ts') ? {path:'calibration',namespace:'fixture'} : undefined);
 builder.onResolve({filter:/\/packStore$|^\.\/packStore$/},()=>({path:'catalog',namespace:'fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:{
  db:'export const 读取设置=async()=>undefined;export const 保存设置=async()=>{};',
  novel:'export const 获取开局小说拆分注入文本=async()=>"";export const 获取激活小说拆分注入文本=async()=>"";',
  calibration:'export const 同步剧情小说分解时间校准=async({nextStory})=>nextStory;',
  catalog:'export const getAvgPackCatalog=()=>globalThis.openingFixtureCatalog;export const loadAvgPackCatalog=async()=>{};'
 }[args.path]}));
}};
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[offlineStores]});
await mkdir('work/regression',{recursive:true});
const bundlePath = process.cwd()+'/work/regression/avgOpeningRequestRegression.bundle.mjs';
await writeFile(bundlePath,result.outputFiles[0].text);
await import(pathToFileURL(bundlePath).href);
