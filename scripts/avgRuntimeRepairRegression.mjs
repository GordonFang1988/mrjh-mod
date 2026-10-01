import { build } from 'esbuild';
const source = String.raw`
import assert from 'node:assert/strict';
import { parseAvgManifest } from './services/avg/manifest';
import { resolveAvgPortraits } from './services/avg/portraitResolver';
import { buildAvgPresentation } from './services/avg/sceneResolver';
const entry = (id, extra={}) => ({id,file:id+'.webp',version:1,gender:'男',ageRange:{min:18,max:34},visualAge:'young',
    portraitVerified:true,reusePolicy:'unique',profile:{视觉年龄:'young',身份类别:'仆役',服饰类别:'平民布衣'},...extra});
const raw={version:1,portraits:[entry('worker'),entry('wu',{name:'武大郎',themeId:'shuihu-jinpingmei',
    characterKey:'shuihu_jinpingmei:wu-da-lang',ageRange:{min:35,max:44}}),entry('other',{ageRange:{min:35,max:44}})]};
const parsed=parseAvgManifest(raw);assert.deepEqual(parsed.errors,[]);
assert.equal(parsed.portraits.find(x=>x.id==='wu').ageRange.min,30);
assert.equal(parsed.portraits.find(x=>x.id==='other').ageRange.min,35);
const yao={id:'y',姓名:'姚二郎',性别:'男',年龄:18,AVG立绘特征:{视觉年龄:'teen',身份类别:'仆役',服饰类别:'平民布衣'}};
const get=(npc,history=[])=>resolveAvgPortraits([{sender:npc.姓名,text:'测试'}],[npc],history,parsed.portraits,'shuihu-jinpingmei')[npc.姓名];
assert.equal(get(yao).assetId,'worker');
assert.equal(get({...yao,年龄:16}).assetId,undefined);
const wu={...yao,id:'w',姓名:'武大郎',年龄:30};
const prior={structuredResponse:{avgPortraitBindings:{武大郎:{npcId:'w',assetId:'worker',baseAssetId:'worker',reason:'first-match'}}}};
assert.equal(get(wu,[prior]).assetId,'wu');
assert.equal(get({...wu,AVG美术选择:{source:'prefab',assetId:'worker',baseAssetId:'worker'}},[prior]).assetId,'worker');
assert.equal(get({...yao,身份:'改做镖师'},[{structuredResponse:{avgPortraitBindings:{姚二郎:{npcId:'y',assetId:'worker',baseAssetId:'worker',reason:'first-match'}}}}]).assetId,'worker');
const env={大地点:'京东东路',中地点:'清河县',小地点:'紫石街',具体地点:'十字路口'};
const asset={id:'street',version:1,image:'/street.webp',profile:{空间:'城内街道'}};
assert.equal(buildAvgPresentation([{sender:'旁白',text:'开场'}],[],env,[],[asset]).scenes[0].assetId,undefined);
assert.equal(buildAvgPresentation([], [{ref:'s1',地点:env,分类:{空间:'未知'}}],env,[],[asset]).scenes[0].assetId,undefined);
console.log('Named metadata repair, saved generic recovery, numerical age limits, stable ordinary identity and missing scene fields remain neutral: passed');
`;
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
