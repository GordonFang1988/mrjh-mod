import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseAvgManifest } from './services/avg/manifest';
import { buildAvgPresentation, inspectAvgSceneCandidates, avgPlaceKey } from './services/avg/sceneResolver';
import { recoverMissingAvgArt, replacementForWeakLocationFallback } from './services/avg/missingArtRecovery';

const env = {大地点:'大理国',中地点:'无量山',小地点:'无量山后山',具体地点:'琅嬛福地石室'};
const logs = [{sender:'旁白',text:'原有剧情保持不变。'}];
const fixtureAssets = [
 {id:'well',version:1,image:'avgpack://fixture@1/well.webp',label:'西南普通坡城公共汲水井室',profile:{空间:'地下石室',地域:'西南',地表:'石板',水域:'地下水',显著要素:['水池','木梁']}},
 {id:'chamber',version:1,image:'avgpack://fixture@1/chamber.webp',label:'西南山石闭关石室',profile:{空间:'闭关石室',地域:'西南',显著要素:['岩壁']}},
 {id:'cave',version:1,image:'avgpack://fixture@1/cave.webp',label:'西南静修洞穴',profile:{空间:'静修洞穴',地域:'西南',显著要素:['岩壁']}},
 {id:'inside',version:1,image:'avgpack://fixture@1/inside.webp',label:'西南高拱洞厅',profile:{空间:'洞内',地域:'西南'}},
 {id:'mouth',version:1,image:'avgpack://fixture@1/mouth.webp',label:'西南岩壁洞口',profile:{空间:'洞口',地域:'西南'}},
 {id:'room',version:1,image:'avgpack://fixture@1/room.webp',label:'普通客房',profile:{空间:'客栈客房',地域:'西南'}}
];
const wrap = presentation => ({role:'assistant',timestamp:1,content:'原有正文',structuredResponse:{logs,avgSceneHints:[],avgPresentation:presentation,tavern_commands:[{action:'set',key:'环境.具体地点',value:env.具体地点}]}});
const choose = (location=env,assets=fixtureAssets,hints=[]) => buildAvgPresentation(logs,hints as any,location as any,[],assets,{},'tianlong');
const before = JSON.stringify({env,logs,fixtureAssets});
const first = choose();
assert.equal(first.scenes[0].assetId,'chamber');
assert.deepEqual(first.scenes[0].profile,{空间:'未知'});
assert.deepEqual(first.scenes[0].fallback.preferredSpaces,['洞内','静修洞穴','石窟','闭关石室']);
assert.equal(first.scenes[0].fallback.contextTerm,'山');
const matching = inspectAvgSceneCandidates(first.scenes[0].profile,fixtureAssets,'tianlong',avgPlaceKey(env));
assert.deepEqual(matching.candidateIds,['chamber']);
assert.equal(matching.candidates[0].label,fixtureAssets[1].label);
assert.equal(matching.counts.category,3);
assert.equal(JSON.stringify({env,logs,fixtureAssets}),before);
assert.equal(choose(env,[...fixtureAssets].reverse()).scenes[0].assetId,'chamber');
const interiorSpaces=['洞内','静修洞穴','石窟','闭关石室'];
for(const room of ['琅嬛福地石室','隐秘石室','山腹地下石室','后山岩洞','隐蔽洞隙','山洞深处','秘境洞府','修行洞室','溶洞大厅']) {
 const scene=choose({...env,具体地点:room}).scenes[0];
 assert.ok(interiorSpaces.includes(fixtureAssets.find(asset=>asset.id===scene.assetId)?.profile.空间),room);
 assert.deepEqual(scene.profile,{空间:'未知'});
}
for(const room of ['山洞口','岩洞外','洞府前']) assert.equal(choose({...env,具体地点:room}).scenes[0].assetId,'mouth');
assert.equal(choose({...env,具体地点:'洞府客房'}).scenes[0].assetId,'room');
assert.equal(choose({...env,具体地点:'公共汲水井室'}).scenes[0].assetId,'well');
assert.equal(choose({...env,小地点:'城内府邸',具体地点:'地下石室'}).scenes[0].assetId,'well');
assert.ok(['cave','inside'].includes(choose(env,fixtureAssets.filter(asset=>asset.id!=='chamber')).scenes[0].assetId));
assert.equal(choose(env,fixtureAssets.slice(0,1)).scenes[0].assetId,'well'); // no cave art: preserve ordinary fallback, never pretend it is a cave
for(const space of ['地下石室','洞口','洞内','客栈客房']) {
 const supplied={空间:space,地域:'西南'};
 const scene=choose(env,fixtureAssets,[{ref:'final',地点:env,分类:supplied}]).scenes[0];
 assert.deepEqual(scene.profile,supplied);
 assert.equal(scene.fallback,undefined);
 assert.equal(fixtureAssets.find(asset=>asset.id===scene.assetId).profile.空间,space);
}

