import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildAvgPresentation, inspectAvgSceneCandidates } from './services/avg/sceneResolver';
import { parseAvgManifest } from './services/avg/manifest';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { buildAvgSceneSourceEvidence, diagnoseAvgSceneDisplay } from './services/avg/sceneEvidence';

const env = {大地点:'京东东路',中地点:'清河县',小地点:'县前街',具体地点:'李记羊汤馆'};
const profile = {空间:'茶馆',地域:'华北',场所体系:'商旅',场所功能:'酒楼',装潢档次:'简陋',空间规模:'狭小'};
const hint = {ref:'s2',地点:env,分类:profile};
const logs = [{sender:'旁白',text:'进入羊汤馆。',avgSceneRef:'s2'}];
const asset = (id,空间,场所功能,extra={}) => ({id,version:1,image:'/'+id+'.webp',profile:{空间,场所体系:'商旅',场所功能,...extra}});
const assets = [
 asset('tea','茶馆','茶馆',{地域:'华北',装潢档次:'简陋',空间规模:'狭小'}),
 asset('restaurant','酒楼大厅','酒楼', {地域:'华北',装潢档次:'简陋',空间规模:'狭小'}),
 asset('palatial','酒楼大厅','酒楼',{地域:'华北',装潢档次:'奢华',空间规模:'宏大'}),
 asset('inn','客栈大堂','客栈'),
 asset('bedroom','客栈客房','客栈'), asset('kitchen','厨房','酒楼'),
 asset('shop','店铺内','商铺'), asset('smith','铁匠铺内','铁匠铺'),
 asset('official','茶馆','酒楼',{场所体系:'官署'})
];
const resolve = (wanted=profile,catalog=assets,history=[],overrides={}) => buildAvgPresentation(logs,[{...hint,分类:wanted}],env as any,history as any,catalog as any,overrides).scenes[0];
const scene = resolve();
assert.equal(scene.assetId,'restaurant');
assert.deepEqual(scene.profile,profile); // Never correct the LLM classification.
const inspection = inspectAvgSceneCandidates(profile,assets as any);
assert.equal(inspection.selection.functionTier,'exact');
assert.equal(inspection.selection.spaceTier,'compatible');
assert.deepEqual(new Set(inspection.candidateIds),new Set(['restaurant','palatial']));
assert.equal(inspection.failure,null);

assert.equal(resolve(profile,[assets[0]]).assetId,'tea'); // Related public dining function, only as fallback.
assert.equal(inspectAvgSceneCandidates(profile,[assets[0]] as any).selection.functionTier,'related-dining');
assert.equal(resolve({...profile,场所功能:'茶馆'}).assetId,'tea');
assert.equal(resolve({...profile,空间:'酒楼大厅',场所功能:'客栈'},[assets[3]]).assetId,'inn');
assert.equal(resolve({...profile,空间:'客栈大堂'},[assets[1]]).assetId,'restaurant');
assert.equal(resolve(profile,assets.slice(4)).assetId,undefined); // No kitchen/bedroom/shop/office substitution.
assert.equal(resolve({...profile,场所功能:'铁匠铺'},assets.slice(0,4)).assetId,undefined);
assert.equal(resolve({...profile,空间:'模型自定义空间'}).assetId,undefined);
assert.equal(resolve({...profile,空间:'模型自定义空间'}).profile.空间,'模型自定义空间');
const renamed = buildAvgPresentation(logs,[{...hint,地点:{...env,具体地点:'捕房街铁匠铺'}}],env as any,[],assets as any).scenes[0];
assert.equal(renamed.assetId,'restaurant'); // No place-name or prose classification.

