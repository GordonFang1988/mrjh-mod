import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseAvgManifest } from './services/avg/manifest';
import { buildAvgPresentation, inspectAvgSceneCandidates, avgPlaceKey } from './services/avg/sceneResolver';
import { recoverMissingAvgArt } from './services/avg/missingArtRecovery';

const env = {大地点:'大理国',中地点:'无量山',小地点:'无量山后山',具体地点:'深谷边缘'};
const logs = [{sender:'旁白',text:'原有剧情与游戏命令保持不变。'}];
const fixtureAssets = [
 {id:'valley',version:1,image:'/valley.webp',label:'西南双溪汇流高山谷',profile:{空间:'山谷',地域:'西南'}},
 {id:'north-valley',version:1,image:'/north.webp',label:'东北双溪汇流高山谷',themeId:'tianlong',profile:{空间:'山谷',地域:'东北'}},
 {id:'temple-path',version:1,image:'/temple.webp',label:'西南佛寺后山石阶林道',profile:{空间:'后山小径',地域:'西南',场所功能:'佛寺'}},
 {id:'unknown',version:1,image:'/unknown.webp',label:'深谷边缘',profile:{空间:'未知'}},
 {id:'missing-file',version:1,image:'',label:'深谷边缘',profile:{空间:'山谷',地域:'西南'}}
];
const wrap = presentation => ({role:'assistant',timestamp:1,content:'原有正文',structuredResponse:{logs,avgPresentation:presentation}});
const classifiedHistory = (country='大理国',region='西南',room='客房') => {
 const location = {...env,大地点:country,具体地点:room};
 const asset = {id:country+region+room,version:1,image:'/bound.webp',profile:{空间:'客栈客房',地域:region}};
 return wrap(buildAvgPresentation(logs,[{ref:'final',地点:location,分类:asset.profile}],location as any,[],[asset]));
};
const history = [classifiedHistory()];
const original = JSON.stringify({env,logs,fixtureAssets,history});
const first = buildAvgPresentation(logs,[],env as any,history,fixtureAssets,{},'tianlong');
const scene = first.scenes[0];
assert.equal(scene.assetId,'valley'); // specific valley outranks the parent venue's temple/back-mountain phrase
assert.deepEqual(scene.profile,{空间:'未知'});
assert.equal(scene.fallback.contextRegion,'西南');
assert.equal(scene.fallback.tier,'nearest-catalog');
assert.equal(scene.sceneId,'place:'+avgPlaceKey(env));
assert.deepEqual(scene.placeAliases,[avgPlaceKey(env)]);
assert.equal(first.diagnostic,'missing-scene-fields');
const matching = inspectAvgSceneCandidates(scene.profile,fixtureAssets,'tianlong',scene.placeKey,scene.fallback.contextRegion);
assert.deepEqual(matching.candidateIds,['valley']);
assert.equal(matching.counts.knownSpace,3);
assert.equal(matching.failure,null);
assert.equal(matching.selection.spaceTier,'nearest-catalog');
assert.equal(buildAvgPresentation(logs,[],env as any,history,[...fixtureAssets].reverse(),{},'tianlong').scenes[0].assetId,scene.assetId);
assert.equal(JSON.stringify({env,logs,fixtureAssets,history}),original);
// Natural tags also participate, so an unlabeled reed bed can beat an unrelated same-region venue.
const featureAssets = [fixtureAssets[2],{id:'reeds',version:1,image:'/reeds.webp',label:'河汊水湾',profile:{空间:'湖岸',地域:'中部',显著要素:['芦苇']}}];
assert.equal(buildAvgPresentation(logs,[],{...env,具体地点:'渡头芦苇间'} as any,history,featureAssets).scenes[0].assetId,'reeds');

// Regional context is only a preference from a unique, same-country classified history.
assert.equal(buildAvgPresentation(logs,[],env as any,[classifiedHistory('宋国')],fixtureAssets).scenes[0].fallback.contextRegion,undefined);
assert.equal(buildAvgPresentation(logs,[],env as any,[...history,classifiedHistory('大理国','东北','另一客房')],fixtureAssets).scenes[0].fallback.contextRegion,undefined);
const supplied = {空间:'未知',地域:'东北'};
const explicit = buildAvgPresentation(logs,[{ref:'final',地点:env,分类:supplied}],env as any,history,fixtureAssets).scenes[0];
assert.deepEqual(explicit.profile,supplied);
assert.equal(explicit.assetId,'north-valley');
assert.equal(explicit.fallback.contextRegion,undefined);

