import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { buildAvgPresentation, avgPlaceKey, inspectAvgSceneBindings } from './services/avg/sceneResolver';
import { buildAvgKnownScenesPrompt } from './services/avg/sceneBindings';
import { normalizeAvgHints, AVG_FULL_PROTOCOL_PROMPT } from './services/avg/vocabulary';
import { restoreStructuredAvgScenes } from './services/avg/missingArtRecovery';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { 构建主剧情请求参数 } from './hooks/useGame/mainStoryRequest';
import { captureAvgSceneTrace } from './services/avg/sceneEvidence';

const office = {大地点:'京东东路',中地点:'清河县',小地点:'县衙',具体地点:'捕房值房'};
const alias = {...office,小地点:'县前街',具体地点:'清河县衙捕房公廨'};
const home = {...office,小地点:'紫石街',具体地点:'武家小楼'};
const assets = [
 {id:'office',version:1,image:'/office.webp',profile:{空间:'厢房',场所体系:'官署',场所功能:'衙门'}},
 {id:'home',version:1,image:'/home.webp',profile:{空间:'民居卧室',场所体系:'宅院',场所功能:'民居'}},
 {id:'other-office',version:1,image:'/other.webp',profile:{空间:'厢房',场所体系:'官署',场所功能:'衙门'}}
];
const logs = [{sender:'旁白',text:'来到室内',avgSceneRef:'s1'}];
const hint = {ref:'s1',地点:office,分类:assets[0].profile};
const wrap = presentation => ({role:'assistant',content:'',timestamp:1,structuredResponse:{logs,avgSceneHints:[hint],avgPresentation:presentation}});
const first = buildAvgPresentation(logs,[hint],office as any,[],assets.slice(0,1));
const id = first.scenes[0].sceneId;
const history = [wrap(first)];
const original = JSON.stringify({history,logs,assets});
// No repeated classification needed, with or without markers. Frozen ID/version/image survives catalog removal.
const returned = buildAvgPresentation([{sender:'旁白',text:'再次回来'}],[],office as any,history,[]);
assert.equal(returned.scenes[0].assetId,'office');
assert.equal(returned.scenes[0].image,'/office.webp');
assert.deepEqual(returned.scenes[0].profile,hint.分类);
assert.equal(returned.diagnostic,undefined);
const locationOnly = normalizeAvgHints({场景:[{ref:'s1',地点:office}]});
assert.equal(buildAvgPresentation(logs,locationOnly,office as any,history,[]).scenes[0].assetId,'office');
// A new model classification is retained but cannot silently replace the frozen image.
const changed = buildAvgPresentation(logs,[{...hint,分类:assets[1].profile}],office as any,history,assets);
assert.equal(changed.scenes[0].assetId,'office');
assert.deepEqual(changed.scenes[0].profile,assets[1].profile);
assert.deepEqual(buildAvgPresentation(logs,[{...hint,分类:{空间:'未知'}}],office as any,history,assets).scenes[0].profile,{空间:'未知'});
// No semantic name guess: this actual save's office alias remains unresolved until the model links its ID.
assert.equal(buildAvgPresentation([],[],alias as any,history,assets).scenes[0].image,undefined);
assert.equal(buildAvgPresentation(logs,normalizeAvgHints({场景:[{ref:'s1',地点:alias}]}),alias as any,history,assets).scenes[0].image,undefined);
const reuse = {ref:'s1',场景ID:id,地点:alias};
const raw = '<正文><镜头 ref="s1"/>\n【旁白】回到捕房。</正文><演出场景>'+JSON.stringify({场景:[reuse]})+'</演出场景>';
const parsed = parseStoryRawText(raw);
assert.equal(parsed.avgSceneHints[0].场景ID,id);
const aliased = buildAvgPresentation(parsed.logs,parsed.avgSceneHints,alias as any,history,assets);
assert.equal(aliased.scenes[0].assetId,'office');
assert.deepEqual(aliased.scenes[0].placeAliases,[avgPlaceKey(office),avgPlaceKey(alias)]);
const aliasHistory = [...history,wrap(aliased)];
assert.equal(buildAvgPresentation([],[],alias as any,aliasHistory,[]).scenes[0].assetId,'office');
assert.equal(buildAvgPresentation([],[],office as any,aliasHistory,[]).scenes[0].assetId,'office');
assert.equal(inspectAvgSceneBindings(aliasHistory,avgPlaceKey(office)).lookupRule,'declared-place-alias');
const idOnly = normalizeAvgHints({场景:[{ref:'s1',场景ID:id}]});
assert.equal(buildAvgPresentation(logs,idOnly,home as any,history,assets).scenes[0].assetId,'office');
assert.equal(buildAvgPresentation([],idOnly,home as any,history,assets).scenes[0].placeKey,avgPlaceKey(office));
assert.equal(buildAvgPresentation(logs,normalizeAvgHints({场景:[{ref:'s1',场景ID:'unknown'}]}),office as any,history,assets).scenes[0].image,undefined);
// Different rooms remain independent; conflicting identity is a structural failure on that frame only.
const bedroom = buildAvgPresentation(logs,[{ref:'s1',地点:home,分类:assets[1].profile}],home as any,history,assets);
const both = [...history,wrap(bedroom)];
const conflict = buildAvgPresentation(logs,normalizeAvgHints({场景:[{...reuse,地点:home}]}),home as any,both,assets);
assert.equal(conflict.diagnostic,'conflicting-scene-identity');
assert.equal(conflict.scenes[0].image,undefined);
assert.equal(buildAvgPresentation([{sender:'旁白',text:'未映射',avgSceneRef:'missing'}],[],office as any,history,assets).scenes[0].image,undefined);
assert.equal(buildAvgPresentation([], [hint,{ref:'s2',地点:home,分类:assets[1].profile}],office as any,history,assets).scenes[0].image,undefined);
// Return refs within the first reply share the first chosen image, even if classification changes.
const sameTurn = buildAvgPresentation([...logs,{...logs[0],avgSceneRef:'s2'}],[hint,{...hint,ref:'s2',分类:assets[1].profile}],office as any,[],assets);
assert.equal(sameTurn.scenes[0].assetId,sameTurn.scenes[1].assetId);
// Explicit manual image/neutral choices are retained across aliases and fieldless returns.
const manual = buildAvgPresentation(logs,[hint],office as any,history,assets,{[avgPlaceKey(office)]:'other-office'});
assert.equal(buildAvgPresentation([],[],office as any,[...history,wrap(manual)],assets).scenes[0].assetId,'other-office');
assert.equal(buildAvgPresentation([],[],alias as any,aliasHistory,assets,{[avgPlaceKey(office)]:'other-office'}).scenes[0].assetId,'other-office');
const neutral = buildAvgPresentation(logs,[hint],office as any,history,assets,{[avgPlaceKey(office)]:'neutral'});
assert.equal(buildAvgPresentation([],[],office as any,[...history,wrap(neutral)],assets).scenes[0].reason,'manual-neutral');
// Loading an old blank exact return repairs presentation only; unrelated alias/frozen story remains intact.
const oldBlank = buildAvgPresentation([],[],office as any,[],assets);
const response = {logs:[],avgSceneHints:[],avgPresentation:oldBlank,tavern_commands:[{key:'环境.具体地点',value:office.具体地点}]};
const before = JSON.stringify(response);
const restored = restoreStructuredAvgScenes(response as any,history,assets);
assert.equal(restored.scenes[0].assetId,'office');
assert.equal(restoreStructuredAvgScenes({...response,avgPresentation:restored} as any,history,assets),restored);
assert.equal(JSON.stringify(response),before);
const aliasBlank = {...response,avgPresentation:buildAvgPresentation([],[],alias as any,[],assets)};
assert.equal(restoreStructuredAvgScenes(aliasBlank as any,history,assets),aliasBlank.avgPresentation);
// Legacy automatically inferred invalid bindings are excluded, while existing explicit manual choices survive.
const inferred = [{...history[0],structuredResponse:{...history[0].structuredResponse,avgPresentation:{...first,diagnostic:'invalid-scene-timeline'}}}];
assert.equal(buildAvgPresentation([],[],office as any,inferred,assets).scenes[0].image,undefined);
assert.equal(JSON.stringify({history,logs,assets}),original);
// Full binding history is sent through normal and tavern requests even after the story window drops its turn.
const params = {gameConfig:{启用AVG演出:true},apiConfig:{},builtContext:{shortMemoryContext:'',contextPieces:new Proxy({},{get:()=>''})},updatedContextHistory:[],avgBindingHistory:both,updatedMemSys:{},sendInput:'返回',playerRole:{姓名:'测试'}};
const request = 构建主剧情请求参数(params as any);
const entry = request.messageEntries.find(message=>message.id==='avg_scene_bindings');
assert.ok(entry?.content.includes(id));
assert.ok(entry?.content.includes('捕房值房'));
assert.ok(request.orderedMessages.some(message=>message.content.includes(AVG_FULL_PROTOCOL_PROMPT)));
const trace = captureAvgSceneTrace(true,request.orderedMessages,parsed,'main');
assert.equal(trace.request.bindingRegistryIncluded,true);
assert.equal(trace.request.bindingRegistrySceneCount,2);
const preset = {prompts:[{identifier:'main',role:'system',content:'{{worldInfo}}'}],prompt_order:[{character_id:100001,order:[{identifier:'worldInfoBefore',enabled:true}]}]};
const tavern = 构建主剧情请求参数({...params,gameConfig:{启用AVG演出:true,启用酒馆预设模式:true,酒馆预设列表:[{id:'fixture',名称:'fixture',预设:preset}]}} as any);
assert.equal(tavern.tavernPresetModeEnabled,true);
assert.equal(captureAvgSceneTrace(true,tavern.orderedMessages,parsed,'main').request.bindingRegistrySceneCount,2);
const disabled = 构建主剧情请求参数({...params,gameConfig:{启用AVG演出:false}} as any);
assert.ok(!disabled.messageEntries.some(message=>message.id==='avg_scene_bindings'));
const many = Array.from({length:100},(_,index)=>wrap({...first,scenes:[{...first.scenes[0],sceneId:'scene:'+index,placeKey:'place/'+index,placeAliases:['place/'+index]}]}));
const registry = buildAvgKnownScenesPrompt(many);
assert.ok(registry.includes('"省略较早场景数":20'));
assert.ok(!registry.includes('"scene:0"'));
console.log('Persistent AVG bindings: exact returns, explicit aliases/IDs, frozen resources, no name inference, room separation, manual choices, old-save recovery, full-history request and registry evidence passed');
`;
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
const file = 'work/regression/avgSceneBindingRegression.bundle.mjs';
await writeFile(file,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+file).href);
