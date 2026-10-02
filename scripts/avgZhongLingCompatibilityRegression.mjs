import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = String.raw`
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAvgManifest } from './services/avg/manifest';
import { resolveAvgPortraits } from './services/avg/portraitResolver';
import { avgSamePersonOptions, avgBindingForAsset } from './services/avg/identity';
import { recoverMissingAvgArt } from './services/avg/missingArtRecovery';
const key='mrjh-complete-webp@0.8.0';
const ids=['TF005','TV009','TV010'];
const make=(id,extra={})=>({id,file:'images/'+id+'.webp',version:1,name:'钟灵',
 gender:'女',visualAge:'young',ageRange:{min:18,max:23},reusePolicy:'unique',portraitVerified:true,
 themeId:'tianlong',characterKey:'tianlong:zhong-ling',faceFamilyKey:'tianlong:zhong-ling',
 profile:{视觉年龄:'young',服饰类别:'武林袍服'},...extra});
const base=make('TF005');
const raw={version:1,portraits:[base,make('TV009',{baseAssetId:'TF005',variantStage:'outfit-1'}),make('TV010',{baseAssetId:'TF005',variantStage:'outfit-2'})]};
const parse=value=>parseAvgManifest(value,path=>'avgpack://'+key+'/'+path);
const before=JSON.stringify(raw);
const parsed=parse(raw);
assert.deepEqual(parsed.errors,[]);
assert.ok(parsed.portraits.every(a=>a.ageRange.min===16&&a.ageRange.max===23));
assert.ok(parsed.portraits.every(a=>a.visualAge==='young'));
assert.equal(JSON.stringify(raw),before);
const corrected=structuredClone(raw);
corrected.portraits.forEach(a=>a.ageRange.min=16);
assert.deepEqual(parse(corrected),parsed);
const otherCases=[
 {id:'OTHER'}, {characterKey:'tianlong:other'}, {themeId:'shuihu-jinpingmei'},
 {gender:'男'}, {ageRange:{min:19,max:23}}, {ageRange:{min:18,max:24}}
];
for(const extra of otherCases) {
 const entry=make('TF005',extra),result=parse({version:1,portraits:[entry]});
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.portraits[0].ageRange,entry.ageRange);
}
const inherited=structuredClone(raw);
inherited.themeId='tianlong';inherited.portraits.forEach(a=>delete a.themeId);
assert.deepEqual(parse(inherited),parsed);
const wu=make('WU',{characterKey:'shuihu_jinpingmei:wu-da-lang',themeId:'shuihu-jinpingmei',gender:'男',ageRange:{min:35,max:60}});
assert.deepEqual(parse({version:1,portraits:[wu]}).portraits[0].ageRange,{min:30,max:60});
let pack=parsed;
if(process.argv[2]) {
 const manifest=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const original=JSON.stringify(manifest);
 pack=parse(manifest);
 assert.deepEqual(pack.errors,[]);
 const changed=pack.portraits.filter(a=>{
  const raw=manifest.portraits.find(p=>p.id===a.id);
  if(raw.characterKey==='shuihu_jinpingmei:wu-da-lang')return false;
  return a.ageRange.min!==raw.ageRange.min||a.ageRange.max!==raw.ageRange.max;
 }).map(a=>a.id);
 assert.deepEqual(changed.sort(),[...ids,'TF009','TV017','TV018'].sort());
 assert.equal(pack.scenes.length,2230);
 assert.equal(pack.portraits.length,4676);
 assert.equal(JSON.stringify(manifest),original);
}
const assets=pack.portraits.filter(a=>ids.includes(a.id)).map(a=>({...a,id:key+':'+a.id,baseAssetId:a.baseAssetId?key+':'+a.baseAssetId:undefined}));
const npc={id:'NPC005',姓名:'钟灵',性别:'女',年龄:16,AVG立绘特征:{视觉年龄:'teen',服饰类别:'平民布衣'}};
const logs=[{sender:'钟灵',text:'请你吃瓜子。',avgSceneRef:'s1'}];
const resolve=(age=16,theme='tianlong',social=npc,history=[])=>resolveAvgPortraits(logs,[{...social,年龄:age}],history,assets,theme)['钟灵'];
for(const age of [16,17,18,23])assert.equal(resolve(age).assetId,key+':TF005');
for(const age of [15,24])assert.equal(resolve(age).reason,'no-compatible-art');
for(const theme of ['','shuihu-jinpingmei'])assert.equal(resolve(16,theme).reason,'no-compatible-art');
const binding=resolve();
assert.deepEqual(avgSamePersonOptions(binding,assets).map(a=>a.id),ids.map(id=>key+':'+id));
const history=[{role:'assistant',structuredResponse:{logs,avgPortraitBindings:{钟灵:binding}}}];
for(const id of ids) {
 const chosen={...npc,AVG美术选择:{source:'prefab',baseAssetId:key+':TF005',assetId:key+':'+id}};
 assert.equal(resolve(16,'tianlong',chosen,history).assetId,key+':'+id);
}
const commands=[{action:'set',key:'环境.具体地点',value:'大厅'}];
const turn={role:'assistant',timestamp:1,content:'saved',rawJson:'untouched',structuredResponse:{
 logs,body_original_logs:logs,tavern_commands:commands,avgPortraitBindings:{钟灵:{npcId:'NPC005',reason:'no-compatible-art'}}
}};
const original=JSON.stringify(turn),socialBefore=JSON.stringify(npc);
globalThis.zhongLingPack={portraits:assets,present:false,readFailure:false};
const saved=[turn];
for(const readFailure of [false,true]) {
 globalThis.zhongLingPack.readFailure=readFailure;
 assert.equal((await recoverMissingAvgArt(saved,[npc] as any,'tianlong')).history,saved);
}
globalThis.zhongLingPack.readFailure=false;globalThis.zhongLingPack.present=true;
assert.equal((await recoverMissingAvgArt(saved,[npc] as any,'shuihu-jinpingmei')).history,saved);
const repaired=await recoverMissingAvgArt(saved,[npc] as any,'tianlong');
assert.equal(repaired.repaired,1);
assert.equal(repaired.history[0].structuredResponse.avgPortraitBindings.钟灵.assetId,key+':TF005');
assert.equal(repaired.history[0].rawJson,turn.rawJson);
assert.equal(repaired.history[0].structuredResponse.logs,logs);
assert.equal(repaired.history[0].structuredResponse.body_original_logs,logs);
assert.equal(repaired.history[0].structuredResponse.tavern_commands,commands);
assert.equal(repaired.social[0],npc);
assert.equal(JSON.stringify(turn),original);assert.equal(JSON.stringify(npc),socialBefore);
assert.equal((await recoverMissingAvgArt(repaired.history,[npc] as any,'tianlong')).history,repaired.history);
const selected={...npc,图片档案:{已选立绘图片ID:'mine',生图历史:[{id:'mine',状态:'success',构图:'立绘',图片URL:'/mine.png'}]}};
assert.equal(resolve(16,'tianlong',selected).assetId,'archive:mine');
const frozen={...turn,structuredResponse:{...turn.structuredResponse,avgPortraitBindings:{钟灵:avgBindingForAsset('NPC005',assets[1],'manual-prefab')}}};
assert.equal((await recoverMissingAvgArt([frozen] as any,[npc] as any,'tianlong')).history[0],frozen);
console.log(JSON.stringify({result:'passed',catalog:{scenes:pack.scenes.length,portraits:pack.portraits.length},
 calibrated:assets.map(a=>({id:a.id,ageRange:a.ageRange,visualAge:a.visualAge})),repaired:1,repeatedRepairs:0,
 themeIsolation:true,npcAgeUnchanged:npc.年龄,rawManifestUnchanged:true},null,2));
`;
const storage={name:'offline-zhongling-storage',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'pack',namespace:'zhongling-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'zhongling-fixture'},()=>({loader:'js',contents:
 'export const getAvgPackCatalog=()=>({scenes:[],portraits:globalThis.zhongLingPack?.portraits||[]});export const loadAvgPackCatalog=async()=>{};export const isAvgPackImage=image=>typeof image==="string"&&image.startsWith("avgpack://");export const getAvgPackImageBlob=async()=>{if(globalThis.zhongLingPack.readFailure)throw Error("offline");return globalThis.zhongLingPack.present?new Blob(["fixture"]):undefined;};export const findUniqueLegacyAvgAsset=()=>undefined;'}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storage]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgZhongLingCompatibilityRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
