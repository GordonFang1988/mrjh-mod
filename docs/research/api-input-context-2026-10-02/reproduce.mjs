// Offline research only. Run from the game repository root.
// Upstream clones must match the commits documented in API_INPUT_CONTEXT_RESEARCH_2026-10-02.md.
// A player-fork integrity warning is expected: the mock response does not echo its canary.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root=process.cwd(), evidence=resolve(root,'work/input-context-research-2026-10-02');
const versions=[['current',root],['original',join(evidence,'original')],['player',join(evidence,'player')]];
const paths=['hooks/useGame/worldEvolutionWorkflow.ts','hooks/useGame/worldEvolutionUtils.ts','hooks/useGame/planningUpdateWorkflow.ts',
 'hooks/useGame/recallWorkflow.ts','hooks/useGame/memoryRecall.ts','hooks/useGame/historyUtils.ts','prompts/runtime/recall.ts',
 'prompts/runtime/worldEvolution.ts','prompts/runtime/worldEvolutionCot.ts','prompts/runtime/planningAnalysis.ts',
 'prompts/runtime/planUpdateReference.ts','services/novelDecompositionInjection.ts','utils/worldbook.ts',
 'utils/promptFeatureToggles.ts','services/ai/storyTasks.ts','services/ai/chatCompletionClient.ts','utils/apiConfig.ts'];
