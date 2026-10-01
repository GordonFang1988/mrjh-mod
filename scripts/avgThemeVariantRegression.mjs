import { build } from 'esbuild';
const source = String.raw`
import assert from 'node:assert/strict';
import { parseAvgManifest } from './services/avg/manifest';
import { namespaceAvgPortraits } from './services/avg/packStore';
import { resolveAvgPortraits } from './services/avg/portraitResolver';
import { avgSamePersonOptions } from './services/avg/identity';
import { 规范化游戏设置 } from './utils/gameSettings';
import { 规范化社交列表 } from './hooks/useGame/stateTransforms';
const entry = (id, extra={}) => ({ id, file:id+'.png',version:1,gender:'男',ageRange:{min:18,max:65},visualAge:'middle',
    portraitVerified:true,reusePolicy:'unique',profile:{视觉年龄:'middle',身份类别:'江湖侠客',服饰类别:'武林袍服'},...extra });
const manifest={ version:1,portraits:[entry('general'),entry('tl',{themeId:'tianlong'}),entry('sh',{themeId:'shuihu-jinpingmei'}),
 entry('named',{themeId:'tianlong',characterKey:'tianlong:hero',name:'具名甲',faceFamilyKey:'same-person'}),
 entry('variant',{themeId:'tianlong',characterKey:'tianlong:hero',baseAssetId:'named',faceFamilyKey:'same-person',variantStage:'后期'}),
 entry('sister',{themeId:'tianlong',characterKey:'tianlong:sibling',name:'具名乙',faceFamilyKey:'same-person'})]};
const parsed=parseAvgManifest(manifest);assert.deepEqual(parsed.errors,[]);
const assets=namespaceAvgPortraits(parsed.portraits,'pack@1');
assert.equal(assets.find(a=>a.variantStage)?.baseAssetId,'pack@1:named');
assert.equal(namespaceAvgPortraits(parsed.portraits,'other@1')[0].id,'other@1:general');
const npc={id:'a',姓名:'具名甲',性别:'男',年龄:40,AVG立绘特征:{视觉年龄:'middle',身份类别:'江湖侠客',服饰类别:'武林袍服'}};
const logs=[{sender:npc.姓名,text:'测试'}];
const resolve=(person=npc, history=[], theme='tianlong', choices=assets)=>resolveAvgPortraits([{sender:person.姓名,text:'测试'}],[person],history,choices,theme)[person.姓名];
const base=resolve();assert.equal(base.assetId,'pack@1:named');assert.equal(base.baseAssetId,base.assetId);
assert.deepEqual(avgSamePersonOptions(base,assets).map(a=>a.id),['pack@1:named','pack@1:variant']);
const generic={...npc,姓名:'普通甲'};
assert.equal(resolve(generic).assetId,'pack@1:tl');
assert.equal(resolve(generic,[],'').assetId,'pack@1:general');
assert.equal(resolve(generic,[],'tianlong',assets.filter(a=>a.id!=='pack@1:tl')).assetId,'pack@1:general');
assert.equal(resolve(generic,[],'tianlong',assets.filter(a=>a.id==='pack@1:sh')).reason,'no-compatible-art');
assert.equal(resolve(generic,[],'tianlong',assets.filter(a=>a.id==='pack@1:variant')).reason,'no-compatible-art');
assert.equal(resolve({...npc,年龄:16},[],'tianlong').reason,'no-compatible-art');
assert.equal(resolve({...npc,AVG具名角色Key:'tianlong:hero',姓名:'别名'}).assetId,'pack@1:named');
const history=[{structuredResponse:{avgPortraitBindings:{[npc.姓名]:base}}}];
const changed={...npc,AVG立绘特征:{视觉年龄:'elder',服饰类别:'乞丐破衣'}};
assert.equal(resolve(changed,history).assetId,base.assetId);
const chosen={...npc,AVG美术选择:{source:'prefab',baseAssetId:base.baseAssetId,assetId:'pack@1:variant'}};
assert.equal(resolve(chosen,history).assetId,'pack@1:variant');
const illegal={...npc,AVG美术选择:{source:'prefab',baseAssetId:'pack@1:sister',assetId:'pack@1:sister'}};
assert.equal(resolve(illegal,history).assetId,base.assetId);
const variantBound=resolve(chosen,history);
const next=resolve({...npc,id:'b',姓名:'普通乙'},[{structuredResponse:{avgPortraitBindings:{[npc.姓名]:variantBound}}}]);
assert.notEqual(next.assetId,'pack@1:named');
const generated={...chosen,图片档案:{已选立绘图片ID:'g',生图历史:[{id:'g',状态:'success',构图:'立绘',图片URL:'/generated.png'}]}};
assert.equal(resolve({...generated,AVG美术选择:{...chosen.AVG美术选择,source:'auto'}},history).assetId,'archive:g');
assert.equal(resolve(generated,history).assetId,'pack@1:variant');
assert.equal(resolve({...chosen,AVG美术选择:{...chosen.AVG美术选择,assetId:base.assetId}},history).assetId,base.assetId);
assert.deepEqual(parseAvgManifest({version:1,portraits:[entry('bad',{baseAssetId:'missing',variantStage:'后期'})]}).errors,
 ['portrait bad has invalid same-person base']);
assert.ok(parseAvgManifest({version:1,portraits:[entry('bad',{variantStage:'后期'})]}).errors.length);
assert.equal(规范化游戏设置({AVG主题:'tianlong'}).AVG主题,'tianlong');
assert.equal(规范化游戏设置({}).AVG主题,'');
const normalized=规范化社交列表([chosen],{合并同名:false});
assert.deepEqual(normalized[0].AVG美术选择,chosen.AVG美术选择);
const saved=JSON.parse(JSON.stringify({游戏设置:规范化游戏设置({AVG主题:'tianlong'}),社交:normalized,历史记录:history}));
assert.equal(saved.游戏设置.AVG主题,'tianlong');assert.equal(saved.社交[0].AVG美术选择.assetId,'pack@1:variant');
console.log('AVG real resolver/manifest contracts: theme isolation, named identity, age gates, namespaces, same-person variants, generated priority, normalization passed');
`;
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd(),sourcefile:'avgThemeVariantRegression.entry.ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
