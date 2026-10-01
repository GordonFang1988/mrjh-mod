import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { buildAvgPresentation, inspectAvgSceneCandidates } from './services/avg/sceneResolver';
import { buildAvgKnownScenesPrompt } from './services/avg/sceneBindings';
import { normalizeAvgHints } from './services/avg/vocabulary';
import { readAvgSceneMarker, writeAvgSceneMarker, avgSceneSegmentRefs } from './services/avg/sceneProtocol';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { buildAvgSceneSourceEvidence } from './services/avg/sceneEvidence';
import { restoreStructuredAvgScenes } from './services/avg/missingArtRecovery';
import { 执行正文润色 } from './hooks/useGame/bodyPolish';

const env={大地点:'区域',中地点:'城镇',小地点:'建筑',具体地点:'房间'};
const logs=[{sender:'旁白',text:'测试。',avgSceneRef:'s1'}];
const asset=(id,profile,extra={})=>({id,version:1,image:'/'+id+'.webp',profile,...extra});
const resolve=(profile,assets,history=[],location=env,sceneId=undefined,theme=undefined)=>buildAvgPresentation(logs,[{ref:'s1',地点:location,场景ID:sceneId,分类:profile}],env as any,history as any,assets as any,{},theme).scenes[0];
for(const [wanted,available] of [
 [{空间:'药房',场所体系:'商旅',场所功能:'医馆'},{空间:'医馆内',场所体系:'商旅',场所功能:'医馆'}],
 [{空间:'铸剑房',场所体系:'商旅',场所功能:'铸剑坊'},{空间:'铁匠铺内',场所体系:'商旅',场所功能:'铁匠铺'}],
 [{空间:'地牢',场所体系:'官署',场所功能:'衙门'},{空间:'牢房',场所体系:'官署',场所功能:'牢狱'}],
 [{空间:'门派广场',场所体系:'世俗门派',场所功能:'门派'},{空间:'院落',场所体系:'世俗门派',场所功能:'门派'}],
 [{空间:'客舍',场所体系:'商旅',场所功能:'客栈'},{空间:'客栈客房',场所体系:'商旅',场所功能:'客栈'}],
 [{空间:'猎户小院',场所体系:'宅院',场所功能:'民居'},{空间:'院落',场所体系:'宅院',场所功能:'民居'}],
 [{空间:'山中茅屋内',场所体系:'宅院',场所功能:'民居'},{空间:'民居堂屋',场所体系:'宅院',场所功能:'民居'}],
 [{空间:'思过崖',场所体系:'世俗门派',场所功能:'门派'},{空间:'悬崖边',场所体系:'世俗门派',场所功能:'门派'}],
 [{空间:'石窟'},{空间:'洞内'}]
]){
 const selected=resolve(wanted,[asset('compatible',available)]);
 assert.equal(selected.assetId,'compatible');assert.deepEqual(selected.profile,wanted);
}
for(const [wanted,available] of [
 [{空间:'客栈客房',场所体系:'商旅',场所功能:'客栈'},{空间:'客栈大堂',场所体系:'商旅',场所功能:'客栈'}],
 [{空间:'茶馆',场所体系:'商旅',场所功能:'茶馆'},{空间:'厨房',场所体系:'商旅',场所功能:'酒楼'}],
 [{空间:'寺观外院',场所体系:'佛寺',场所功能:'寺庙'},{空间:'院落',场所体系:'道观',场所功能:'道观'}],
 [{空间:'室内演武厅',场所体系:'世俗门派',场所功能:'门派'},{空间:'露天练武场',场所体系:'世俗门派',场所功能:'门派'}],
 [{空间:'沙漠'},{空间:'树林'}], [{空间:'模型未收录空间'},{空间:'会客厅'}]
])assert.equal(resolve(wanted,[asset('incompatible',available)]).image,undefined);

for(const value of ['通用','未知','不适用']){
 const profile={空间:'牢房',场所体系:value,场所功能:value,地域:value};
 const selected=resolve(profile,[asset('jail',{空间:'牢房',场所体系:'官署',场所功能:'牢狱',地域:'华北'})]);
 assert.equal(selected.assetId,'jail');assert.deepEqual(selected.profile,profile);
}
const wanted={空间:'厢房',场所体系:'官署',场所功能:'衙门',地域:'华北',装潢档次:'简陋'};
assert.equal(resolve({空间:'铸剑房',场所体系:'商旅',场所功能:'铸剑坊'},[
 asset('metal',{空间:'铁匠铺内',场所体系:'商旅',场所功能:'铁匠铺'}),
 asset('general-craft',{空间:'铁匠铺内',场所体系:'商旅',场所功能:'工坊'})]).assetId,'metal');
