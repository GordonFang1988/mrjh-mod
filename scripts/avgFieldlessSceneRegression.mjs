import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseAvgManifest } from './services/avg/manifest';
import { buildAvgPresentation, inspectAvgSceneCandidates, avgPlaceKey } from './services/avg/sceneResolver';
import { recoverMissingAvgArt } from './services/avg/missingArtRecovery';

const diagnostic = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, '')) : undefined;
const env = diagnostic?.environment || {大地点:'大理国',中地点:'大理城',小地点:'城南客栈',具体地点:'后院柴房'};
const logs = diagnostic?.latestTurn?.sourceEvidence?.logs.map(({sender,text}) => ({sender,text})) || [{sender:'旁白',text:'醒来时仍在后院柴房。'}];
const packKey = 'mrjh-complete-webp@0.8.0';
const catalogPath = process.argv[3] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const fullCatalog = existsSync(catalogPath);
// A clean checkout has no locally installed art pack. Keep the mechanism test
// runnable there; use the full 2230-scene catalog whenever it is available.
const catalog = fullCatalog ? JSON.parse(readFileSync(catalogPath, 'utf8')) : {version:1,scenes:[
 {id:'UI709',file:'images/UI709.webp',label:'西南江湖客行囊寄存房',profile:{空间:'库房',地域:'西南',场所体系:'商旅',场所功能:'通用'}},
 {id:'UI480',file:'images/UI480.webp',label:'东北普通四合院柴煤储藏房',profile:{空间:'库房',地域:'东北',场所体系:'宅院',场所功能:'民居'}},
 {id:'yard',file:'images/yard.webp',label:'后院柴垛',profile:{空间:'院落',场所功能:'客栈'}}
]};
const parsed = parseAvgManifest(catalog, file => 'avgpack://'+packKey+'/'+file);
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.scenes.length, fullCatalog ? 2230 : 3);
const assets = parsed.scenes.map(asset => ({...asset,id:packKey+':'+asset.id}));
const original = JSON.stringify({env,logs,assets});
const presentation = buildAvgPresentation(logs, [], env as any, [], assets);
const scene = presentation.scenes[0];
assert.equal(presentation.diagnostic, 'missing-scene-fields');
assert.equal(scene.reason, 'location-fallback');
assert.deepEqual(scene.profile, {空间:'未知'});
assert.equal(scene.fallback.term, '柴房');
assert.equal(scene.fallback.matchingProfile.空间, '库房');
assert.equal(scene.fallback.matchingProfile.场所功能, '客栈');
assert.ok(scene.image);
assert.equal(assets.find(asset => asset.id === scene.assetId)?.profile.空间, '库房');
const matching = inspectAvgSceneCandidates(scene.profile, assets, undefined, scene.placeKey);
assert.ok(matching.candidateIds.includes(scene.assetId));
assert.ok(matching.counts.category > 0);
assert.equal(matching.failure, null);
assert.equal(JSON.stringify({env,logs,assets}), original);
assert.equal(buildAvgPresentation(logs, [], env as any, [], [...assets].reverse()).scenes[0].assetId, scene.assetId);

const profile = {空间:'未知',地域:'西南',装潢档次:'简陋'};
const fixtureAssets = [
 {id:'storage',version:1,image:'/storage.webp',label:'西南简陋柴火储藏房',profile:{空间:'库房',地域:'西南',装潢档次:'简陋',场所功能:'通用'}},
 {id:'rich-storage',version:1,image:'/rich.webp',label:'西南豪宅衣物收纳库',themeId:'tianlong',profile:{空间:'库房',地域:'西南',装潢档次:'奢华',场所功能:'通用'}},
 {id:'outdoor',version:1,image:'/yard.webp',label:'后院柴垛',profile:{空间:'院落',地域:'西南',装潢档次:'简陋'}},
 {id:'untagged',version:1,image:'/untagged.webp',label:'柴房',profile:{空间:'未知'}}
];
const hint = {ref:'s1',地点:env,分类:profile};
const taggedLogs = [{sender:'旁白',text:'在柴房。',avgSceneRef:'s1'}];
const resolve = (hints=[hint],history=[],overrides={}) => buildAvgPresentation(taggedLogs,hints as any,env as any,history as any,fixtureAssets,overrides,'tianlong');
const first = resolve();
assert.equal(first.scenes[0].assetId, 'storage');
assert.deepEqual(first.scenes[0].profile, profile);
const wrap = avgPresentation => ({role:'assistant',content:'',timestamp:1,structuredResponse:{logs:taggedLogs,avgSceneHints:[hint],avgPresentation,tavern_commands:[{action:'set',key:'环境.具体地点',value:env.具体地点}]}});
const bound = resolve([{ref:'s1',地点:env}], [wrap(first)]);
assert.equal(bound.scenes[0].assetId, 'storage');
assert.equal(bound.scenes[0].reason, 'existing-binding');
assert.deepEqual(bound.scenes[0].fallback, first.scenes[0].fallback);
const manual = resolve([hint],[],{[avgPlaceKey(env)]:'neutral'});
assert.equal(manual.scenes[0].reason,'manual-neutral');
assert.equal(resolve([hint],[wrap(manual)]).scenes[0].image,undefined);
const explicit = resolve([hint],[],{[avgPlaceKey(env)]:'rich-storage'});
assert.equal(explicit.scenes[0].assetId,'rich-storage');
assert.equal(explicit.scenes[0].fallback,undefined);
assert.equal(resolve([{...hint,分类:{空间:'院落'}}]).scenes[0].assetId,'outdoor');
assert.equal(resolve([{...hint,分类:{空间:'模型指定但无素材'}}]).scenes[0].image,undefined);
assert.equal(resolve([]).scenes[0].image,undefined); // unmapped camera cannot borrow final location
assert.equal(buildAvgPresentation(logs,[],{...env,具体地点:'未识别的地点'} as any,[],assets).scenes[0].image,undefined);