// A recognized room with no corresponding art still reaches the nearest catalog tier.
const storage = buildAvgPresentation(logs,[],{...env,具体地点:'后院柴房'} as any,[],fixtureAssets).scenes[0];
assert.ok(storage.image);
assert.equal(storage.fallback.matchingProfile.空间,'库房');
assert.equal(storage.fallback.tier,'nearest-catalog');
assert.equal(inspectAvgSceneCandidates(storage.profile,fixtureAssets,undefined,storage.placeKey).counts.beforeNearestFallback,0);
assert.equal(buildAvgPresentation(logs,[],env as any,[],fixtureAssets.slice(3)).scenes[0].image,undefined);
assert.equal(buildAvgPresentation(logs,[],{...env,具体地点:''} as any,[],fixtureAssets).scenes[0].image,undefined);
assert.equal(buildAvgPresentation([{...logs[0],avgSceneRef:'unmapped'}],[],env as any,history,fixtureAssets).scenes[0].image,undefined);
assert.equal(buildAvgPresentation(logs,[{ref:'final',地点:env,分类:{空间:'模型指定但无素材'}}],env as any,[],fixtureAssets).scenes[0].image,undefined);

// Frozen choices survive catalog replacement; explicit overrides and neutral selections persist.
const returned = buildAvgPresentation(logs,[],env as any,[...history,wrap(first)],[]).scenes[0];
assert.equal(returned.assetId,scene.assetId);
assert.equal(returned.image,scene.image);
assert.equal(returned.reason,'existing-binding');
const manual = buildAvgPresentation(logs,[],env as any,history,fixtureAssets,{[avgPlaceKey(env)]:'temple-path'});
assert.equal(buildAvgPresentation(logs,[],env as any,[wrap(manual)],fixtureAssets).scenes[0].assetId,'temple-path');
const neutral = buildAvgPresentation(logs,[],env as any,history,fixtureAssets,{[avgPlaceKey(env)]:'neutral'});
assert.equal(buildAvgPresentation(logs,[],env as any,[wrap(neutral)],fixtureAssets).scenes[0].reason,'manual-neutral');
const tieAssets = ['a','b','c'].map(id=>({...fixtureAssets[0],id}));
assert.equal(buildAvgPresentation(logs,[],env as any,[],tieAssets).scenes[0].assetId,
 buildAvgPresentation(logs,[],env as any,[],[...tieAssets].reverse()).scenes[0].assetId);

const diagnostic = process.argv[2] ? JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')) : undefined;
const catalogPath = process.argv[3] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const fullCatalog = existsSync(catalogPath);
const key = 'mrjh-complete-webp@0.8.0';
const parsed = fullCatalog ? parseAvgManifest(JSON.parse(readFileSync(catalogPath,'utf8')),file=>'avgpack://'+key+'/'+file) : undefined;
assert.deepEqual(parsed?.errors || [],[]);
const assets = parsed ? parsed.scenes.map(asset=>({...asset,id:key+':'+asset.id})) : fixtureAssets;
const prior = diagnostic ? diagnostic.recentTurns.slice(0,-1).map(turn=>({...turn,structuredResponse:{logs:[],avgPresentation:turn.presentation}})) : history;
const location = diagnostic?.environment || env;
const savedLogs = diagnostic?.latestTurn.sourceEvidence.logs.map(({sender,text})=>({sender,text})) || logs;
const selected = buildAvgPresentation(savedLogs,[],location as any,prior as any,assets,{},diagnostic?.theme);
assert.ok(selected.scenes[0].image);
assert.deepEqual(selected.scenes[0].profile,{空间:'未知'});
assert.equal(assets.find(asset=>asset.id===selected.scenes[0].assetId)?.profile.空间,'山谷');
assert.equal(assets.find(asset=>asset.id===selected.scenes[0].assetId)?.profile.地域,'西南');
assert.equal(selected.scenes[0].fallback.tier,'nearest-catalog');
if (fullCatalog) assert.equal(assets.length,2230);