const match=asset('correct',wanted,{styleFamily:'correct'});
const wrong=asset('wrong',{...wanted,地域:'江南',装潢档次:'奢华'},{styleFamily:'previous',themeId:'tianlong'});
const previous=resolve({空间:'厢房'},[asset('previous',{空间:'厢房'},{styleFamily:'previous'})],[],{...env,具体地点:'另一间'});
const history=[{role:'assistant',content:'',timestamp:1,structuredResponse:{logs,avgPresentation:{schemaVersion:1,mode:'multi',scenes:[previous]}}}];
assert.equal(resolve(wanted,[match,wrong,asset('previous',{空间:'厢房'},{styleFamily:'previous'})],history,env,undefined,'tianlong').assetId,'correct');
assert.equal(inspectAvgSceneCandidates(wanted,[match,wrong]).counts.afterProfilePreference,1);
assert.equal(resolve({空间:'厢房'},[asset('general',{空间:'厢房'}),asset('theme',{空间:'厢房'},{themeId:'tianlong'})],[],env,undefined,'tianlong').assetId,'theme');

const id='scene:'+('很长的稳定身份'.repeat(100));
const longLocation={...env,具体地点:'房间名称'.repeat(100)};
const normalized=normalizeAvgHints([{ref:'room_1',场景ID:id,地点:longLocation,分类:wanted}])[0];
assert.equal(normalized.场景ID,id);assert.deepEqual(normalized.地点,longLocation);
const first=resolve(wanted,[match],[],null,id);
const idHistory=[{role:'assistant',timestamp:1,content:'',structuredResponse:{logs,avgPresentation:{schemaVersion:1,mode:'multi',scenes:[first]}}}];
assert.equal(resolve(undefined,[],idHistory,null,id).image,first.image);
assert.ok(!buildAvgKnownScenesPrompt(idHistory as any).includes('transient:'));
const partial={大地点:'区域',中地点:'城镇',小地点:'建筑'};
const unlocated=resolve(wanted,[match],[],partial);
assert.ok(unlocated.placeKey.startsWith('transient:'));
assert.equal(unlocated.sceneId,undefined);
const partialHistory=[{...idHistory[0],structuredResponse:{logs,avgPresentation:{schemaVersion:1,mode:'multi',scenes:[unlocated]}}}];
assert.equal(resolve({空间:'茶馆'},[asset('tea',{空间:'茶馆'})],partialHistory,partial).assetId,'tea');

for(const ref of ['s100','room_1','中文镜头','with"quote&<tag>'])assert.equal(readAvgSceneMarker(writeAvgSceneMarker(ref)),ref);
assert.equal(readAvgSceneMarker('<镜头 ref="s1\'/>'),undefined);
assert.deepEqual(avgSceneSegmentRefs([{avgSceneRef:'s1'},{},{avgSceneRef:'s1'}]),['s1',null,'s1']);
const resetBody='<镜头 ref="s1"/>\n【旁白】第一段\n<镜头/>\n【旁白】中性段\n<镜头 ref="s100"/>\n【旁白】最后一段';
for(const body of [resetBody,'<正文>'+resetBody+'</正文>'])assert.deepEqual(parseStoryRawText(body).logs.map(l=>l.avgSceneRef),['s1',undefined,'s100']);
const inlineBody=resetBody.replace(/\n/g,'');
const inlineLogs=parseStoryRawText('<正文>'+inlineBody+'</正文>').logs;
assert.deepEqual(inlineLogs.map(l=>l.avgSceneRef),['s1',undefined,'s100']);
assert.deepEqual(inlineLogs.map(l=>l.text),['第一段','中性段','最后一段']);
assert.deepEqual(parseStoryRawText('<正文>【旁白】前文<镜头 ref="room_1"/>【旁白】后文</正文>').logs.map(l=>l.avgSceneRef),[undefined,'room_1']);
const hints=Array.from({length:120},(_,i)=>({ref:'s'+(i+1),分类:{空间:'厢房'}}));
const raw='<正文>'+hints.map(h=>writeAvgSceneMarker(h.ref)+'\n【旁白】测试。').join('\n')+'</正文><演出场景>'+JSON.stringify({场景:hints})+'</演出场景>';
const parsed=parseStoryRawText(raw);assert.equal(parsed.avgSceneHints.length,120);assert.equal(parsed.logs.at(-1).avgSceneRef,'s120');
const jsonRaw=JSON.stringify({logs:[{sender:'旁白',text:'字面提及<演出场景>标签，并非场景块。',avgSceneRef:'room_1'}],avgSceneHints:[normalized],tavern_commands:[{action:'set',key:'环境.时间',value:'1110:03:01:12:00'}]});
const json=parseStoryRawText(jsonRaw);assert.equal(json.avgSceneHints[0].场景ID,id);assert.equal(json.logs[0].avgSceneRef,'room_1');assert.equal(json.tavern_commands.length,1);
const evidence=buildAvgSceneSourceEvidence({role:'assistant',content:'',timestamp:1,rawJson:jsonRaw,structuredResponse:json} as any);
assert.equal(evidence.wireFormat,'json');assert.equal(evidence.rawSceneBlockCount,0);assert.equal(evidence.jsonPayload.sceneCount,1);
assert.throws(()=>parseStoryRawText(jsonRaw,{validateTagCompleteness:true,enableTagRepair:false}));