// The saved diagnostic is already blank. Exercise real read-time recovery with
// only local pack storage replaced; neither narrative nor game commands change.
const blank = diagnostic?.latestTurn?.scenes?.[0] || {...scene,assetId:undefined,image:undefined,version:undefined,fallback:undefined,reason:'neutral-background'};
const oldTurn = {role:'assistant',timestamp:1,content:'原有正文',structuredResponse:{logs,avgSceneHints:[],avgPresentation:{schemaVersion:1,mode:'final',diagnostic:'missing-scene-fields',scenes:[blank]},tavern_commands:[{action:'set',key:'环境.具体地点',value:env.具体地点}]}};
const history = [oldTurn];
const before = JSON.stringify(history);
globalThis.fieldlessPack = {scenes:assets,available:false};
assert.equal((await recoverMissingAvgArt(history,[])).history,history);
globalThis.fieldlessPack.available = true;
const repaired = await recoverMissingAvgArt(history,[]);
assert.equal(repaired.repaired,1);
const response = repaired.history[0].structuredResponse;
assert.equal(response.avgPresentation.scenes[0].assetId,scene.assetId);
assert.equal(response.logs,logs);
assert.equal(response.tavern_commands,oldTurn.structuredResponse.tavern_commands);
assert.equal(JSON.stringify(history),before);
assert.equal((await recoverMissingAvgArt(repaired.history,[])).history,repaired.history);
const manualHistory = [{...oldTurn,structuredResponse:{...oldTurn.structuredResponse,avgPresentation:{...oldTurn.structuredResponse.avgPresentation,scenes:[{...blank,reason:'manual-neutral'}]}}}];
assert.equal((await recoverMissingAvgArt(manualHistory,[])).history,manualHistory);
globalThis.fieldlessPack.available = false;
assert.equal((await recoverMissingAvgArt(repaired.history,[])).history,repaired.history);
console.log(JSON.stringify({result:'passed',catalogSource:fullCatalog?'local-art-pack':'portable-fixture',sceneAssets:assets.length,selectedAsset:assets.find(asset => asset.id===scene.assetId),fallback:scene.fallback,candidates:matching.counts.category,highestScore:matching.candidates[0]?.matchScore,oldBlankRecovered:true},null,2));
`;
const storage = {name:'fieldless-pack-storage',setup(builder) {
 builder.onResolve({filter:/\/packStore$/},()=>({path:'packStore',namespace:'fieldless-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'fieldless-fixture'},()=>({loader:'js',contents:String.raw`
export const getAvgPackCatalog=()=>({scenes:globalThis.fieldlessPack?.scenes||[],portraits:[]});
export const loadAvgPackCatalog=async()=>{};
export const isAvgPackImage=image=>!!image;
export const getAvgPackImageBlob=async()=>globalThis.fieldlessPack.available?new Blob(['fixture']):undefined;
export const findUniqueLegacyAvgAsset=(id,assets)=>{const matches=assets.filter(asset=>asset.legacyAssetIds?.includes(id));return matches.length===1?matches[0]:undefined;};
`}));
}};
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storage]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgFieldlessSceneRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