const generic = asset('generic','茶馆','通用');
assert.equal(resolve(profile,[generic,assets[1]]).assetId,'restaurant'); // Exact function in related space outranks general art.
const exact = asset('exact','茶馆','酒楼');
assert.equal(resolve(profile,[exact,assets[1]]).assetId,'exact');
const history = [{role:'assistant',content:'',timestamp:1,structuredResponse:{logs,avgPresentation:{schemaVersion:1,mode:'multi',scenes:[scene]}}}];
const frozen = resolve(profile,[exact],history);
assert.equal(frozen.assetId,'restaurant');
assert.equal(frozen.image,'/restaurant.webp');
assert.equal(frozen.reason,'existing-binding');
assert.equal(resolve(profile,assets,history,{[scene.placeKey]:'neutral'}).reason,'manual-neutral');

const raw = '<正文><镜头 ref="s2"/>【旁白】进入羊汤馆。</正文><演出场景>'+JSON.stringify({场景:[hint]})+'</演出场景>';
const response = parseStoryRawText(raw);
const neutral = {...scene,image:undefined,assetId:undefined,reason:'neutral-background'};
response.avgPresentation={schemaVersion:1,mode:'multi',scenes:[neutral]};
const evidence = buildAvgSceneSourceEvidence({role:'assistant',content:'',timestamp:1,rawJson:raw,structuredResponse:response} as any);
const diagnose = (wanted,catalog) => {
 const matching = inspectAvgSceneCandidates(wanted,catalog);
 return {matching,diagnosis:diagnoseAvgSceneDisplay({source:evidence,response,scene:{...neutral,profile:wanted},candidateCount:matching.counts.category,matching})};
};
const functionBlocked = diagnose({...profile,场所功能:'铁匠铺'},assets.slice(0,4));
assert.equal(functionBlocked.matching.failure.stage,'function');
assert.equal(functionBlocked.matching.counts.compatibleSpaceBeforeFilters,4);
assert.match(functionBlocked.diagnosis.summary,/功能“铁匠铺”筛选后剩余 0 张/);
assert.ok(functionBlocked.matching.failure.rejectedCandidates.length>0);
const institutionBlocked = diagnose({...profile,场所体系:'佛寺'},assets.slice(0,4));
assert.equal(institutionBlocked.matching.failure.stage,'institution');
assert.match(institutionBlocked.diagnosis.summary,/体系“佛寺”/);
assert.equal(diagnose({...profile,空间:'模型自定义空间'},assets).matching.failure.stage,'space');
assert.match(diagnose({...profile,空间:'模型自定义空间'},assets).diagnosis.summary,/模型自定义空间/);

// Optional real art catalog replay on the production workspace. CI still runs all fixed cases above.
const catalogPath = 'docs/avg-art-production/complete-webp-008/manifest.json';
if (existsSync(catalogPath)) {
 const parsed = parseAvgManifest(JSON.parse(readFileSync(catalogPath,'utf8')));
 assert.equal(parsed.errors.length,0);
 assert.equal(parsed.scenes.length,2230);
 const actualProfile = process.argv[2]
   ? JSON.parse(readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')).latestTurn.hints.find(h=>h.ref==='s2').分类 : profile;
 assert.deepEqual(actualProfile,profile);
 const replay = resolve(actualProfile,parsed.scenes);
 assert.ok(replay.image);
 assert.equal(replay.profile.空间,'茶馆');
 assert.equal(parsed.scenes.find(a=>a.id===replay.assetId).profile.场所功能,'酒楼');
 const exactSpace = parsed.scenes.filter(a=>a.profile.空间==='茶馆');
 assert.equal(exactSpace.length,29);
 assert.equal(exactSpace.filter(a=>a.profile.场所功能==='酒楼').length,0);
 console.log(JSON.stringify({catalogScenes:parsed.scenes.length,selectedId:replay.assetId,selectedProfile:parsed.scenes.find(a=>a.id===replay.assetId).profile,matching:inspectAvgSceneCandidates(profile,parsed.scenes)}));
}
console.log('AVG dining scene regression passed: structured compatibility, function/space priority, exclusions, frozen bindings and filter diagnosis');
`;
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
await writeFile('work/regression/avgDiningSceneRegression.bundle.mjs',result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/work/regression/avgDiningSceneRegression.bundle.mjs').href);
