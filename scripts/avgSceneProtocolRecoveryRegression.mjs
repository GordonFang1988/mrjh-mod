import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readAvgSceneMarker, scanAvgSceneMarkers, normalizeAvgSceneLogs, avgSceneSegmentRefs, writeAvgSceneMarker } from './services/avg/sceneProtocol';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { buildAvgPresentation } from './services/avg/sceneResolver';
import { restoreAvgSceneProtocol, recoverMissingAvgArt } from './services/avg/missingArtRecovery';
import { buildAvgSceneSourceEvidence, diagnoseAvgSceneDisplay } from './services/avg/sceneEvidence';
import { parseAvgManifest } from './services/avg/manifest';
import { 执行正文润色 } from './hooks/useGame/bodyPolish';

const diagnostic=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')):undefined;
const env={大地点:'大理国',中地点:'无量山',小地点:'剑湖宫外围',具体地点:'大门外'};
const profiles=[{空间:'密道',地域:'西南'},{空间:'峡谷',地域:'西南',水域:'江河'},{空间:'门派前庭',地域:'西南',场所体系:'世俗门派',完好程度:'毁坏'}];
const hints=diagnostic?.latestTurn.hints || profiles.map((分类,index)=>({ref:'s'+(index+1),地点:{...env,具体地点:分类.空间},分类}));
const logs=diagnostic?.latestTurn.sourceEvidence.logs.map(({sender,text})=>({sender,text})) || [
 {sender:'旁白',text:'【镜头 ref="s1"/>'}, {sender:'旁白',text:'沿暗道前进。\n\n【镜头 ref="s2"/>'},
 {sender:'甲',text:'走到了江边。\n\n【镜头 ref="s3"/>'}, {sender:'旁白',text:'门前已经荒废。'}
];
const known=['s1','s2','s3'];
const plain=text=>text.replace(/\s/g,'');
const normalized=normalizeAvgSceneLogs(logs);
assert.deepEqual(avgSceneSegmentRefs(normalized),known);
assert.equal(normalized.length,logs.length-1);
assert.ok(normalized.every(log=>!scanAvgSceneMarkers(log.text).length));
assert.equal(normalizeAvgSceneLogs(normalized),normalized);
const expectedText=logs.map(log=>{
 let text=log.text; for(const token of [...scanAvgSceneMarkers(text)].reverse()) text=text.slice(0,token.index)+text.slice(token.index+token.text.length); return plain(text);
}).filter(Boolean);
assert.deepEqual(normalized.map(log=>plain(log.text)),expectedText);
assert.deepEqual(normalized.map(log=>log.sender),logs.slice(1).map(log=>log.sender));

const variants=['<镜头 ref="s1"/>','【镜头 ref="s1"/>','【镜头 ref="s1"】','＜镜头 ref＝“s1”／＞',"[镜头 ref='s1']",'<镜头 ref=s1>','<镜头 REF = ‘s1’ />'];
for(const marker of variants) {
 assert.equal(readAvgSceneMarker(marker),'s1',marker);
 for(const repair of [true,false]) {
  const raw='<正文>'+marker+'【旁白】第一段。<镜头/>【旁白】未知段。<镜头 ref="s2"/>【乙】第二段。</正文><演出场景>'+JSON.stringify({场景:hints})+'</演出场景>';
  const parsed=parseStoryRawText(raw,{enableTagRepair:repair,validateTagCompleteness:false});
  assert.deepEqual(parsed.logs.map(log=>log.avgSceneRef),['s1',undefined,'s2'],marker);
  assert.deepEqual(parsed.logs.map(log=>plain(log.text)),['第一段。','未知段。','第二段。']);
 }
}
const literal=[{sender:'甲',text:'他调整镜头方向。【镜头】是这里的标题，ref 是普通文字。'}];
assert.equal(normalizeAvgSceneLogs(literal),literal);
assert.equal(scanAvgSceneMarkers(literal[0].text).length,0);
const invalid=normalizeAvgSceneLogs([{sender:'旁白',text:'<镜头 ref="s1"/>一。<镜头 ref=/>二。<镜头 ref="s2"/>三。'}]);
assert.deepEqual(invalid.map(log=>log.avgSceneRef),['s1',undefined,'s2']);
assert.equal(readAvgSceneMarker(writeAvgSceneMarker('房间&"甲')),'房间&"甲');
const bracketRef='书斋【东侧】[乙]';
assert.equal(scanAvgSceneMarkers(writeAvgSceneMarker(bracketRef))[0].ref,bracketRef);
assert.equal(parseStoryRawText('<正文>'+writeAvgSceneMarker(bracketRef)+'【旁白】室内。</正文>').logs[0].avgSceneRef,bracketRef);
assert.deepEqual(normalizeAvgSceneLogs([{sender:'旁白',text:'<镜头 ref="s1"/>一。\n<镜头 ref="broken\n二。\n<镜头 ref="s2"/>三。'}]).map(log=>log.avgSceneRef),['s1',undefined,'s2']);

