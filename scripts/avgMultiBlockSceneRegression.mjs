import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { buildAvgPresentation } from './services/avg/sceneResolver';
import { restoreAvgSceneProtocol, recoverMissingAvgArt } from './services/avg/missingArtRecovery';
import { buildAvgSceneSourceEvidence, diagnoseAvgSceneSource } from './services/avg/sceneEvidence';
import { parseAvgManifest } from './services/avg/manifest';
const d=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')):undefined;
const env={大地点:'大理国',中地点:'无量山',小地点:'无量山外围',具体地点:'山道密林'};
const hints=d?d.latestTurn.sourceEvidence.rawBlocks.flatMap(block=>block.structure.scenes.map(scene=>({
 ref:scene.ref,地点:scene.location,分类:scene.profile
}))):['地下石室','江岸','林间小径'].map((空间,i)=>({ref:'s'+(i+1),地点:{...env,具体地点:空间},分类:{空间,地域:'西南'}}));
const logs=d?d.latestTurn.sourceEvidence.logs.map(log=>({sender:log.sender,text:log.text,avgSceneRef:log.sceneRef}))
 :hints.map(hint=>({sender:'旁白',text:'来到'+hint.分类.空间+'。',avgSceneRef:hint.ref}));
const body='<正文>'+logs.map(log=>'【镜头 ref="'+log.avgSceneRef+'"/>【'+log.sender.replace(/[【】]/g,'')+'】'+log.text).join('\n')+'</正文>';
const block=entries=>'<演出场景>'+JSON.stringify(entries)+'</演出场景>';
const raw=body+hints.map(hint=>block({场景:[hint]})).join('\n');
const refs=['s1','s2','s3'];
for(const repair of [true,false]) {
 const options={enableTagRepair:repair,validateTagCompleteness:false};
 const parsed=parseStoryRawText(raw,options);
 assert.deepEqual(parsed.avgSceneHints.map(h=>h.ref),refs);
 assert.deepEqual(parsed.logs.map(log=>log.avgSceneRef),logs.map(log=>log.avgSceneRef));
 assert.deepEqual(parsed.avgSceneHints.map(h=>h.分类),hints.map(h=>h.分类));
 assert.deepEqual(parseStoryRawText(body+block({场景:hints}),options).avgSceneHints,parsed.avgSceneHints);
 assert.deepEqual(parseStoryRawText(body+block(hints.slice(0,1))+block({场景:hints.slice(1)}),options).avgSceneHints,parsed.avgSceneHints);
 assert.deepEqual(parseStoryRawText(body+block(null)+raw.slice(body.length),options).avgSceneHints,parsed.avgSceneHints);
 assert.deepEqual(parseStoryRawText(body+'<演出场景>unreadable</演出场景>'+raw.slice(body.length),options).avgSceneHints,parsed.avgSceneHints);
 const duplicate=raw+block({场景:[{...hints[1],分类:{空间:'荒漠'}}]});
 assert.deepEqual(parseStoryRawText(duplicate,options).avgSceneHints.map(h=>h.ref),['s1','s3']);
 const invalidDuplicate=raw+block([{ref:'s2'}]);
 assert.deepEqual(parseStoryRawText(invalidDuplicate,options).avgSceneHints.map(h=>h.ref),['s1','s3']);
 const thought='<thinking>'+block({场景:[{...hints[1],分类:{空间:'荒漠'}}]})+'</thinking>';
 assert.deepEqual(parseStoryRawText(thought+raw,options).avgSceneHints,parsed.avgSceneHints);
}
const catalog=process.argv[3]||'docs/avg-art-production/complete-webp-008/manifest.json';
const key='mrjh-complete-webp@0.8.0';
const assets=existsSync(catalog)?parseAvgManifest(JSON.parse(readFileSync(catalog,'utf8')),path=>'avgpack://'+key+'/'+path).scenes.map(a=>({...a,id:key+':'+a.id}))
 :hints.map((hint,i)=>({id:'art'+i,version:1,profile:hint.分类,image:'avgpack://test/'+i+'.webp'}));
const history=d?d.recentTurns.filter(t=>t.presentation&&t.timestamp!==d.latestTurn.timestamp).map(t=>({
 role:'assistant',timestamp:t.timestamp,content:'',structuredResponse:{logs:[],avgPresentation:t.presentation}
})):[];
const commands=[{action:'set',key:'环境.具体地点',value:env.具体地点}];
const savedPresentation=d?d.recentTurns.find(t=>t.timestamp===d.latestTurn.timestamp).presentation
 :buildAvgPresentation(logs,hints.slice(0,1),env as any,history as any,assets);