// Many consecutive unseen places are covered, then every frozen choice is checked on return.
const places = ['深谷边缘','幽林深处','碎石坡顶','隐蔽洞隙','雪岭尽头','渡头芦苇间','草庐门前','后山石壁下','废楼角落','巷子拐角','瀑声传来处','竹影石台'];
const continuous = [...prior] as any[];
const choices = [];
for (let index=0; index<48; index++) {
 const current = {...location,具体地点:places[index%places.length]+index};
 const result = buildAvgPresentation(savedLogs,[],current as any,continuous,assets);
 assert.ok(result.scenes[0].image,'blank at consecutive turn '+index);
 assert.deepEqual(result.scenes[0].profile,{空间:'未知'});
 choices.push({current,scene:result.scenes[0]});
 continuous.push(wrap(result));
}
for (const choice of choices) {
 const result = buildAvgPresentation(savedLogs,[],choice.current as any,continuous,[]).scenes[0];
 assert.equal(result.assetId,choice.scene.assetId);
 assert.equal(result.image,choice.scene.image);
}

// Real read-time recovery, with only IndexedDB image availability substituted in this Node test.
const blank = diagnostic?.latestTurn.scenes[0] || {...selected.scenes[0],assetId:undefined,image:undefined,version:undefined,fallback:undefined,reason:'neutral-background'};
const commands = [{action:'set',key:'环境.具体地点',value:location.具体地点}];
const old = {...wrap(selected),structuredResponse:{logs:savedLogs,avgSceneHints:[],avgPresentation:{...selected,scenes:[blank]},tavern_commands:commands}};
const oldHistory = [...prior,old] as any;
const savedBefore = JSON.stringify(oldHistory);
globalThis.nearestPack = {scenes:assets,available:false};
assert.equal((await recoverMissingAvgArt(oldHistory,[],diagnostic?.theme)).history,oldHistory);
globalThis.nearestPack.available = true;
const repaired = await recoverMissingAvgArt(oldHistory,[],diagnostic?.theme);
assert.equal(repaired.repaired,1);
assert.equal(repaired.history.at(-1).structuredResponse.avgPresentation.scenes[0].assetId,selected.scenes[0].assetId);
assert.equal(repaired.history.at(-1).structuredResponse.logs,savedLogs);
assert.equal(repaired.history.at(-1).structuredResponse.tavern_commands,commands);
assert.equal(JSON.stringify(oldHistory),savedBefore);
for (let index=0;index<prior.length;index++) assert.equal(repaired.history[index],prior[index]);
assert.equal((await recoverMissingAvgArt(repaired.history,[],diagnostic?.theme)).history,repaired.history);
const manuallyBlank = [...prior,{...old,structuredResponse:{...old.structuredResponse,avgPresentation:{...old.structuredResponse.avgPresentation,scenes:[{...blank,reason:'manual-neutral'}]}}}] as any;
assert.equal((await recoverMissingAvgArt(manuallyBlank,[],diagnostic?.theme)).history,manuallyBlank);
const frozenMissing = [...prior,{...old,structuredResponse:{...old.structuredResponse,avgPresentation:{...selected,scenes:[{...selected.scenes[0],assetId:'removed',image:'avgpack://removed/images/removed.webp'}]}}}] as any;
globalThis.nearestPack.available=false;
assert.equal((await recoverMissingAvgArt(frozenMissing,[],diagnostic?.theme)).history,frozenMissing);
console.log(JSON.stringify({result:'passed',catalog:fullCatalog?'full-local':'portable',sceneAssets:assets.length,selected:assets.find(asset=>asset.id===selected.scenes[0].assetId),consecutiveTurns:choices.length,frozenReturns:choices.length,oldBlankRecovered:true,originalHistoryUnchanged:true,repeatedRepairs:0},null,2));
`;
const storage = {name:'nearest-pack-storage',setup(builder) {
 builder.onResolve({filter:/\/packStore$/},()=>({path:'packStore',namespace:'nearest-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'nearest-fixture'},()=>({loader:'js',contents:String.raw`
export const getAvgPackCatalog=()=>({scenes:globalThis.nearestPack?.scenes||[],portraits:[]});
export const loadAvgPackCatalog=async()=>{};
export const isAvgPackImage=image=>!!image;
export const getAvgPackImageBlob=async()=>globalThis.nearestPack.available?new Blob(['fixture']):undefined;
export const findUniqueLegacyAvgAsset=(id,assets)=>{const matches=assets.filter(asset=>asset.legacyAssetIds?.includes(id));return matches.length===1?matches[0]:undefined;};
`}));
}};
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storage]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgNearestSceneRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