const raw='<正文>'+logs.map(log=>(log.sender.startsWith('【')?log.sender:'【'+log.sender+'】')+log.text).join('\n')+'</正文><演出场景>'+JSON.stringify({场景:hints})+'</演出场景>';
const parsed=parseStoryRawText(raw);
const jsonParsed=parseStoryRawText(JSON.stringify({logs,avgSceneHints:hints}));
for(const result of [parsed,jsonParsed]) {
 assert.deepEqual(avgSceneSegmentRefs(result.logs),known);
 assert.equal(result.logs.length,normalized.length);
 assert.deepEqual(result.logs.map(log=>plain(log.text)),expectedText);
 assert.deepEqual(JSON.parse(JSON.stringify(result.avgSceneHints)),hints);
}
const catalog=process.argv[3] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const packKey='mrjh-complete-webp@0.8.0';
const assets=existsSync(catalog)?parseAvgManifest(JSON.parse(readFileSync(catalog,'utf8')),path=>'avgpack://'+packKey+'/'+path).scenes.map(asset=>({...asset,id:packKey+':'+asset.id}))
 : profiles.map((profile,index)=>({id:'asset'+index,version:1,image:'avgpack://fixture/'+index+'.webp',profile}));
const before=JSON.stringify({logs,hints});
const commands=[{action:'set',key:'环境.具体地点',value:env.具体地点}];
const response={logs,avgSceneHints:hints,tavern_commands:commands,body_original_logs:logs,avgPresentation:buildAvgPresentation(logs,hints,env as any,[],assets)};
assert.equal(response.avgPresentation.diagnostic,'no-scene-markers');
assert.ok(response.avgPresentation.scenes.every(scene=>!scene.image));
const repaired=restoreAvgSceneProtocol(response as any,[],assets);
assert.equal(repaired.avgPresentation.mode,'multi');
assert.equal(repaired.avgPresentation.diagnostic,undefined);
assert.deepEqual(repaired.avgPresentation.scenes.map(scene=>scene.ref),known);
assert.ok(repaired.avgPresentation.scenes.every(scene=>!!scene.image));
assert.deepEqual(repaired.avgPresentation.scenes.map(scene=>scene.profile),hints.map(hint=>hint.分类));
assert.equal(repaired.tavern_commands,commands);
assert.equal(repaired.body_original_logs,logs);
assert.equal(restoreAvgSceneProtocol(repaired,[],assets),repaired);
assert.equal(JSON.stringify({logs,hints}),before);
const badHints={...response,avgSceneHints:hints.slice(1)};
assert.equal(restoreAvgSceneProtocol(badHints as any,[],assets),badHints);
const duplicate={...response,avgSceneHints:[...hints,hints[0]]};
assert.equal(restoreAvgSceneProtocol(duplicate as any,[],assets),duplicate);
const manual={...response,avgPresentation:{...response.avgPresentation,scenes:response.avgPresentation.scenes.map(scene=>({...scene,reason:'manual-neutral'}))}};
assert.equal(restoreAvgSceneProtocol(manual as any,[],assets),manual);
const frozen={...response,avgPresentation:{...repaired.avgPresentation,diagnostic:'no-scene-markers'}};
assert.equal(restoreAvgSceneProtocol(frozen as any,[],assets).avgPresentation.scenes[0],repaired.avgPresentation.scenes[0]);
const turn={role:'assistant',timestamp:1,content:'原文',rawJson:raw,structuredResponse:response};
const evidence=buildAvgSceneSourceEvidence(turn as any);
assert.equal(evidence.rawSceneMarkerCount,3);
assert.equal(evidence.nonCanonicalSceneMarkerCount,3);
assert.equal(evidence.reparsed.markedLogCount,normalized.length);
assert.equal(diagnoseAvgSceneDisplay({source:evidence,response,scene:response.avgPresentation.scenes[0]} as any).code,'scene-marker-format-recoverable');
assert.equal(buildAvgSceneSourceEvidence({...turn,rawJson:JSON.stringify({logs,avgSceneHints:hints})} as any).rawSceneMarkerCount,3);
const history=[turn] as any;
const savedBefore=JSON.stringify(history);
globalThis.protocolPack={scenes:assets,available:false};
assert.equal((await recoverMissingAvgArt(history,[])).history,history);
globalThis.protocolPack.available=true;
const recovered=await recoverMissingAvgArt(history,[]);
assert.equal(recovered.repaired,1);
assert.equal(recovered.history[0].rawJson,raw);
assert.equal(recovered.history[0].structuredResponse.tavern_commands,commands);
assert.deepEqual(avgSceneSegmentRefs(recovered.history[0].structuredResponse.logs),known);
assert.equal((await recoverMissingAvgArt(recovered.history,[])).history,recovered.history);
assert.equal(JSON.stringify(history),savedBefore);