const neutral={ref:'s2',sceneId:'second',placeKey:'区域/城镇/建筑/第二间',label:'第二间',profile:{空间:'未知'},reason:'neutral-background'};
const manual={...first,ref:'s1',reason:'manual-neutral',assetId:undefined,image:undefined};
const mixed={logs:[...logs,{sender:'旁白',text:'第二间',avgSceneRef:'s2'}],avgSceneHints:[{ref:'s1',地点:env,分类:wanted},{ref:'s2',地点:{...env,具体地点:'第二间'},分类:wanted}],avgPresentation:{schemaVersion:1,mode:'multi',diagnostic:'invalid-scene-timeline',scenes:[manual,neutral]}};
const restored=restoreStructuredAvgScenes(mixed as any,[],[match]);assert.equal(restored.scenes[0],manual);assert.equal(restored.scenes[1].assetId,'correct');

const deps={apiConfig:{},gameConfig:{},prompts:[],环境:env,剧情:{},社交:[],战斗:{},角色:{姓名:'测试'},文章优化已开启:true,深拷贝:structuredClone};
const polishLogs=[{sender:'旁白',text:'第一段',avgSceneRef:'s1'},{sender:'旁白',text:'中性段'},{sender:'旁白',text:'最后一段',avgSceneRef:'s100'}];
const response={logs:polishLogs,avgSceneHints:[{ref:'s1',分类:wanted},{ref:'s100',分类:wanted}]};
globalThis.polishFixture={body:null,input:''};
const kept=await 执行正文润色(response as any,'',deps as any);assert.equal(kept.applied,true);assert.deepEqual(kept.response.logs.map(l=>l.avgSceneRef),['s1',undefined,'s100']);
assert.ok(globalThis.polishFixture.input.includes('<镜头/>'));
globalThis.polishFixture.body=inlineBody;
const inlinePolish=await 执行正文润色(response as any,'',deps as any);assert.equal(inlinePolish.applied,true);assert.deepEqual(inlinePolish.response.logs.map(l=>l.avgSceneRef),['s1',undefined,'s100']);
globalThis.polishFixture.body=globalThis.polishFixture.input.replace('<镜头/>','');
const lost=await 执行正文润色(response as any,'',deps as any);assert.equal(lost.applied,false);assert.equal(lost.response,response);
globalThis.polishFixture.body=null;
const many=await 执行正文润色({...response,logs:parsed.logs} as any,'',deps as any);assert.equal(many.applied,true);assert.equal(many.response.logs.at(-1).avgSceneRef,'s120');
console.log('AVG mechanism regression passed: compatible rooms, safe exclusions, unknown fields, metadata priority, identities, 120 scenes, JSON and real polish boundary preservation');
`;
const mocks={name:'offline-polish-fixture',setup(builder){
 builder.onResolve({filter:/services\/ai\/text$/},args=>args.importer.endsWith('bodyPolish.ts')?{path:'text',namespace:'fixture'}:undefined);
 builder.onResolve({filter:/utils\/apiConfig$/},args=>args.importer.endsWith('bodyPolish.ts')?{path:'api',namespace:'fixture'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path==='text'
  ? 'export const generatePolishedBody=async(input)=>{globalThis.polishFixture.input=input;return {bodyText:globalThis.polishFixture.body??input,rawText:"offline fixture"}};'
  : 'export const 获取文章优化接口配置=()=>({model:"offline"});export const 接口配置是否可用=()=>true;'}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[mocks]});
await mkdir('work/regression',{recursive:true});
await writeFile('work/regression/avgSceneMechanismRegression.bundle.mjs',result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/work/regression/avgSceneMechanismRegression.bundle.mjs').href);
