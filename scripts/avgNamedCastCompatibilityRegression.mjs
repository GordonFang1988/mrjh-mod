import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAvgManifest } from './services/avg/manifest';
import { resolveAvgPortraits } from './services/avg/portraitResolver';
import { avgBindingForAsset, avgSamePersonOptions } from './services/avg/identity';
import { recoverMissingAvgArt } from './services/avg/missingArtRecovery';
import { buildAvgDiagnostic } from './services/avg/diagnostics';
const packKey='mrjh-complete-webp@0.8.0';
const theme='tianlong';
const make=(id,name,key,extra={})=>({id,name,file:'images/'+id+'.webp',version:1,
 gender:'女',visualAge:'young',ageRange:{min:18,max:23},portraitVerified:true,reusePolicy:'unique',
 themeId:'tianlong',characterKey:key,faceFamilyKey:key,profile:{视觉年龄:'young',服饰类别:'武林袍服'},...extra});
const gan=(id,extra={})=>make(id,'甘宝宝','tianlong:gan-baobao',{
 visualAge:'middle',ageRange:{min:32,max:45},profile:{视觉年龄:'middle',服饰类别:'富贵华服'},...extra});
const raw={version:1,portraits:[
 make('TF005','钟灵','tianlong:zhong-ling'),
 make('TV009','钟灵','tianlong:zhong-ling',{baseAssetId:'TF005',variantStage:'outfit-1'}),
 make('TV010','钟灵','tianlong:zhong-ling',{baseAssetId:'TF005',variantStage:'outfit-2'}),
 gan('TF009'),gan('TV017',{baseAssetId:'TF009',variantStage:'outfit-1'}),
 gan('TV018',{baseAssetId:'TF009',variantStage:'outfit-2'}),
 make('TM002','段誉','tianlong:duan-yu',{gender:'男',ageRange:{min:18,max:26}}),
 make('TM023','左子穆','tianlong:zuo-zimu',{gender:'男',ageRange:{min:45,max:60}}),
 make('TM025','马五德','tianlong:ma-wude',{gender:'男',ageRange:{min:45,max:65}}),
 make('RPF1529','大院女护卫',undefined,{themeId:undefined,ageRange:{min:26,max:35},profile:{视觉年龄:'young',服饰类别:'江湖劲装'}})
]};
const parse=value=>parseAvgManifest(value,file=>'avgpack://'+packKey+'/'+file);
const original=JSON.stringify(raw);
const parsed=parse(raw);assert.deepEqual(parsed.errors,[]);
for(const id of ['TF009','TV017','TV018'])assert.deepEqual(parsed.portraits.find(a=>a.id===id).ageRange,{min:30,max:45});
assert.equal(JSON.stringify(raw),original);
const corrected=structuredClone(raw);corrected.portraits.filter(a=>a.characterKey==='tianlong:gan-baobao').forEach(a=>a.ageRange.min=30);
assert.deepEqual(parse(corrected),parsed);
for(const extra of [{id:'OTHER'},{characterKey:'tianlong:other'},{themeId:'shuihu-jinpingmei'},{gender:'男'},
 {ageRange:{min:31,max:45}},{ageRange:{min:32,max:46}}]) {
 const entry=gan('TF009',extra);assert.deepEqual(parse({version:1,portraits:[entry]}).portraits[0].ageRange,entry.ageRange);
}
const inherited=gan('TF009');delete inherited.themeId;
assert.deepEqual(parse({version:1,themeId:'tianlong',portraits:[inherited]}).portraits[0].ageRange,{min:30,max:45});
let catalog=parsed;
if(process.argv[2]) {
 const actual=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(actual);
 catalog=parse(actual);assert.deepEqual(catalog.errors,[]);
 assert.equal(catalog.scenes.length,2230);assert.equal(catalog.portraits.length,4676);
 assert.equal(JSON.stringify(actual),before);
 for(const id of ['TF005','TF009','TV009','TV010','TV017','TV018'])assert.ok(catalog.portraits.find(a=>a.id===id));
}
const assets=catalog.portraits.map(a=>({...a,id:packKey+':'+a.id,baseAssetId:a.baseAssetId?packKey+':'+a.baseAssetId:undefined}));
const teen={...assets.find(a=>a.id===packKey+':TF005'),id:'mrjh-teen-portraits-webp@1.0.0:YPF051-B',
 baseAssetId:undefined,characterKey:undefined,faceFamilyKey:undefined,themeId:undefined,label:'通用少女',
 image:'avgpack://mrjh-teen-portraits-webp@1.0.0/images/YPF051-B.webp',ageRange:{min:13,max:17},
 visualAge:'teen',profile:{视觉年龄:'teen',服饰类别:'平民布衣'}};