const diagnostic = process.argv[2] ? JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')) : undefined;
const catalogPath=process.argv[3] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const fullCatalog=existsSync(catalogPath);
const key='mrjh-complete-webp@0.8.0';
const parsed=fullCatalog ? parseAvgManifest(JSON.parse(readFileSync(catalogPath,'utf8')),file=>'avgpack://'+key+'/'+file) : undefined;
assert.deepEqual(parsed?.errors || [],[]);
const assets=parsed ? parsed.scenes.map(asset=>({...asset,id:key+':'+asset.id})) : fixtureAssets;
const location=diagnostic?.environment || env;
const savedLogs=diagnostic?.latestTurn.sourceEvidence.logs.map(({sender,text})=>({sender,text})) || logs;
const well=assets.find(asset=>asset.id.endsWith(':UI451') || asset.id==='well');
const weak=diagnostic?.latestTurn.scenes[0] || {...first.scenes[0],assetId:well.id,image:well.image,version:well.version,
 fallback:{source:'location',term:location.具体地点,matchingProfile:{空间:'未知',地域:'西南'},tier:'nearest-catalog',contextRegion:'西南'}};
assert.equal(weak.profile.空间,'未知');
const improved=replacementForWeakLocationFallback(weak,assets,diagnostic?.theme);
assert.ok(improved?.image);
assert.ok(interiorSpaces.includes(assets.find(asset=>asset.id===improved.assetId).profile.空间));
assert.equal(improved.sceneId,weak.sceneId);
assert.equal(improved.placeAliases,weak.placeAliases);
assert.equal(improved.profile,weak.profile);
assert.equal(improved.fallback.replacedAssetId,well.id);
assert.equal(replacementForWeakLocationFallback(improved,assets),undefined);
for(const changes of [{reason:'manual-place-override'},{reason:'manual-neutral'},{profile:{空间:'地下石室'}},
 {fallback:undefined},{assetId:'removed'},{image:'manual-url'},{fallback:{...weak.fallback,tier:'space'}}])
 assert.equal(replacementForWeakLocationFallback({...weak,...changes},assets),undefined);
assert.equal(replacementForWeakLocationFallback(weak,[well]),undefined);

const old={...wrap(first),structuredResponse:{...wrap(first).structuredResponse,logs:savedLogs,avgPresentation:{...first,scenes:[weak]}}};
const oldHistory=[old,{...old,timestamp:2,structuredResponse:{...old.structuredResponse,avgPresentation:{...first,diagnostic:undefined,scenes:[{...weak,reason:'existing-binding'}]}}}];
const originalHistory=JSON.stringify(oldHistory);
globalThis.cavePack={scenes:assets,available:false};
assert.equal((await recoverMissingAvgArt(oldHistory,[],diagnostic?.theme)).history,oldHistory);
globalThis.cavePack.available=true;
const repaired=await recoverMissingAvgArt(oldHistory,[],diagnostic?.theme);
assert.equal(repaired.repaired,2);
for(const turn of repaired.history) {
 const scene=turn.structuredResponse.avgPresentation.scenes[0];
 assert.equal(scene.assetId,improved.assetId);
 assert.equal(turn.structuredResponse.logs,savedLogs);
 assert.equal(turn.structuredResponse.tavern_commands,old.structuredResponse.tavern_commands);
 assert.equal(turn.content,old.content);
}
assert.equal(JSON.stringify(oldHistory),originalHistory);
const returned=buildAvgPresentation(logs,[],location as any,repaired.history as any,[]).scenes[0];
assert.equal(returned.assetId,improved.assetId);
assert.equal(returned.reason,'existing-binding');
assert.equal((await recoverMissingAvgArt(repaired.history,[],diagnostic?.theme)).history,repaired.history);
if(fullCatalog) assert.equal(assets.length,2230);
const chosen=assets.find(asset=>asset.id===improved.assetId);
console.log(JSON.stringify({result:'passed',catalog:fullCatalog?'full-local':'portable',sceneAssets:assets.length,
 diagnosticReproduced:!!diagnostic,oldAsset:{id:well.id,label:well.label},newAsset:{id:chosen.id,label:chosen.label,space:chosen.profile.空间},
 caveAliasesChecked:9,caveEntrancesChecked:3,modelAndManualChoicesPreserved:true,localAvailabilityRequired:true,
 oldWeakFallbacksRepaired:repaired.repaired,returnBindingStable:true,repeatedRepairs:0},null,2));
`;
const storage={name:'cave-pack-storage',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'packStore',namespace:'cave-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'cave-fixture'},()=>({loader:'js',contents:String.raw`
export const getAvgPackCatalog=()=>({scenes:globalThis.cavePack?.scenes||[],portraits:[]});
export const loadAvgPackCatalog=async()=>{};
export const isAvgPackImage=image=>typeof image==='string'&&image.startsWith('avgpack://');
export const getAvgPackImageBlob=async()=>globalThis.cavePack.available ? new Blob(['fixture']) : undefined;
export const findUniqueLegacyAvgAsset=()=>undefined;
`}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storage]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgCaveSceneRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
