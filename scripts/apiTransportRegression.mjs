import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const entry = `export * from './services/ai/apiTransport'; export * from './services/ai/modelList';
export { 请求模型文本 } from './services/ai/chatCompletionClient';
export { generateStoryResponse, generateMemoryRecall, testConnection } from './services/ai/storyTasks';
export { 规范化接口设置, 获取当前接口配置, 获取变量计算接口配置, 获取世界演变接口配置, 获取规划分析接口配置, 获取文章优化接口配置 } from './utils/apiConfig';`;
const built = await build({stdin:{contents:entry,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
const bundle = process.cwd()+'/work/regression/apiTransportRegression.bundle.mjs';
await writeFile(bundle,built.outputFiles[0].text);
const moduleUrl = pathToFileURL(bundle).href;
const apiModule = await import(moduleUrl);
const { requestApi, OPENCODE_PROXY_URL, fetchApiModels, modelListUrls, 请求模型文本, generateStoryResponse, generateMemoryRecall, testConnection, 规范化接口设置, 获取当前接口配置, 获取变量计算接口配置, 获取世界演变接口配置, 获取规划分析接口配置, 获取文章优化接口配置 } = apiModule;
const originalFetch = globalThis.fetch;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis,'navigator');
const values = new Map();
const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
// Emulate the browser lock callback; native Web Locks are also exercised in the browser fixture.
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:async(_key,callback)=>callback()}}});
const ctx = {apiProfileId:'offline-profile-a'};
const url = 'https://opencode.ai/zen/go/v1/chat/completions';
const fakeAuth = 'Bearer offline-fixture';
const baseConfig = {id:ctx.apiProfileId,名称:'offline',供应商:'openai_compatible',协议覆盖:'auto',baseUrl:'https://opencode.ai/zen/go/v1',apiKey:'offline-fixture',model:'deepseek-v4-flash',temperature:0.45,maxTokens:1536};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const calls = [];
const capture = async (target, init) => {calls.push({target,init});return Response.json({choices:[{message:{content:'OK'}}]});};
try {
 globalThis.fetch = capture;
 const controller = new AbortController();
 const body = JSON.stringify({model:'offline',messages:[{role:'user',content:'offline fixture'}],max_tokens:1536,temperature:0.45});
 for (const headers of [new Headers({Authorization:fakeAuth,'Content-Type':'application/json',Accept:'text/event-stream'}),{Authorization:fakeAuth,'Content-Type':'application/json',Accept:'text/event-stream'},[['Authorization',fakeAuth],['Content-Type','application/json'],['Accept','text/event-stream']]]) {
  const init = {method:'POST',headers,body,signal:controller.signal,cache:'no-store'};
  const response = await requestApi(url,init,ctx);
  assert.equal(response.bodyUsed,false);
  const last = calls.at(-1);
  assert.equal(last.target,OPENCODE_PROXY_URL);
  for (const key of ['method','body','signal','cache']) assert.equal(last.init[key],init[key]);
  assert.equal(last.init.headers.get('Authorization'),fakeAuth);
  assert.equal(last.init.headers.get('Content-Type'),'application/json');
  assert.equal(last.init.headers.get('Accept'),'text/event-stream');
  assert.equal(last.init.headers.get('X-LLM-Target-URL'),url);
  assert.match(last.init.headers.get('x-opencode-session'),uuid);
  assert.equal(new Headers(headers).has('X-LLM-Target-URL'),false);
 }
 const session = calls[0].init.headers.get('x-opencode-session');
 assert.ok(calls.every(call=>call.init.headers.get('x-opencode-session')===session));
 const refreshed = await import(moduleUrl+'?refresh');
 await refreshed.requestApi(url,{},ctx);
 assert.equal(calls.at(-1).init.headers.get('x-opencode-session'),session);
 await requestApi(url,{}, {apiProfileId:'offline-profile-b'});
 assert.notEqual(calls.at(-1).init.headers.get('x-opencode-session'),session);
 const beforeExplicit = values.size;
 await requestApi(url,{headers:{'x-opencode-session':'existing-app-session'}},ctx);
 assert.equal(calls.at(-1).init.headers.get('x-opencode-session'),'existing-app-session');
 await requestApi(url,{headers:{'x-opencode-session':'existing-app-session'}},{...ctx,sessionId:'real-save-session'});
 assert.equal(calls.at(-1).init.headers.get('x-opencode-session'),'real-save-session');
 assert.equal(values.size,beforeExplicit);
 for (const target of ['https://api.deepseek.com/v1/chat/completions','https://opencode.ai.example.com/v1','https://sub.opencode.ai/v1','https://other.example/opencode.ai?host=opencode.ai','https://opencode.ai@other.example/v1','/api/local']) {
  const init = {method:'GET',headers:{Accept:'application/json'},signal:controller.signal};
  await requestApi(target,init,ctx);
  assert.equal(calls.at(-1).target,target);
  assert.equal(calls.at(-1).init,init);
 }
 const beforeInsecure = calls.length;
 await assert.rejects(requestApi('http://opencode.ai/zen/go/v1',{},ctx),/HTTPS/);
 assert.equal(calls.length,beforeInsecure);
 const beforeMissing = calls.length;
 await assert.rejects(requestApi(url),/档案标识/);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw new Error('blocked');}}});
 await assert.rejects(requestApi(url,{},ctx),/持久保存/);
 assert.equal(calls.length,beforeMissing);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 for (const native of ['https://opencode.ai/zen/v1/responses','https://opencode.ai/zen/go/v1/messages','https://opencode.ai/zen/v1/models/gemini-model:generateContent','https://opencode.ai/zen/v1/responses?region=test']) {
  calls.length=0;
  await 请求模型文本({...baseConfig,baseUrl:native,model:'glm-offline'},[{role:'user',content:'offline fixture'}],{temperature:0.7});
  assert.equal(calls[0].init.headers.get('X-LLM-Target-URL'),native);
 }
 for (const model of ['deepseek-v4-flash','glm-5','glm-5.3']) {
  for (const baseUrl of [baseConfig.baseUrl,baseConfig.baseUrl+'/',url,baseConfig.baseUrl+'?region=test',baseConfig.baseUrl+'/?region=test',url+'?region=test']) {
   calls.length=0;
   const result=await 请求模型文本({...baseConfig,baseUrl,model},[{role:'user',content:'offline fixture'}],{temperature:0.7,signal:controller.signal});
   assert.equal(result,'OK');
   const sent=calls[0];
   assert.equal(sent.target,OPENCODE_PROXY_URL);
   assert.equal(sent.init.headers.get('X-LLM-Target-URL'),url+(baseUrl.includes('?')?'?region=test':''));
   assert.equal(sent.init.headers.get('x-opencode-session'),session);
   assert.equal(sent.init.signal,controller.signal);
   const payload=JSON.parse(sent.init.body);
   assert.equal(payload.model,model);assert.equal(payload.temperature,0.45);assert.equal(payload.max_tokens,1536);
   assert.equal(payload.stream,false);
  }
 }
 calls.length=0;
 await 请求模型文本({...baseConfig,供应商:'zhipu',baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-5'},[{role:'user',content:'offline fixture'}],{temperature:0.7});
 assert.equal(calls[0].target,'https://open.bigmodel.cn/api/paas/v4/chat/completions');
 assert.equal(calls[0].init.headers['Authorization'],fakeAuth);
 assert.deepEqual(modelListUrls('https://other.example/v1'),['https://other.example/v1/models','https://other.example/models']);
 for (const base of [baseConfig.baseUrl,baseConfig.baseUrl+'/',url,'https://opencode.ai/zen/go/v1/messages']) assert.deepEqual(modelListUrls(base),['https://opencode.ai/zen/go/v1/models']);
 for (const base of [baseConfig.baseUrl+'/?region=test',url+'?region=test']) assert.deepEqual(modelListUrls(base),['https://opencode.ai/zen/go/v1/models?region=test']);
 calls.length=0;
 globalThis.fetch=async(target,init)=>{calls.push({target,init});return Response.json({data:[{id:'deepseek-v4-flash'},{id:'glm-5'}]});};
 assert.deepEqual(await fetchApiModels(baseConfig.baseUrl,{headers:{Authorization:fakeAuth}},ctx),['deepseek-v4-flash','glm-5']);
 assert.equal(calls.length,1);assert.equal(calls[0].target,OPENCODE_PROXY_URL);
 assert.equal(calls[0].init.headers.get('X-LLM-Target-URL'),'https://opencode.ai/zen/go/v1/models');
 assert.equal(calls[0].init.headers.get('x-opencode-session'),session);

 // The original retry policy remains authoritative: 401 is terminal; 429 and 5xx retry via the proxy.
 for (const [status,expectedCalls] of [[401,1],[429,3],[500,3],[503,3]]) {
  calls.length=0;
  globalThis.fetch=async(target,init)=>{calls.push({target,init});return new Response('offline upstream error',{status});};
  await assert.rejects(请求模型文本(baseConfig,[{role:'user',content:'offline fixture'}],{temperature:0.7}),error=>error.status===status);
  assert.equal(calls.length,expectedCalls);
  assert.ok(calls.every(call=>call.target===OPENCODE_PROXY_URL && call.init.headers.get('x-opencode-session')===session));
  calls.length=0;
  await assert.rejects(fetchApiModels(baseConfig.baseUrl,{headers:{Authorization:fakeAuth}},ctx),new RegExp('HTTP '+status));
  assert.equal(calls.length,1);assert.equal(calls[0].target,OPENCODE_PROXY_URL);
  const original=new Response('offline error',{status});
  globalThis.fetch=async()=>original;
  assert.equal(await requestApi(url,{},ctx),original);
  assert.equal(original.bodyUsed,false);
 }
 calls.length=0;
 globalThis.fetch=async(target,init)=>{calls.push({target,init});throw new TypeError('Failed to fetch');};
 await assert.rejects(requestApi(url,{},ctx),/OpenCode 代理请求失败/);
 assert.equal(calls.length,1);assert.equal(calls[0].target,OPENCODE_PROXY_URL);

 // Delay the end of the response; the existing SSE parser must expose the first frame immediately.
 let finish;
 let firstDelta;
 let finished=false;
 const first=new Promise(resolve=>{firstDelta=resolve;});
 const encoder=new TextEncoder();
 const frame=text=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n';
 globalThis.fetch=async(target,init)=>{
  assert.equal(target,OPENCODE_PROXY_URL);assert.equal(JSON.parse(init.body).stream,true);
  return new Response(new ReadableStream({start(stream){
   stream.enqueue(encoder.encode(frame('首段')));
   finish=()=>{stream.enqueue(encoder.encode(frame('末段')+'data: [DONE]\n\n'));stream.close();};
  }}),{headers:{'Content-Type':'text/event-stream'}});
 };
 const streaming=请求模型文本(baseConfig,[{role:'user',content:'offline fixture'}],{temperature:0.7,streamOptions:{stream:true,onDelta:delta=>firstDelta(delta)}}).then(text=>{finished=true;return text;});
 const timeout=setTimeout(()=>firstDelta('timeout'),2000);
 try {assert.equal(await first,'首段');assert.equal(finished,false);finish();assert.equal(await streaming,'首段末段');} finally {clearTimeout(timeout);}
 const canceled=new AbortController();
 calls.length=0;
 globalThis.fetch=async(target,init)=>{
  calls.push({target,init});
  return new Response(new ReadableStream({start(stream){
   stream.enqueue(encoder.encode(frame('开始')));
   init.signal.addEventListener('abort',()=>stream.error(new DOMException('The operation was aborted.','AbortError')),{once:true});
  }}),{headers:{'Content-Type':'text/event-stream'}});
 };
 await assert.rejects(请求模型文本(baseConfig,[{role:'user',content:'offline fixture'}],{temperature:0.7,signal:canceled.signal,streamOptions:{stream:true,onDelta:()=>canceled.abort()}}),error=>error.name==='AbortError');
 assert.equal(calls.length,1);assert.equal(calls[0].init.signal,canceled.signal);

 // Representative main, auxiliary and connection-test callers use the same transport and profile.
 calls.length=0;
 const storyRaw='<正文>【旁白】离线测试。</正文>';
 globalThis.fetch=async(target,init)=>{calls.push({target,init});return Response.json({choices:[{message:{content:calls.length===1?storyRaw:'OK'}}]});};
 const story=await generateStoryResponse('','','',baseConfig,undefined,undefined,undefined,{orderedMessages:[{role:'user',content:'offline fixture'}],enableTagRepair:false});
 assert.equal(story.rawText,storyRaw);
 await generateMemoryRecall('offline system','offline fixture',baseConfig);
 assert.equal((await testConnection(baseConfig)).ok,true);
 assert.equal(calls.length,3);
 assert.ok(calls.every(call=>call.target===OPENCODE_PROXY_URL && call.init.headers.get('x-opencode-session')===session));
 const normalized=规范化接口设置({activeConfigId:baseConfig.id,configs:[baseConfig],功能模型占位:{变量计算独立模型开关:true,变量计算使用模型:'glm-5',世界演变独立模型开关:true,世界演变使用模型:'deepseek-v4-flash',规划分析独立模型开关:true,规划分析使用模型:'glm-5',文章优化独立模型开关:true,文章优化使用模型:'glm-5'}});
 const roundtrip=规范化接口设置(JSON.parse(JSON.stringify(normalized)));
 assert.deepEqual(roundtrip.configs,normalized.configs);
 assert.equal(roundtrip.activeConfigId,normalized.activeConfigId);
 for (const getter of [获取当前接口配置,获取变量计算接口配置,获取世界演变接口配置,获取规划分析接口配置,获取文章优化接口配置]) assert.equal(getter(normalized).id,baseConfig.id);
 assert.ok([...values.entries()].filter(([key])=>key.startsWith('mrjh-opencode-api-session:v1:')).every(([,value])=>uuid.test(value)));
 console.log('API transport regression passed: exact-host routing, preserved init/Response, profile UUID reload/retries, Go GLM/DeepSeek endpoints, native endpoint preservation, model lists, 401/429/5xx, cancellation, incremental SSE, shared task calls and legacy config roundtrip. No network or real credentials.');
} finally {
 globalThis.fetch=originalFetch;
 if(storageDescriptor) Object.defineProperty(globalThis,'localStorage',storageDescriptor); else delete globalThis.localStorage;
 if(navigatorDescriptor) Object.defineProperty(globalThis,'navigator',navigatorDescriptor); else delete globalThis.navigator;
}