const maleGeneric={...teen,id:'fixture@1:generic-male',gender:'男',label:'通用侠客',ageRange:{min:18,max:65},reusePolicy:'crowd',
 image:'avgpack://fixture@1/male.webp',visualAge:'young',profile:{视觉年龄:'young',服饰类别:'武林袍服'}};
assets.push(teen,maleGeneric);
const zhong={id:'NPC005',姓名:'钟灵',性别:'女',年龄:16,AVG立绘特征:{视觉年龄:'teen',服饰类别:'平民布衣'}};
const ganNpc={id:'NPC007',姓名:'甘宝宝',性别:'女',年龄:30,AVG立绘特征:{视觉年龄:'young',服饰类别:'江湖劲装'}};
const males=[{id:'NPC004',姓名:'段誉',性别:'男',年龄:19},
 {id:'NPC006',姓名:'左子穆',性别:'男',年龄:50},{id:'NPC003',姓名:'马五德',性别:'男',年龄:55}];
const social=[zhong,ganNpc,...males];
const logs=social.map(n=>({sender:n.姓名,text:'测试对白'}));
const resolve=(people=social,history=[],chosenTheme=theme,choices=assets)=>resolveAvgPortraits(logs,people,history,choices,chosenTheme);
const selected=resolve();
assert.equal(selected.钟灵.assetId,packKey+':TF005');assert.equal(selected.甘宝宝.assetId,packKey+':TF009');
assert.equal(selected.钟灵.characterKey,'tianlong:zhong-ling');assert.equal(selected.甘宝宝.characterKey,'tianlong:gan-baobao');
for(const [name,id] of [['段誉','TM002'],['左子穆','TM023'],['马五德','TM025']])assert.equal(selected[name].assetId,packKey+':'+id);
for(const wrongTheme of ['','shuihu-jinpingmei']) {
 assert.notEqual(resolve(social,[],wrongTheme).钟灵.assetId,selected.钟灵.assetId);
 assert.notEqual(resolve(social,[],wrongTheme).甘宝宝.assetId,selected.甘宝宝.assetId);
}
assert.equal(resolve([{...zhong,id:'z2'},zhong]).钟灵,undefined);
assert.equal(resolve([{...zhong,姓名:'别名',AVG具名角色Key:'tianlong:zhong-ling'}]).钟灵,undefined);
assert.equal(resolveAvgPortraits([{sender:'别名',text:'测试'}],[{...zhong,姓名:'别名',AVG具名角色Key:'tianlong:zhong-ling'}],[],assets,theme).别名.assetId,packKey+':TF005');
for(const age of [30,31,32,45])assert.equal(resolve([{...ganNpc,年龄:age},zhong]).甘宝宝.assetId,packKey+':TF009');
for(const age of [29,46])assert.notEqual(resolve([{...ganNpc,年龄:age},zhong]).甘宝宝.assetId,packKey+':TF009');
assert.notEqual(resolve([{...zhong,年龄:15},ganNpc]).钟灵.assetId,packKey+':TF005');
assert.notEqual(resolve([{...zhong,年龄:24},ganNpc]).钟灵.assetId,packKey+':TF005');
const ordinary={id:'ordinary',姓名:'路人',性别:'女',年龄:30,AVG立绘特征:{视觉年龄:'young',服饰类别:'江湖劲装'}};
const themedGeneric={...teen,id:'sh-generic',themeId:theme,label:'通用江湖女子',ageRange:{min:25,max:35},visualAge:'young',profile:ordinary.AVG立绘特征};
assert.equal(resolveAvgPortraits([{sender:'路人',text:'测试'}],[...social,ordinary],[],[...assets,themedGeneric],theme).路人.assetId,'sh-generic');
const oldBindings={钟灵:avgBindingForAsset(zhong.id,teen,'existing-binding'),
 甘宝宝:avgBindingForAsset(ganNpc.id,assets.find(a=>a.id===packKey+':RPF1529'),'first-match'),
 ...Object.fromEntries(males.map(n=>[n.姓名,avgBindingForAsset(n.id,maleGeneric,'existing-binding')]))};
