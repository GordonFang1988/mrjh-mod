import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const built=await build({stdin:{contents:`
export { 请求模型文本 } from './services/ai/chatCompletionClient';
export { beginApiDiagnostic, exportApiDiagnostics, API_DIAGNOSTIC_LIMIT } from './services/ai/apiDiagnostics';
export { generatePlanningAnalysis, generateWorldEvolutionUpdate } from './services/ai/storyTasks';
export { buildAvgDiagnostic } from './services/avg/diagnostics';
`,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
const output=process.cwd()+'/work/regression/apiDiagnosticsRegression.bundle.mjs';
await writeFile(output,built.outputFiles[0].text);
const url=pathToFileURL(output).href;
const values=new Map();
const original={fetch:globalThis.fetch,performance:Object.getOwnPropertyDescriptor(globalThis,'performance'),
 storage:Object.getOwnPropertyDescriptor(globalThis,'localStorage'),navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),setTimeout:globalThis.setTimeout};
let tick=0;
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>tick}});
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});
const secret='sk-proj-diagnostic-fixture-secret-12345678';
const config={id:'fixture',供应商:'openai_compatible',model:'offline-model',baseUrl:'https://user:password@api.example/v1?api_key='+secret,apiKey:secret,maxTokens:2048};
const messages=[{role:'user',content:'PRIVATE PROMPT '+secret}];
const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
const stream=(events,signal)=>new Response(new ReadableStream({
 pull(controller){
  if(signal?.aborted){controller.error(new DOMException('cancelled','AbortError'));return;}
  const event=events.shift();
  if(!event){controller.close();return;}
  tick+=event.delay;controller.enqueue(new TextEncoder().encode(event.text));
 }
},{highWaterMark:0}),{headers:{'content-type':'text/event-stream'}});
try {
 const api=await import(url);
 globalThis.fetch=async(_url,init)=>{
  const payload=JSON.parse(init.body);assert.equal(payload.stream,true);tick+=30;
  return stream([
   {delay:10,text:': heartbeat\n\n'},
   {delay:20,text:frame({choices:[{delta:{role:'assistant'}}]})},
   {delay:200,text:frame({choices:[{delta:{reasoning_content:'想'}}]})},
   {delay:500,text:frame({choices:[{delta:{content:'你好'}}]})},
   {delay:100,text:frame({choices:[{delta:{content:'世界'},finish_reason:'stop'}]})},
   {delay:50,text:frame({choices:[],usage:{prompt_tokens:100,completion_tokens:20,completion_tokens_details:{reasoning_tokens:14}}})},
   {delay:0,text:'data: [DONE]\n\n'}
  ],init.signal);
 };
 const text=await api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'planning',streamOptions:{stream:true}});
 assert.equal(text,'<think>想</think>你好世界');
 let call=api.exportApiDiagnostics().calls.at(-1),attempt=call.attempts[0];
 assert.equal(call.task,'planning');assert.equal(call.endpointOrigin,'https://api.example');
 assert.equal(attempt.headersMs,30);assert.equal(attempt.firstByteMs,40);
 assert.equal(attempt.firstOutputMs,260);assert.equal(attempt.firstReasoningMs,260);assert.equal(attempt.firstContentMs,760);
 assert.equal(attempt.lastOutputMs,860);assert.equal(attempt.generationMs,600);
 assert.equal(attempt.outputChars,5);assert.equal(attempt.reasoningChars,1);assert.equal(attempt.contentChars,4);
 assert.equal(attempt.charsPerSecond,8.3);
 assert.deepEqual(attempt.usage,{inputTokens:100,outputTokens:20,reasoningTokens:14});
 assert.equal(call.durationMs,910);
 assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes(secret));
 assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('PRIVATE PROMPT'));
 assert.ok(!JSON.stringify(values.get('mrjh-api-diagnostics:v1')).includes(secret));
 assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('你好'));
 assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('password'));

 let posts=0;
 globalThis.fetch=async()=>{posts++;tick+=400;return Response.json({choices:[{message:{content:'buffered'}}],usage:{prompt_tokens:5,completion_tokens:2}});};
 assert.equal(await api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'world-evolution',streamOptions:{stream:true}}),'buffered');
 assert.equal(posts,1);call=api.exportApiDiagnostics().calls.at(-1);attempt=call.attempts[0];
 assert.equal(call.fallbackCount,1);assert.equal(attempt.actualStream,false);
 assert.equal(attempt.firstOutputMs,undefined);assert.equal(attempt.charsPerSecond,undefined);
 assert.equal(attempt.firstOutputMeasured,false);
 await api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'polish'});
 assert.equal(api.exportApiDiagnostics().calls.at(-1).attempts[0].firstOutputMs,undefined);

 // Endpoints explicitly rejecting streams retain the original non-stream retry path.
 posts=0;
 globalThis.fetch=async(_url,init)=>{
  posts++;
  const payload=JSON.parse(init.body);
  if(posts===1){assert.equal(payload.stream,true);return new Response('stream is not supported',{status:400});}
  assert.equal(payload.stream,false);
  return Response.json({choices:[{message:{content:'compatible reply'}}]});
 };
 assert.equal(await api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'planning',streamOptions:{stream:true}}),'compatible reply');
 call=api.exportApiDiagnostics().calls.at(-1);
 assert.equal(posts,2);assert.equal(call.retryCount,0);assert.equal(call.fallbackCount,1);
 assert.deepEqual(call.attempts.map(a=>a.status),['fallback','success']);
 assert.equal(call.attempts[0].httpStatus,400);assert.equal(call.attempts[1].actualStream,false);
 assert.equal(call.attempts[1].firstOutputMs,undefined);

 globalThis.fetch=async()=>new Response('PRIVATE SERVER ERROR '+secret,{status:401});
 await assert.rejects(api.请求模型文本(config,messages,{temperature:0.3}),e=>e.status===401);
 call=api.exportApiDiagnostics().calls.at(-1);
 assert.equal(call.status,'error');assert.equal(call.retryCount,0);assert.equal(call.attempts[0].httpStatus,401);
 assert.ok(!JSON.stringify(api.exportApiDiagnostics()).includes('PRIVATE SERVER ERROR'));
 globalThis.setTimeout=(fn,ms,...args)=>{tick+=ms;return original.setTimeout(fn,0,...args);};
 posts=0;
 globalThis.fetch=async()=>++posts===1?new Response('retry',{status:429}):Response.json({choices:[{message:{content:'ok'}}]});
 await api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'variable'});
 call=api.exportApiDiagnostics().calls.at(-1);
 assert.equal(call.status,'success');assert.equal(call.retryCount,1);assert.equal(call.attempts.length,2);
 assert.ok(call.retryWaitMs>=800);assert.equal(call.attempts[0].status,'error');

 const controller=new AbortController();
 globalThis.fetch=async(_url,init)=>stream([{delay:1,text:frame({choices:[{delta:{content:'one'}}]})},{delay:1,text:frame({choices:[{delta:{content:'two'}}]})}],init.signal);
 await assert.rejects(api.请求模型文本(config,messages,{temperature:0.3,signal:controller.signal,streamOptions:{stream:true,onDelta:()=>controller.abort()}}),e=>e.name==='AbortError');
 call=api.exportApiDiagnostics().calls.at(-1);
 assert.equal(call.status,'cancelled');assert.equal(call.retryCount,0);assert.equal(call.attempts[0].status,'cancelled');

 // Real auxiliary tasks request a stream, but still return only complete parsed results.
 globalThis.fetch=async(_url,init)=>{
  assert.equal(JSON.parse(init.body).stream,true);
  return stream([{delay:25,text:frame({choices:[{delta:{content:'<说明>无需更新</说明><命令>[]</命令>'}}]})},{delay:1,text:'data: [DONE]\n\n'}]);
 };
 await api.generatePlanningAnalysis({playerName:'测试',currentStoryJson:'{}',currentHeroinePlanJson:'{}',worldJson:'{}',socialJson:'[]',envJson:'{}',recentBodiesText:'',auditFocusText:''},config);
 assert.equal(api.exportApiDiagnostics().calls.at(-1).task,'planning');
 await api.generateWorldEvolutionUpdate('{}',config);
 assert.equal(api.exportApiDiagnostics().calls.at(-1).task,'world-evolution');

 // Independent calls remain separate, including currently pending requests.
 let unblock;
 globalThis.fetch=()=>new Promise(resolve=>{unblock=()=>resolve(Response.json({choices:[{message:{content:'done'}}]}));});
 const pending=api.请求模型文本(config,messages,{temperature:0.3,diagnosticTask:'recall'});
 call=api.exportApiDiagnostics().calls.at(-1);
 assert.equal(call.status,'running');assert.equal(call.live,true);assert.equal(call.attempts.length,1);
 unblock();await pending;

 const history=Array.from({length:100},(_,index)=>({role:'assistant',timestamp:index+1,content:'OLDER PRIVATE TURN '+index,
  rawJson:'',structuredResponse:{logs:[{sender:'旁白',text:'unused'}],avgPresentation:{schemaVersion:1,mode:'final',
  scenes:[{ref:'final',placeKey:'地区/县城/屋'+index+'/室',label:'屋'+index,profile:{空间:'书房'},reason:'manual-neutral'}]}}}));
 globalThis.document={querySelectorAll:()=>[]};
 globalThis.location={origin:'https://fixture.example',pathname:'/'};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'offline'}});globalThis.innerWidth=1280;globalThis.innerHeight=720;
 const report=await api.buildAvgDiagnostic({history,social:[],environment:{大地点:'地区',中地点:'县城',小地点:'屋',具体地点:'室'}});
 assert.equal(report.schema,'mrjh-diagnostic-v3');assert.equal(report.recentTurns.length,10);
 assert.deepEqual(report.recentTurns.map(t=>t.timestamp),[91,92,93,94,95,96,97,98,99,100]);
 assert.equal(report.historyWindow.omittedAssistantTurns,90);
 assert.ok(report.latestTurn.bindingReuse.knownBindings.length<=20);
 assert.equal(report.latestTurn.bindingReuse.knownBindingsTruncated,true);
 assert.ok(!JSON.stringify(report).includes('OLDER PRIVATE TURN'));
 assert.ok(!JSON.stringify(report).includes('屋0'));
 assert.ok(!JSON.stringify(report).includes(secret));

 // Retention is bounded before export and survives reload; arbitrary persisted fields are ignored.
 for(let i=0;i<70;i++){
  const metric=api.beginApiDiagnostic({task:'connection-test',model:'fixture',endpoint:'https://example/v1?token='+secret,
   proxied:false,inputChars:1,messageCount:1,requestedStream:false});metric.finish();
 }
 let log=api.exportApiDiagnostics();
 assert.equal(log.calls.length,60);assert.ok(log.omitted>=10);
 assert.equal(JSON.parse(values.get('mrjh-api-diagnostics:v1')).records.length,60);
 const stored=JSON.parse(values.get('mrjh-api-diagnostics:v1'));
 stored.records.at(-1).apiKey=secret;stored.records.at(-1).prompt='PRIVATE STORED PROMPT';
 stored.records.at(-1).inputBreakdown={version:1,budgetChars:48000,sections:[
  {name:'world',sourceChars:100,sentChars:20,prompt:'PRIVATE STORED PROMPT',apiKey:secret},
  {name:secret,sourceChars:99,sentChars:99}],
  details:[{name:'novel',sourceChars:1000,sentChars:400,payload:secret}]};
 values.set('mrjh-api-diagnostics:v1',JSON.stringify(stored));
 const reloaded=await import(url+'?reload');
 log=reloaded.exportApiDiagnostics();
 assert.equal(log.calls.length,60);assert.ok(!JSON.stringify(log).includes('PRIVATE STORED PROMPT'));assert.ok(!JSON.stringify(log).includes(secret));
 assert.equal(log.calls.at(-1).inputBreakdown.sections.length,1);
 assert.equal(log.calls.at(-1).inputBreakdown.details[0].name,'novel');
 assert.equal(log.calls.at(-1).inputBreakdown.details[0].sourceChars,1000);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}}});
 const unavailable=await import(url+'?storage-blocked');
 const metric=unavailable.beginApiDiagnostic({model:'fixture',endpoint:'https://example',proxied:false,inputChars:1,messageCount:1,requestedStream:false});metric.finish();
 assert.equal(unavailable.exportApiDiagnostics().storageAvailable,false);
 console.log('API diagnostics passed: measured headers/bytes/reasoning/content, real usage, buffered reply reused, retries/cancellation, auxiliary streams, 10 recent turns, 60-call retention/reload, storage failure and secret exclusion.');
} finally {
 globalThis.fetch=original.fetch;globalThis.setTimeout=original.setTimeout;
 if(original.performance)Object.defineProperty(globalThis,'performance',original.performance);
 if(original.storage)Object.defineProperty(globalThis,'localStorage',original.storage);else delete globalThis.localStorage;
 if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);
}