const normalizedHash=text=>createHash('sha256').update(text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')).digest('hex');
const report={scope:'offline synthetic measurements; counts are Unicode characters, never estimated tokens',versions:[],comparison:[]};
for(const path of paths){
 const hashes=Object.fromEntries(await Promise.all(versions.map(async([label,dir])=>[label,normalizedHash(await readFile(join(dir,path),'utf8'))])));
 report.comparison.push({file:path,identicalCurrentOriginal:hashes.current===hashes.original,identicalOriginalPlayer:hashes.original===hashes.player,hashes});
}
const values=new Map();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});
globalThis.location={origin:'https://offline.invalid',hostname:'offline.invalid',protocol:'https:',href:'https://offline.invalid/'};
const originalFetch=globalThis.fetch;
const chars=text=>Array.from(String(text)).length;
const occurrences=(text,needle)=>text.split(needle).length-1;
const config={id:'offline',供应商:'openai_compatible',model:'offline-model',baseUrl:'https://offline.invalid/v1',apiKey:'offline-only-no-real-credential',maxTokens:65536};
const emptyPlan={playerName:'测试',currentStoryJson:'{}',currentHeroinePlanJson:'{}',worldJson:'{}',socialJson:'[]',envJson:'{}',recentBodiesText:'测试正文',currentPlanText:'测试规划',auditFocusText:'常规审计'};
await mkdir(join(evidence,'bundles'),{recursive:true});
try {
 for(const [label,dir] of versions){
  const result=await build({stdin:{contents:`
export {generateWorldEvolutionUpdate,generatePlanningAnalysis,generateMemoryRecall} from './services/ai/storyTasks';
export {构建世界演变上下文文本} from './hooks/useGame/worldEvolutionUtils';
export {构建剧情回忆检索上下文,预筛剧情回忆候选} from './hooks/useGame/memoryRecall';
export {剧情回忆检索COT提示词,剧情回忆检索输出格式提示词,构建剧情回忆检索用户提示词} from './prompts/runtime/recall';
export {构建世界演变COT提示词,世界演变COT伪装历史消息提示词} from './prompts/runtime/worldEvolutionCot';
export {数值_世界演化} from './prompts/stats/world';
export {规范化世界状态} from './hooks/useGame/storyState';
export {裁剪修炼体系上下文数据} from './utils/promptFeatureToggles';
export {构建世界书注入文本} from './utils/worldbook';
export {规范化接口设置} from './utils/apiConfig';
export {__runtimeNovelText,__novelLimit} from './services/novelDecompositionInjection';
`,loader:'ts',resolveDir:dir},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[{
   name:'read-only-instrumentation',setup(build){
    build.onResolve({filter:/^@capacitor\//},args=>({path:args.path,namespace:'offline-native'}));
    build.onLoad({filter:/.*/,namespace:'offline-native'},()=>({contents:`export const Capacitor={isNativePlatform:()=>false,getPlatform:()=>'web'}; export const registerPlugin=()=>({}); export const Filesystem={},Directory={},Encoding={},Preferences={},CapacitorHttp={},SystemBars={},SystemBarType={};`,loader:'js'}));
    build.onLoad({filter:/services[\\/]novelDecompositionInjection\.ts$/},async args=>({contents:(await readFile(args.path,'utf8'))+'\nexport {构建实时章节注入文本 as __runtimeNovelText,获取链路上限 as __novelLimit};',loader:'ts'}));
   }
  }]});
  const output=join(evidence,'bundles',label+'.mjs');await writeFile(output,result.outputFiles[0].text);
  const api=await import(pathToFileURL(output).href);
  let captured;
  globalThis.fetch=async(url,init)=>{
   assert.ok(String(url).startsWith('https://offline.invalid/'),'Network is blocked outside fixture');
   captured=JSON.parse(init.body);
   const text='<说明>无需更新</说明><命令>[]</命令>';
   return captured.stream ? new Response('data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})
    : Response.json({choices:[{message:{content:text},finish_reason:'stop'}]});
  };
  const metrics=()=>({messageCount:captured.messages.length,inputChars:captured.messages.reduce((sum,m)=>sum+chars(m.content),0),maxOutputTokens:captured.max_tokens||captured.max_completion_tokens,
    messages:captured.messages.map(m=>({role:m.role,chars:chars(m.content),heading:m.content.split('\n')[0].slice(0,64)}))});
  const entry={version:label,baseline:[],growth:{},recall:[],worldbook:{},novel:{},overlap:{}};
  const context=api.构建世界演变上下文文本({worldEvolutionPrompt:api.数值_世界演化.内容});
  entry.staticWorldRuleChars=chars(api.数值_世界演化.内容);
  await api.generateWorldEvolutionUpdate(context,config,undefined,'',api.世界演变COT伪装历史消息提示词,api.构建世界演变COT提示词({fandom:false}),false,false);
  entry.baseline.push({task:'world-evolution',fandom:false,...metrics()});
  await api.generateWorldEvolutionUpdate(context,config,undefined,'',api.世界演变COT伪装历史消息提示词,api.构建世界演变COT提示词({fandom:true}),true,false);
  entry.baseline.push({task:'world-evolution',fandom:true,...metrics()});
  for(const heroine of [false,true]) for(const fandom of [false,true]) {
   await api.generatePlanningAnalysis({...emptyPlan,heroineEnabled:heroine,fandomEnabled:fandom},config);
   entry.baseline.push({task:'planning',heroine,fandom,...metrics()});
  }
  await api.generateMemoryRecall(api.剧情回忆检索COT提示词+'\n\n'+api.剧情回忆检索输出格式提示词,api.构建剧情回忆检索用户提示词('询问甲','暂无回忆'),config);
  entry.baseline.push({task:'recall',...metrics()});
  const large='测'.repeat(100000), marker='UNIQUE_EXTRA_MARKER_';
  const normalizedWorld=api.规范化世界状态({地图:[{名称:'测试城',描述:large}],江湖史册:[{标题:'旧事件',归档内容:['旧事实']}],已结算事件:[{事件名:'已结束',事件结果:['旧结果']}]});
  const worldContext=api.构建世界演变上下文文本({worldData:normalizedWorld});
  await api.generateWorldEvolutionUpdate(worldContext,config);
  entry.growth.worldMapDescription={worldContextChars:chars(worldContext),receivedChars:metrics().inputChars,retained:captured.messages.some(m=>m.content.includes(large))};
  await api.generatePlanningAnalysis({...emptyPlan,worldJson:JSON.stringify(normalizedWorld,null,2)},config);
  entry.growth.planningWorld={receivedChars:metrics().inputChars,retained:captured.messages.some(m=>m.content.includes(large))};
  await api.generatePlanningAnalysis({...emptyPlan,socialJson:JSON.stringify([{id:'npc',姓名:'甲',记忆:large}],null,2)},config);
  entry.growth.planningSocial={receivedChars:metrics().inputChars,retained:captured.messages.some(m=>m.content.includes(large))};
  const extra=marker+'附'.repeat(10000);
  await api.generateWorldEvolutionUpdate(context,config,undefined,extra);
  entry.growth.worldExtra={receivedChars:metrics().inputChars,copies:captured.messages.reduce((sum,m)=>sum+occurrences(m.content,marker),0)};
  await api.generatePlanningAnalysis({...emptyPlan,extraPrompt:extra},config);
  entry.growth.planningExtra={receivedChars:metrics().inputChars,copies:captured.messages.reduce((sum,m)=>sum+occurrences(m.content,marker),0)};
  const corpusMarker='RAW_CURRENT_TURN_UNIQUE', planMarker='PLAN_CURRENT_TURN_UNIQUE';
  const overlapContext=api.构建世界演变上下文文本({currentTurnBody:corpusMarker,currentTurnPlanText:planMarker,
   scriptText:'历史正文\n'+corpusMarker+'\n【上回合AI剧情规划】'+planMarker});
  entry.overlap={currentBodyCopies:occurrences(overlapContext,corpusMarker),currentPlanCopies:occurrences(overlapContext,planMarker)};
  for(const count of [23,100,1000]) {
   const memory={回忆档案:Array.from({length:count},(_,i)=>({名称:'【回忆'+String(i+1).padStart(3,'0')+'】',回合:i+1,
    原文:'原'.repeat(1500),概括:'摘要'+i+'概'.repeat(100)}))};
   const candidates=api.预筛剧情回忆候选('询问甲',memory,20);
   const corpus=api.构建剧情回忆检索上下文(memory,20,{candidateIds:candidates.map(c=>c.id)});
   entry.recall.push({archives:count,candidates:candidates.length,corpusChars:chars(corpus),rawBlocks:occurrences(corpus,'原文：'),summaryBlocks:occurrences(corpus,'短期记忆：')});
  }
  const memory={回忆档案:Array.from({length:100},(_,i)=>({名称:'【回忆'+String(i+1).padStart(3,'0')+'】',回合:i+1,原文:'原文'+i,概括:'独特旧摘要'+i}))};
  const marked=api.构建剧情回忆检索上下文(memory,20,{candidateIds:['【回忆099】']});
  entry.growth.recallCandidateDoesNotFilter={includesUnselectedOldSummary:marked.includes('独特旧摘要0'),fullRawBlocks:occurrences(marked,'原文：')};
  const makeBook=(sizes,mode)=>[{id:'book',名称:'fixture',启用:true,条目:sizes.map((n,i)=>({id:'entry'+i,标题:'条目'+i,内容:'书'.repeat(n),启用:true,类型:'world_lore',作用域:['world_evolution','story_plan'],注入模式:mode,关键词:['测试']}))}];
  for(const mode of ['always','match_any']) {
   const hugeBook=api.构建世界书注入文本({books:makeBook([100000],mode),scopes:['world_evolution'],extraTexts:['测试']});
   const manyBooks=api.构建世界书注入文本({books:makeBook([3000,3000,3000],mode),scopes:['world_evolution'],extraTexts:['测试']});
   entry.worldbook[mode]={oversizedFirstChars:chars(hugeBook.combinedText),oversizedSelected:hugeBook.selectedEntries.length,manySelected:manyBooks.selectedEntries.length,manyChars:chars(manyBooks.combinedText)};
  }
  const segment={id:'seg',组号:1,处理状态:'已完成',启用注入:true,章节范围:'第一章',章节标题:['第一章'],本组概括:'小说摘要',关键事件:[{事件名:'测试事件',事件说明:large}],前组延续事实:[large],本组结束状态:[large],原著硬约束:[large],角色推进:[]};
  const dataset={id:'dataset',名称:'fixture',分段列表:[segment],注入树:[]};
  entry.novel={defaultDetailedLimit:api.__novelLimit(api.规范化接口设置({}),'planning'),configuredDetailedLimit:api.__novelLimit({功能模型占位:{小说拆分详细注入上限:5000}},'planning'),
   planningRuntimeChars:chars(api.__runtimeNovelText(dataset,'planning',{当前章节:{当前分解组:1}})),worldRuntimeChars:chars(api.__runtimeNovelText(dataset,'world_evolution',{当前章节:{当前分解组:1}}))};
  entry.novel.planningEffectiveCharsAtDefault=entry.novel.defaultDetailedLimit>0 ? Math.min(entry.novel.defaultDetailedLimit,entry.novel.planningRuntimeChars) : entry.novel.planningRuntimeChars;
  assert.ok(entry.growth.worldMapDescription.retained);assert.ok(entry.growth.planningWorld.retained);assert.ok(entry.growth.planningSocial.retained);
  assert.ok(entry.growth.recallCandidateDoesNotFilter.includesUnselectedOldSummary);
  assert.equal(entry.recall[0].rawBlocks,20);
  assert.equal(entry.worldbook.always.oversizedSelected,1);assert.ok(entry.worldbook.always.oversizedFirstChars>100000);
  assert.ok(entry.novel.planningRuntimeChars>100000);assert.ok(entry.novel.worldRuntimeChars>100000);
  report.versions.push(entry);
 }
 await writeFile(join(evidence,'measurements.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({comparison:report.comparison.map(({hashes,...item})=>item),versions:report.versions.map(({baseline,...entry})=>({...entry,baseline:baseline.map(({messages,...metric})=>metric)}))},null,2));
} finally {globalThis.fetch=originalFetch;}