globalThis.protocolPolishBody=normalized.map(log=>'【镜头 ref="'+log.avgSceneRef+'"/>\n'+(log.sender.startsWith('【')?log.sender:'【'+log.sender+'】')+log.text).join('\n');
const deps={apiConfig:{},gameConfig:{},prompts:[],环境:env,剧情:{},社交:[],战斗:{},角色:{姓名:'测试'},文章优化已开启:true,深拷贝:structuredClone};
const polished=await 执行正文润色(repaired as any,'',deps as any);
assert.equal(polished.applied,true);
assert.deepEqual(avgSceneSegmentRefs(polished.response.logs),known);
console.log(JSON.stringify({result:'passed',variants:variants.length,logsBefore:logs.length,logsAfter:normalized.length,cameras:known,assets:repaired.avgPresentation.scenes.map(scene=>({ref:scene.ref,id:scene.assetId,space:scene.profile.空间})),savedRecovery:recovered.repaired,repeatedRepairs:0,catalog:assets.length},null,2));
`;
const mocks={name:'offline-protocol-fixture',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'pack',namespace:'protocol-fixture'}));
 builder.onResolve({filter:/services\/ai\/text$/},args=>args.importer.endsWith('bodyPolish.ts')?{path:'text',namespace:'protocol-fixture'}:undefined);
 builder.onResolve({filter:/utils\/apiConfig$/},args=>args.importer.endsWith('bodyPolish.ts')?{path:'api',namespace:'protocol-fixture'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'protocol-fixture'},args=>({loader:'js',contents:args.path==='text'
  ? 'export const generatePolishedBody=async()=>({bodyText:globalThis.protocolPolishBody,rawText:"offline"});'
  : args.path==='api' ? 'export const 获取文章优化接口配置=()=>({model:"offline"});export const 接口配置是否可用=()=>true;'
  : 'export const getAvgPackCatalog=()=>({scenes:globalThis.protocolPack?.scenes||[],portraits:[]});export const loadAvgPackCatalog=async()=>{};export const isAvgPackImage=image=>!!image;export const getAvgPackImageBlob=async()=>globalThis.protocolPack.available?new Blob(["fixture"]):undefined;export const findUniqueLegacyAvgAsset=()=>undefined;'}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[mocks]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgSceneProtocolRecoveryRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
