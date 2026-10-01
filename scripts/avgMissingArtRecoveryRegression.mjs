import {build} from 'esbuild';
const source=String.raw`import assert from 'node:assert/strict';import {replacementForMissingPortrait} from './services/avg/missingArtRecovery';
const npc={id:'n',性别:'男',年龄:40};const binding={npcId:'n',assetId:'old@1:V1',baseAssetId:'old@1:B1',characterKey:'tianlong:n',faceFamilyKey:'face:n'};
const base={id:'new@1:B1',image:'/base',gender:'男',ageRange:{min:30,max:60},portraitVerified:true,characterKey:'tianlong:n',faceFamilyKey:'face:n',profile:{}};
const variant={...base,id:'new@1:V1',baseAssetId:base.id,variantStage:'outfit-1'};
assert.equal(replacementForMissingPortrait(binding,npc,[base,variant])?.id,variant.id);
for(const extra of [{gender:'女'},{characterKey:'tianlong:other'},{faceFamilyKey:'face:other'},{id:'new@1:B2'},{ageRange:{min:50,max:60}},{portraitVerified:false}])assert.equal(replacementForMissingPortrait(binding,npc,[{...base,...extra}]),undefined);
assert.equal(replacementForMissingPortrait({...binding,characterKey:undefined},npc,[base]),undefined);
assert.equal(replacementForMissingPortrait(binding,npc,[base,{...base,id:'another@1:B1'}]),undefined);
assert.equal(replacementForMissingPortrait(binding,npc,[base,{...variant,ageRange:{min:50,max:60}}])?.id,base.id);
const ordinary={npcId:'n',assetId:'coc@1:old-face',baseAssetId:'coc@1:old-face'};
const converted={...base,id:'complete@1:P5000',characterKey:undefined,faceFamilyKey:undefined,legacyAssetIds:['coc@1:old-face']};
assert.equal(replacementForMissingPortrait(ordinary,npc,[converted])?.id,converted.id);
assert.equal(replacementForMissingPortrait(ordinary,npc,[converted,{...converted,id:'complete@1:P5001'}]),undefined);
assert.equal(replacementForMissingPortrait(ordinary,npc,[{...converted,gender:'女'}]),undefined);
const mappedBase={...base,id:'complete@1:P1',legacyAssetIds:['old@1:B1']};
const mappedVariant={...variant,id:'complete@1:P2',baseAssetId:mappedBase.id,legacyAssetIds:['old@1:V1']};
assert.equal(replacementForMissingPortrait(binding,npc,[mappedBase,mappedVariant])?.id,mappedVariant.id);
assert.equal(replacementForMissingPortrait(binding,npc,[{...mappedBase,legacyAssetIds:[]},mappedVariant]),undefined);
console.log('Missing portrait recovery: same logical base/key/family/gender/age/verified and unique base checked; ordinary identity never reassigned; incompatible variant falls back to same base.');`;
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

// Exercise actual recovery with only the IndexedDB boundary replaced offline.
const availabilitySource=String.raw`
import assert from 'node:assert/strict';
import { recoverMissingAvgArt } from './services/avg/missingArtRecovery';
const env={大地点:'测试区域',中地点:'测试县',小地点:'测试建筑',具体地点:'测试房间'};
const asset={id:'fixture@1:room',version:1,image:'avgpack://fixture@1/room.webp',profile:{空间:'独立测试空间'}};
const scene={ref:'s1',placeKey:Object.values(env).join('/'),label:'测试房间',profile:asset.profile,reason:'neutral-background'};
const history=[{role:'assistant',timestamp:1,content:'',structuredResponse:{logs:[{sender:'旁白',text:'测试。',avgSceneRef:'s1'}],avgSceneHints:[{ref:'s1',地点:env,分类:asset.profile}],avgPresentation:{schemaVersion:1,mode:'multi',scenes:[scene]}}}];
const original=JSON.stringify(history);
globalThis.avgAvailabilityFixture={scenes:[asset],present:false,readFailure:false,loadFailure:false};
for(const readFailure of [false,true]){
 globalThis.avgAvailabilityFixture.readFailure=readFailure;
 const result=await recoverMissingAvgArt(history,[]);
 assert.equal(result.repaired,0);assert.equal(result.history,history);
}
globalThis.avgAvailabilityFixture.readFailure=false;globalThis.avgAvailabilityFixture.present=true;
const repaired=await recoverMissingAvgArt(history,[]);
assert.equal(repaired.repaired,1);assert.equal(repaired.history[0].structuredResponse.avgPresentation.scenes[0].image,asset.image);
assert.equal(JSON.stringify(history),original);
const repeated=await recoverMissingAvgArt(repaired.history,[]);
assert.equal(repeated.repaired,0);assert.equal(repeated.history,repaired.history);
globalThis.avgAvailabilityFixture.present=false;
const frozen=await recoverMissingAvgArt(repaired.history,[]);
assert.equal(frozen.repaired,0);assert.equal(frozen.history,repaired.history);
globalThis.avgAvailabilityFixture.loadFailure=true;
const unavailable=await recoverMissingAvgArt(history,[]);
assert.equal(unavailable.repaired,0);assert.equal(unavailable.history,history);
console.log('Missing scene recovery: absent/unreadable files never count as restored, successful repair is immutable and idempotent, frozen identity and unavailable storage preserved.');
`;
const storageFixture={name:'offline-art-storage',setup(builder){
 builder.onResolve({filter:/\/packStore$/},()=>({path:'packStore',namespace:'availability-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'availability-fixture'},()=>({loader:'js',contents:String.raw`
export const getAvgPackCatalog=()=>({scenes:globalThis.avgAvailabilityFixture.scenes,portraits:[]});
export const loadAvgPackCatalog=async()=>{if(globalThis.avgAvailabilityFixture.loadFailure)throw new Error('offline load failure');};
export const isAvgPackImage=image=>typeof image==='string'&&image.startsWith('avgpack://');
export const getAvgPackImageBlob=async()=>{if(globalThis.avgAvailabilityFixture.readFailure)throw new Error('offline read failure');return globalThis.avgAvailabilityFixture.present?new Blob(['fixture']):undefined;};
export const findUniqueLegacyAvgAsset=(id,assets)=>{const matches=assets.filter(asset=>asset.legacyAssetIds?.includes(id));return matches.length===1?matches[0]:undefined;};
`}));
}};
const availabilityResult=await build({stdin:{contents:availabilitySource,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[storageFixture]});
await import('data:text/javascript;base64,'+Buffer.from(availabilityResult.outputFiles[0].text).toString('base64'));