const commands=[{action:'set',key:'环境.具体地点',value:'大厅'}];
const turn={role:'assistant',timestamp:1,content:'saved',rawJson:'untouched',structuredResponse:{logs,
 body_original_logs:logs,tavern_commands:commands,avgPortraitBindings:oldBindings}};
const history=[turn],before=JSON.stringify({history,social});
assert.equal(resolve(social,history).钟灵.assetId,selected.钟灵.assetId);
assert.equal(resolve(social,history).甘宝宝.assetId,selected.甘宝宝.assetId);
globalThis.namedCastPack={portraits:assets,missing:new Set(),readFailure:false};
const repaired=await recoverMissingAvgArt(history,social,theme);
assert.equal(repaired.repaired,5);
for(const name of Object.keys(selected))assert.equal(repaired.history[0].structuredResponse.avgPortraitBindings[name].assetId,selected[name].assetId);
assert.equal(repaired.history[0].rawJson,turn.rawJson);assert.equal(repaired.history[0].structuredResponse.logs,logs);
assert.equal(repaired.history[0].structuredResponse.body_original_logs,logs);assert.equal(repaired.history[0].structuredResponse.tavern_commands,commands);
assert.equal(repaired.social,social);assert.equal(JSON.stringify({history,social}),before);
assert.equal((await recoverMissingAvgArt(repaired.history,social,theme)).history,repaired.history);
globalThis.namedCastPack.missing=new Set(Object.values(selected).map(a=>a.image));
assert.equal((await recoverMissingAvgArt(history,social,theme)).history,history);
globalThis.namedCastPack.missing.clear();globalThis.namedCastPack.readFailure=true;
assert.equal((await recoverMissingAvgArt(history,social,theme)).history,history);
globalThis.namedCastPack.readFailure=false;
const manual={...turn,structuredResponse:{...turn.structuredResponse,avgPortraitBindings:
 Object.fromEntries(Object.entries(oldBindings).map(([name,b])=>[name,{...b,reason:'manual-prefab'}]))}};
