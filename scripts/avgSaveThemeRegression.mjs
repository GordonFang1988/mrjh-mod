import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source=String.raw`
import assert from 'node:assert/strict';
import { 创建会话生命周期工作流 } from './hooks/useGame/sessionLifecycleWorkflow';
import { 创建存档数据, 执行读取存档 } from './hooks/useGame/saveCoordinator';
import { 规范化游戏设置 } from './utils/gameSettings';
import { 标准化开局预设方案 } from './utils/customNewGamePresets';
const prompts=[{id:'core_world',标题:'世界',内容:'测试',类型:'核心',启用:true}];
const world={worldName:'测试世界',worldSize:'九州宏大',dynastySetting:'测试',sectDensity:'适中',
 tianjiaoSetting:'测试',worldExtraRequirement:'',manualWorldPrompt:'离线世界设定',manualRealmPrompt:'',difficulty:'normal'};
const npc={姓名:'测试侠客',年龄:18,性别:'男',天赋列表:[],出身背景:{名称:'普通人',描述:'测试',效果:'测试'}};
const opening=[];
globalThis.avgThemeOpeningCalls=opening;
const noOp=()=>{};
const deps=new Proxy({apiConfig:{},gameConfig:规范化游戏设置({AVG主题:'shuihu-jinpingmei',启用修炼体系:false}),
 view:'new_game',prompts,设置游戏设置:value=>{deps.appliedConfig=value;},深拷贝:value=>structuredClone(value),
 创建开场基础状态:()=>({角色:npc,环境:{},社交:[],世界:{},战斗:{},剧情:{},任务列表:[],约定列表:[]}),
 创建开场命令基态:()=>({}),获取当前视觉设置快照:()=>({}),获取当前场景图片档案快照:()=>({}),
 设置历史记录:value=>{deps.history=typeof value==='function'?value(deps.history||[]):value;},
 设置最近开局配置:value=>{deps.recent=value;},ensurePromptsLoaded:async()=>prompts,
 环境:{},角色:npc,世界:{},社交:[],战斗:{},玩家门派:{},剧情:{},历史记录:[],记忆系统:{},任务列表:[],约定列表:[],
 剧情规划:{},女主剧情规划:{},同人剧情规划:{},同人女主剧情规划:{},替换流式草稿为失败提示:value=>value},
 {get(target,key){return key in target?target[key]:noOp;}});
const workflow=创建会话生命周期工作流(deps);
await workflow.handleGenerateWorld({...world,AVG主题:'tianlong'},npc,undefined,'all',true);
assert.equal(deps.appliedConfig.AVG主题,'tianlong');assert.equal(opening.at(-1).AVG主题,'tianlong');
assert.equal(deps.gameConfig.AVG主题,'shuihu-jinpingmei'); // Existing render's closure still holds the old value.
assert.equal(deps.recent.worldConfig.AVG主题,'tianlong');
await workflow.handleGenerateWorld({...world,AVG主题:''},npc,undefined,'all',true);
assert.equal(deps.appliedConfig.AVG主题,'');assert.equal(opening.at(-1).AVG主题,'');
await workflow.handleGenerateWorld(world,npc,undefined,'all',true);
assert.equal(deps.appliedConfig.AVG主题,'');assert.equal(opening.at(-1).AVG主题,'');
deps.view='game';deps.gameConfig=规范化游戏设置({AVG主题:'tianlong',启用修炼体系:false});
await workflow.handleGenerateWorld(world,npc,undefined,'all',true);
assert.equal(opening.at(-1).AVG主题,'tianlong'); // Legacy restart retains this save's theme.
const preset={id:'theme-preset',名称:'测试方案',worldConfig:{...world,AVG主题:'tianlong'},character:{姓名:'测试侠客',属性:{}},openingStreaming:true};
assert.equal(标准化开局预设方案(preset).worldConfig.AVG主题,'tianlong');
assert.equal(标准化开局预设方案({...preset,worldConfig:world}).worldConfig.AVG主题,'');
const readConfigs=[];
const saveDeps=new Proxy({规范化游戏设置,深拷贝:value=>structuredClone(value),
 获取当前游戏设置:()=>规范化游戏设置({AVG主题:'shuihu-jinpingmei'}),
 规范化社交列表:value=>value,规范化记忆系统:value=>value||{},
 获取当前视觉设置:()=>({}),setGameConfig:value=>readConfigs.push(value),
 获取当前提示词池:()=>[],规范化视觉设置:value=>value,规范化场景图片档案:value=>value,
 获取当前状态:()=>({gameConfig:规范化游戏设置({AVG主题:'shuihu-jinpingmei'}),history:[],social:[],role:npc,
 env:{},world:{},battle:{},sect:{},tasks:[],agreements:[],story:{},memory:{}}),存档格式版本:3},
 {get(target,key){return key in target?target[key]:noOp;}});
const saveA={历史记录:[],社交:[],角色数据:npc,游戏设置:规范化游戏设置({AVG主题:'tianlong'})};
const saveB={...saveA,游戏设置:规范化游戏设置({AVG主题:'shuihu-jinpingmei'})};
await 执行读取存档(saveA,saveDeps);await 执行读取存档(saveB,saveDeps);await 执行读取存档(saveA,saveDeps);
assert.deepEqual(readConfigs.map(c=>c.AVG主题),['tianlong','shuihu-jinpingmei','tianlong']);
await 执行读取存档({...saveA,游戏设置:undefined},saveDeps);assert.equal(readConfigs.at(-1).AVG主题,'');
const saved=创建存档数据('auto',{历史记录:[],社交:[],角色:npc,环境:{},世界:{},战斗:{},玩家门派:{},任务列表:[],约定列表:[],剧情:{},gameConfig:saveB.游戏设置},saveDeps,undefined,{gameConfig:saveA.游戏设置});
assert.equal(saved.游戏设置.AVG主题,'tianlong');
console.log('AVG save theme passed: desktop/mobile opening payload, stale closure override, general default, preset round-trip, per-slot reads, opening autosave snapshot. No provider or player database writes.');
`;
const plugin={name:'offline-save-theme-boundaries',setup(builder){
 builder.onResolve({filter:/\/openingStoryWorkflow$/},()=>({path:'opening',namespace:'theme-fixture'}));
 builder.onResolve({filter:/\/apiConfig$/},()=>({path:'api',namespace:'theme-fixture'}));
 builder.onResolve({filter:/\/ai\/text$/},()=>({path:'ai',namespace:'theme-fixture'}));
 builder.onResolve({filter:/\/dbService$/},()=>({path:'db',namespace:'theme-fixture'}));
 builder.onResolve({filter:/\/packStore$/},()=>({path:'pack',namespace:'theme-fixture'}));
 builder.onLoad({filter:/.*/,namespace:'theme-fixture'},args=>({loader:'js',contents:{
 opening:'export const 执行开场剧情生成工作流=async(...args)=>{globalThis.avgThemeOpeningCalls.push(args[5].gameConfig);};',
 api:'export const 获取主剧情接口配置=()=>({model:"offline"});export const 接口配置是否可用=()=>true;',
 ai:'export const 解析世界观提示词内容=value=>value;export const 解析境界体系提示词内容=value=>value;export const generateWorldData=async()=>{throw Error("Unexpected provider call");};export const generateFandomRealmData=generateWorldData;',
 db:'export const 保存设置=async()=>{};export const 保存存档=async()=>{};export const 读取图片资源=async()=>undefined;',
 pack:'export const loadAvgPackCatalog=async()=>{};export const getAvgPackCatalog=()=>({scenes:[],portraits:[]});export const findUniqueLegacyAvgAsset=()=>undefined;export const isAvgPackImage=()=>false;export const getAvgPackImageBlob=async()=>undefined;'
 }[args.path]}));
}};
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',plugins:[plugin]});
await mkdir('work/regression',{recursive:true});
const output='work/regression/avgSaveThemeRegression.bundle.mjs';
await writeFile(output,result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/'+output).href);