const response={logs,avgSceneHints:hints.slice(0,1),tavern_commands:commands,body_original_logs:logs,avgPresentation:savedPresentation};
const original=JSON.stringify(response);
const restored=restoreAvgSceneProtocol(response as any,history as any,assets,d?.theme,raw);
assert.deepEqual(restored.avgSceneHints.map(h=>h.ref),refs);
assert.equal(restored.avgPresentation.diagnostic,undefined);
assert.ok(restored.avgPresentation.scenes.every(s=>s.image));
assert.equal(restored.avgPresentation.scenes[0],savedPresentation.scenes[0]);
assert.equal(restored.logs,logs);
assert.equal(restored.body_original_logs,logs);
assert.equal(restored.tavern_commands,commands);
assert.equal(JSON.stringify(response),original);
assert.equal(restoreAvgSceneProtocol(restored,history as any,assets,d?.theme,raw),restored);
for(const bad of [undefined,'unreadable',body+block({场景:[hints[0]]}),raw+block([hints[1]])])
 assert.equal(restoreAvgSceneProtocol(response as any,history as any,assets,d?.theme,bad),response);
const manual={...response,avgPresentation:{...savedPresentation,mode:'final',scenes:[{...savedPresentation.scenes[0],reason:'manual-neutral'}]}};
assert.equal(restoreAvgSceneProtocol(manual as any,history as any,assets,d?.theme,raw),manual);
const prior={role:'assistant',timestamp:0,content:'',structuredResponse:{logs:[],avgPresentation:{
 schemaVersion:1,mode:'multi',scenes:history.flatMap(t=>t.structuredResponse.avgPresentation.scenes).filter(s=>s.image)
}}};
const turn={role:'assistant',timestamp:1,content:'saved prose',rawJson:raw,structuredResponse:response};
const evidence=buildAvgSceneSourceEvidence(turn as any);
assert.equal(evidence.rawSceneBlockCount,3);
assert.equal(evidence.reparsed.hintCount,3);
assert.equal(diagnoseAvgSceneSource(evidence).code,'scene-fields-partially-retained');
const savedHistory=[prior,turn] as any;
const savedBefore=JSON.stringify(savedHistory);
globalThis.multiBlockPack={scenes:assets,available:false};
assert.equal((await recoverMissingAvgArt(savedHistory,[],d?.theme)).history,savedHistory);
globalThis.multiBlockPack.available=true;
const recovered=await recoverMissingAvgArt(savedHistory,[],d?.theme);
const final=recovered.history.at(-1).structuredResponse;
assert.deepEqual(final.avgSceneHints.map(h=>h.ref),refs);
assert.equal(final.logs,logs);
assert.equal(final.tavern_commands,commands);
assert.equal(recovered.history.at(-1).rawJson,raw);
assert.ok(final.avgPresentation.scenes.every(s=>s.image));
assert.equal((await recoverMissingAvgArt(recovered.history,[],d?.theme)).history,recovered.history);
assert.equal(JSON.stringify(savedHistory),savedBefore);
assert.equal(diagnoseAvgSceneSource(buildAvgSceneSourceEvidence(recovered.history.at(-1))).code,'scene-fields-present');
if(d&&assets.length===2230) {
 assert.equal(final.avgPresentation.scenes[0].assetId,key+':ST130');
 assert.equal(final.avgPresentation.scenes[2].assetId,key+':FR034');
}
console.log(JSON.stringify({result:'passed',blocks:3,hintRefs:refs,logs:logs.length,catalog:assets.length,
 assets:final.avgPresentation.scenes.map(s=>({ref:s.ref,id:s.assetId,space:s.profile.空间})),rawAndCommandsUnchanged:true,repeatedRepairs:0},null,2));
`;
const mocks={name:'offline-multi-block',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'pack',namespace:'multi-block-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'multi-block-fixture'},()=>({loader:'js',contents:
 'export const getAvgPackCatalog=()=>({scenes:globalThis.multiBlockPack?.scenes||[],portraits:[]});export const loadAvgPackCatalog=async()=>{};export const isAvgPackImage=image=>!!image;export const getAvgPackImageBlob=async()=>globalThis.multiBlockPack.available?new Blob(["fixture"]):undefined;export const findUniqueLegacyAvgAsset=()=>undefined;'}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[mocks]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgMultiBlockSceneRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