assert.equal((await recoverMissingAvgArt([manual],social,theme)).history[0],manual);
const manualSocial=social.map(n=>({...n,AVG美术选择:{source:'prefab',assetId:oldBindings[n.姓名].assetId,baseAssetId:oldBindings[n.姓名].baseAssetId}}));
assert.equal(resolve(manualSocial,history).钟灵.assetId,teen.id);
const generated=social.map(n=>({...n,图片档案:{已选立绘图片ID:n.id,生图历史:[{id:n.id,状态:'success',构图:'立绘',图片URL:'/mine.png'}]}}));
assert.equal(resolve(generated,history).钟灵.assetId,'archive:NPC005');
assert.equal(resolve(generated,history).甘宝宝.assetId,'archive:NPC007');
for(const name of ['钟灵','甘宝宝']) {
 const binding=selected[name],options=avgSamePersonOptions(binding,assets);
 assert.equal(options.length,3);
 const person=social.find(n=>n.姓名===name);
 for(const asset of options) {
  const chosen=social.map(n=>n.id===person.id?{...n,AVG美术选择:{source:'prefab',baseAssetId:binding.baseAssetId,assetId:asset.id}}:n);
  assert.equal(resolve(chosen,repaired.history)[name].assetId,asset.id);
 }
}
globalThis.document={querySelectorAll:()=>[]};globalThis.location={origin:'https://offline.invalid',pathname:'/'};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'offline-regression'}});
globalThis.innerWidth=1280;globalThis.innerHeight=720;
const diagnostic=await buildAvgDiagnostic({history,social,environment:{大地点:'大理国',中地点:'万劫谷',小地点:'大厅',具体地点:'厅内'},theme});
assert.equal(diagnostic.theme,theme);
for(const actor of diagnostic.latestTurn.portraits) {
 assert.equal(actor.expectedCharacterKey,selected[actor.sender].characterKey);
 assert.equal(actor.namedCandidates.length,1);assert.equal(actor.namedCandidates[0].ageMatches,true);
 assert.equal(actor.currentResolution.assetId,selected[actor.sender].assetId);
}
const wrongDiagnostic=await buildAvgDiagnostic({history,social,environment:{},theme:'shuihu-jinpingmei'});
assert.ok(wrongDiagnostic.latestTurn.portraits.every(actor=>actor.otherThemeNamedCandidates.some(a=>a.theme==='tianlong')));
const ganOnly={...turn,timestamp:2,structuredResponse:{...turn.structuredResponse,logs:[logs[1]],avgPortraitBindings:{甘宝宝:oldBindings.甘宝宝}}};
const recentDiagnostic=await buildAvgDiagnostic({history:[turn,ganOnly],social,environment:{},theme});
assert.equal(recentDiagnostic.latestTurn.portraits.length,1);assert.equal(recentDiagnostic.recentPortraits.length,5);
assert.ok(recentDiagnostic.recentPortraits.every(actor=>actor.namedCandidates[0].ageMatches));
const manySocial=Array.from({length:25},(_,i)=>({...ganNpc,id:'bounded-'+i,姓名:'测试人物'+i}));
const manyTurn={...turn,structuredResponse:{...turn.structuredResponse,logs:[],avgPortraitBindings:Object.fromEntries(manySocial.map(n=>[n.姓名,{...oldBindings.甘宝宝,npcId:n.id}]))}};
const boundedDiagnostic=await buildAvgDiagnostic({history:[manyTurn],social:manySocial,environment:{},theme});
assert.equal(boundedDiagnostic.recentPortraits.length,20);assert.equal(boundedDiagnostic.recentPortraitsTruncated,true);
 console.log(JSON.stringify({result:'passed',catalogPortraits:catalog.portraits.length,theme,
 corrected:Object.fromEntries(Object.entries(selected).map(([name,b])=>[name,b.assetId])),
 oldSaveRepairs:repaired.repaired,repeatRepairs:0,manualAndGeneratedPreserved:true,
 ageAndThemeBoundaries:true,rawManifestAndNpcUnchanged:true,diagnosticMatchesResolver:true},null,2));
`;
const storage={name:'offline-named-cast-storage',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'pack',namespace:'named-cast-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'named-cast-fixture'},()=>({loader:'js',contents:String.raw`
export const getAvgPackCatalog=()=>({scenes:[],portraits:globalThis.namedCastPack?.portraits||[]});
export const loadAvgPackCatalog=async()=>{};
export const listAvgArtPacks=async()=>[];
export const isAvgPackImage=image=>typeof image==='string'&&image.startsWith('avgpack://');
export const getAvgPackImageBlob=async image=>{if(globalThis.namedCastPack.readFailure)throw Error('offline');return globalThis.namedCastPack.missing.has(image)?undefined:new Blob(['fixture']);};
export const findUniqueLegacyAvgAsset=()=>undefined;
`}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storage]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgNamedCastCompatibilityRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
