import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import { parseStoryRawText, 解析命令块 } from './services/ai/storyResponseParser.ts';
import { buildAvgPresentation, sceneAssetsFromArchive } from './services/avg/sceneResolver.ts';
import { normalizeAvgHints, AVG_VOCABULARY_VERSION, AVG_FULL_PROTOCOL_PROMPT } from './services/avg/vocabulary.ts';
import { resolveAvgPortraits } from './services/avg/portraitResolver.ts';
import { parseAvgManifest } from './services/avg/manifest.ts';
import { normalizeAvgPortraitProfile } from './services/avg/portraitVocabulary.ts';
import { 规范化社交列表 } from './hooks/useGame/stateTransforms.ts';
import { 构建变量模型输出格式提示词 } from './prompts/runtime/variableModel.ts';

const env = { 大地点:'江南', 中地点:'苏州', 小地点:'渡口', 具体地点:'江面', 时间:'', 天气:{天气:'晴',结束日期:''}, 节日:null, 环境变量:[] };
const assets = [
  { id:'river', version:1, image:'/river.webp', profile:{空间:'江面',地域:'江南'} },
  { id:'sea', version:1, image:'/sea.webp', profile:{空间:'海面',地域:'江南'} },
  { id:'inn', version:1, image:'/inn.webp', profile:{空间:'客栈大堂',地域:'江南'} },
];
const text = '<正文>\n<镜头 ref="s1"/>\n【旁白】你离开客栈。\n<镜头 ref="s2"/>\n【船夫】船已开了。\n</正文>\n<短期记忆>前往江上</短期记忆>\n<演出场景>{"词表版本":"' + AVG_VOCABULARY_VERSION + '","场景":[{"ref":"s1","地点":{"大地点":"江南","中地点":"苏州","小地点":"客栈","具体地点":"大堂"},"分类":{"空间":"客栈大堂","地域":"江南"}},{"ref":"s2","地点":{"大地点":"江南","中地点":"苏州","小地点":"渡口","具体地点":"江面"},"分类":{"空间":"江面","地域":"江南"}}]}</演出场景>';
const withoutBodyWrapper = parseStoryRawText('<thinking>测试思考</thinking>\n' + text.replace('<正文>', '').replace('</正文>', ''));
assert.deepEqual(withoutBodyWrapper.logs.map(log => log.avgSceneRef), ['s1','s2']);
assert.ok(withoutBodyWrapper.logs.every(log => !log.text.includes('词表版本')));
assert.equal(withoutBodyWrapper.avgSceneHints?.length, 2);
const parsed = parseStoryRawText(text);
assert.equal(parsed.logs.length, 2);
assert.deepEqual(parsed.logs.map(log => log.avgSceneRef), ['s1','s2']);
assert.ok(parsed.logs.every(log => !log.text.includes('镜头')));
assert.equal(parsed.avgSceneHints?.length, 2);
const presentation = buildAvgPresentation(parsed.logs, parsed.avgSceneHints, env, [], assets);
assert.equal(presentation.mode, 'multi');
assert.deepEqual(presentation.scenes.map(scene => scene.assetId), ['inn','river']);
const finalOnlyWithoutMarkers = buildAvgPresentation(parsed.logs.map(log => ({...log, avgSceneRef:undefined})), parsed.avgSceneHints, env, [], assets);
assert.equal(finalOnlyWithoutMarkers.mode, 'final');
assert.equal(finalOnlyWithoutMarkers.scenes[0].assetId, 'river');
assert.equal(finalOnlyWithoutMarkers.scenes[0].ref, 'final');

const returnText = '<正文>\n<镜头 ref="s1"/>\n【旁白】客栈里商议行程。\n<镜头 ref="s2"/>\n【旁白】乘船驶上江面。\n<镜头 ref="s1"/>\n【旁白】回到同一间客栈。\n</正文>\n<短期记忆>往返江面。</短期记忆>\n<演出场景>{"词表版本":"' + AVG_VOCABULARY_VERSION + '","场景":[{"ref":"s1","地点":{"大地点":"江南","中地点":"苏州","小地点":"客栈","具体地点":"大堂"},"分类":{"空间":"客栈大堂","地域":"江南"}},{"ref":"s2","地点":{"大地点":"江南","中地点":"苏州","具体地点":"江面"},"分类":{"空间":"江面","地域":"江南"}}]}</演出场景>';
const returned = parseStoryRawText(returnText);
const returnPresentation = buildAvgPresentation(returned.logs, returned.avgSceneHints,
  {...env, 小地点:'客栈', 具体地点:'大堂'}, [], assets);
assert.equal(returnPresentation.mode, 'multi');
assert.deepEqual(returned.logs.map(log => log.avgSceneRef), ['s1','s2','s1']);
assert.deepEqual(returnPresentation.scenes.map(scene => scene.placeKey), ['江南/苏州/客栈/大堂','江南/苏州//江面']);
const history = [{role:'assistant',content:'',timestamp:1,structuredResponse:{logs:[],avgPresentation:presentation}}];
const withNewAsset = [...assets, {id:'a-better-river',version:1,image:'/better.webp',profile:{空间:'江面',地域:'江南'}}];
const repeat = buildAvgPresentation(parsed.logs, parsed.avgSceneHints, env, history, withNewAsset);
assert.equal(repeat.scenes[1].assetId,'river');
const archive = {生图历史:[
  {id:'tagged',状态:'success',本地路径:'/tagged.webp',AVG分类:{空间:'江面',地域:'江南',场所功能:'船舶',空间规模:'开阔'}},
  {id:'untagged',状态:'success',本地路径:'/untagged.webp'}
]};
const catalog = sceneAssetsFromArchive(archive);
assert.ok(catalog.some(item => item.id === 'archive:tagged'));
assert.equal(catalog.find(item => item.id === 'archive:tagged')?.profile.场所功能,'船舶');
assert.equal(buildAvgPresentation(parsed.logs,parsed.avgSceneHints,env,[],catalog).scenes[1].assetId,'archive:tagged');
assert.equal(buildAvgPresentation(parsed.logs,parsed.avgSceneHints,env,history,catalog,{'江南/苏州/渡口/江面':'archive:untagged'}).scenes[1].assetId,'archive:untagged');
assert.equal(buildAvgPresentation(parsed.logs,parsed.avgSceneHints,env,history,catalog,{'江南/苏州/渡口/江面':'neutral'}).scenes[1].assetId,undefined);
const wrongFinal = buildAvgPresentation(parsed.logs, parsed.avgSceneHints, {...env,具体地点:'岸边'}, [], assets);
assert.equal(wrongFinal.mode,'final');
assert.equal(wrongFinal.scenes.length,1);
const boatHints = parsed.avgSceneHints.map(hint => hint.ref === 's2'
  ? {...hint, 地点:{...hint.地点,小地点:'江面'}, 分类:{...hint.分类,视点:'舟上'}} : hint);
const settledBoat = {...env,小地点:'江面',具体地点:'乌篷船'};
assert.equal(buildAvgPresentation(parsed.logs,boatHints,settledBoat,[],assets).mode,'multi');
assert.equal(buildAvgPresentation(parsed.logs,boatHints,{...settledBoat,具体地点:'船舱'},[],assets).mode,'final');
assert.equal(buildAvgPresentation(parsed.logs,boatHints,{...settledBoat,小地点:'渡口'},[],assets).mode,'final');
assert.deepEqual(normalizeAvgHints({词表版本:AVG_VOCABULARY_VERSION,场景:[{ref:'s1',分类:{空间:'不存在'}}]}), []);
const barbicanEnv = {...env, 小地点:'府城南门', 具体地点:'瓮城内'};
const barbicanHints = normalizeAvgHints({词表版本:AVG_VOCABULARY_VERSION,场景:[{
  ref:'s1',地点:{大地点:'江南',中地点:'苏州',小地点:'府城南门',具体地点:'瓮城内'},
  分类:{空间:'瓮城内',地表:'石板'}
}]});
assert.equal(barbicanHints[0]?.分类.空间,'瓮城内');
const barbicanAssets = [
  {id:'outside-gate',version:1,image:'/outside.webp',profile:{空间:'城门外',地表:'石板'}},
  {id:'inside-barbican',version:1,image:'/barbican.webp',profile:{空间:'瓮城内',地表:'石板'}}
];
const barbicanPresentation = buildAvgPresentation([parsed.logs[0]],barbicanHints,barbicanEnv,[],barbicanAssets);
assert.equal(barbicanPresentation.scenes[0].assetId,'inside-barbican');
assert.equal(barbicanPresentation.scenes[0].placeKey,'江南/苏州/府城南门/瓮城内');
const officeAssets = [
  {id:'generic-street',version:1,image:'/street.webp',profile:{空间:'城内街道',场所体系:'通用'}},
  {id:'office-street',version:1,image:'/office.webp',profile:{空间:'城内街道',场所体系:'官署'}}
];
const officeEnv = {...env,小地点:'府衙',具体地点:'外街'};
const officeHint = [{ref:'s1',地点:{大地点:'江南',中地点:'苏州',小地点:'府衙',具体地点:'外街'},分类:{空间:'城内街道',场所体系:'官署'}}];
assert.equal(buildAvgPresentation([parsed.logs[0]],officeHint,officeEnv,[],officeAssets).scenes[0].assetId,'office-street');
const yardAssets = [
  {id:'poor-home',version:1,image:'/poor-home.webp',profile:{空间:'院落',地域:'江南',场所体系:'宅院',场所功能:'民居',装潢档次:'简陋',完好程度:'破败',空间规模:'狭小'}},
  {id:'rich-home',version:1,image:'/rich-home.webp',profile:{空间:'院落',地域:'江南',场所体系:'宅院',场所功能:'府邸',装潢档次:'富丽',完好程度:'完好',空间规模:'开阔'}},
  {id:'yamen-yard',version:1,image:'/yamen-yard.webp',profile:{空间:'院落',地域:'江南',场所体系:'官署',场所功能:'衙门',装潢档次:'普通',完好程度:'完好',空间规模:'开阔'}},
  {id:'smith-yard',version:1,image:'/smith-yard.webp',profile:{空间:'院落',地域:'江南',场所体系:'商旅',场所功能:'铁匠铺',装潢档次:'简陋',完好程度:'陈旧',空间规模:'狭小'}}
];
const yardEnv = {...env,小地点:'王家',具体地点:'小院'};
const yardLocation = {大地点:'江南',中地点:'苏州',小地点:'王家',具体地点:'小院'};
const yardHints = normalizeAvgHints({词表版本:AVG_VOCABULARY_VERSION,场景:[{
  ref:'s1',地点:yardLocation,分类:{空间:'院落',地域:'江南',场所体系:'宅院',场所功能:'民居',装潢档次:'简陋',完好程度:'破败',空间规模:'狭小'}
}]});
assert.equal(yardHints[0]?.分类.场所功能,'民居');
assert.equal(yardHints[0]?.分类.空间规模,'狭小');
assert.equal(buildAvgPresentation([parsed.logs[0]],yardHints,yardEnv,[],yardAssets).scenes[0].assetId,'poor-home');
const incompleteYardAssets = [
  {...yardAssets[0], profile:{...yardAssets[0].profile,地域:'西北',装潢档次:'普通',完好程度:'完好',空间规模:'开阔'}},
  {id:'untagged-yard',version:1,image:'/untagged.webp',profile:{空间:'院落',地域:'江南',场所体系:'宅院',装潢档次:'简陋',完好程度:'破败',空间规模:'狭小'}}
];
assert.equal(buildAvgPresentation([parsed.logs[0]],yardHints,yardEnv,[],incompleteYardAssets).scenes[0].assetId,'poor-home');
const yamenHints = [{...yardHints[0],分类:{...yardHints[0].分类,场所体系:'官署',场所功能:'衙门',装潢档次:'普通',完好程度:'完好',空间规模:'开阔'}}];
assert.equal(buildAvgPresentation([parsed.logs[0]],yamenHints,yardEnv,[],yardAssets).scenes[0].assetId,'yamen-yard');
const smithHints = [{...yardHints[0],分类:{...yardHints[0].分类,场所体系:'商旅',场所功能:'铁匠铺',完好程度:'陈旧'}}];
assert.equal(buildAvgPresentation([parsed.logs[0]],smithHints,yardEnv,[],yardAssets).scenes[0].assetId,'smith-yard');
assert.equal(buildAvgPresentation([parsed.logs[0]],smithHints,yardEnv,[],yardAssets.slice(0,3)).scenes[0].assetId,undefined);
const marketAssets = [
  {id:'horse-market',version:1,image:'/horse.webp',profile:{空间:'市集',显著要素:['马栏']}},
  {id:'seafood-market',version:1,image:'/seafood.webp',profile:{空间:'市集',显著要素:['海味摊']}}
];
const marketHint = normalizeAvgHints({词表版本:AVG_VOCABULARY_VERSION,场景:[{ref:'s1',分类:{空间:'市集',显著要素:['马栏']}}]});
assert.deepEqual(marketHint[0]?.分类.显著要素,['马栏']);
assert.equal(buildAvgPresentation([parsed.logs[0]],marketHint,env,[],marketAssets).scenes[0].assetId,'horse-market');
const old = parseStoryRawText('<正文>【旁白】旧剧情</正文><短期记忆>无</短期记忆>');
assert.equal(old.logs[0].text,'旧剧情');
assert.equal(buildAvgPresentation(old.logs, old.avgSceneHints, env, [], assets).mode,'final');
const adultRange = {min:18,max:39};
const portraitAssets = [
  {id:'elder-man',version:1,image:'/elder.webp',gender:'男',ageRange:{min:60,max:120},visualAge:'elder',portraitVerified:true,reusePolicy:'unique'},
  {id:'young-woman',version:1,image:'/woman.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',roleTags:['侠客']},
];
const woman = {id:'npc-1',姓名:'林姑娘',性别:'女',年龄:24,身份:'侠客',外貌描写:'年轻侠客'};
const portraitLog = [{sender:'林姑娘',text:'走吧。'}];
assert.equal(resolveAvgPortraits(portraitLog,[woman],[],portraitAssets)['林姑娘'].assetId,'young-woman');
assert.equal(resolveAvgPortraits(portraitLog,[woman],[],portraitAssets.slice(0,1))['林姑娘'].assetId,undefined);
const sameName = {...woman,id:'npc-2'};
assert.equal(Object.keys(resolveAvgPortraits(portraitLog,[woman,sameName],[],portraitAssets)).length,0);
const occupiedHistory = [{role:'assistant',content:'',timestamp:1,structuredResponse:{logs:[],avgPortraitBindings:{'另一人':{npcId:'npc-3',assetId:'young-woman',reason:'first-match'}}}}];
assert.equal(resolveAvgPortraits(portraitLog,[woman],occupiedHistory,portraitAssets)['林姑娘'].assetId,undefined);
const classifiedWoman = {...woman,AVG立绘特征:{视觉年龄:'青年',服饰类别:'江湖劲装',体态:'匀称',发色:'黑发'}};
const outfitAssets = [
  {id:'monk-woman',version:1,image:'/monk.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{服饰类别:'僧衣',发色:'黑发'}},
  {id:'swordswoman',version:1,image:'/sword.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{服饰类别:'江湖劲装',发色:'黑发'}}
];
assert.equal(resolveAvgPortraits(portraitLog,[classifiedWoman],[],outfitAssets)['林姑娘'].assetId,'swordswoman');
assert.equal(resolveAvgPortraits(portraitLog,[classifiedWoman],[],outfitAssets.slice(0,1))['林姑娘'].assetId,undefined);
const archetypeAssets = [
  {id:'monk',version:1,image:'/monk.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{江湖形象:'僧人',身份类别:'门派弟子',服饰类别:'僧衣'}},
  {id:'taoist',version:1,image:'/taoist.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{江湖形象:'道士',身份类别:'门派弟子',服饰类别:'道袍'}},
  {id:'beggar',version:1,image:'/beggar.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{江湖形象:'乞丐',身份类别:'门派长辈',服饰类别:'乞丐破衣'}}
];
const monkNpc = {...woman,身份:'少林寺女弟子',AVG立绘特征:{视觉年龄:'young',身份类别:'门派弟子',江湖形象:'僧人',服饰类别:'僧衣'}};
assert.equal(resolveAvgPortraits(portraitLog,[monkNpc],[],archetypeAssets)['林姑娘'].assetId,'monk');
assert.equal(resolveAvgPortraits(portraitLog,[woman],[],archetypeAssets)['林姑娘'].assetId,undefined);
assert.equal(resolveAvgPortraits(portraitLog,[{...monkNpc,AVG立绘特征:{视觉年龄:'young',身份类别:'门派长辈',江湖形象:'乞丐',服饰类别:'乞丐破衣'}}],[],archetypeAssets)['林姑娘'].assetId,'beggar');
const roleAssets = [
  {id:'healer',version:1,image:'/healer.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{身份类别:'医者',服饰类别:'江湖劲装'}},
  {id:'escort',version:1,image:'/escort.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{身份类别:'镖师',服饰类别:'江湖劲装'}}
];
assert.equal(resolveAvgPortraits(portraitLog,[{...woman,AVG立绘特征:{身份类别:'医者',服饰类别:'江湖劲装'}}],[],roleAssets)['林姑娘'].assetId,'healer');
const bodyAssets = [
  {id:'adult-slim',version:1,image:'/slim.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{服饰类别:'江湖劲装',体态:'匀称',身高:'高挑',发型:'披发',衣装剪裁:'修身',上身轮廓:'纤薄',腰臀轮廓:'平直',露肤程度:'保守'}},
  {id:'adult-curvy',version:1,image:'/curvy.webp',gender:'女',ageRange:adultRange,visualAge:'young',portraitVerified:true,reusePolicy:'unique',profile:{服饰类别:'江湖劲装',体态:'匀称',身高:'高挑',发型:'披发',衣装剪裁:'修身',上身轮廓:'丰满',腰臀轮廓:'曲线明显',露肤程度:'较高'}}
];
const adultWoman = {...woman,AVG立绘特征:{视觉年龄:'young',服饰类别:'江湖劲装',体态:'匀称',身高:'高挑',发型:'披发',衣装剪裁:'修身',上身轮廓:'丰满',腰臀轮廓:'曲线明显',露肤程度:'较高'}};
assert.equal(resolveAvgPortraits(portraitLog,[adultWoman],[],bodyAssets)['林姑娘'].assetId,'adult-curvy');
assert.equal(resolveAvgPortraits(portraitLog,[{...adultWoman,年龄:18}],[],bodyAssets)['林姑娘'].assetId,'adult-curvy');
assert.equal(resolveAvgPortraits(portraitLog,[{...adultWoman,年龄:39}],[],bodyAssets)['林姑娘'].assetId,'adult-curvy');
assert.equal(resolveAvgPortraits(portraitLog,[{...adultWoman,年龄:40}],[],bodyAssets)['林姑娘'].assetId,undefined);
assert.deepEqual(normalizeAvgPortraitProfile({视觉年龄:'young',上身轮廓:'丰满',腰臀轮廓:'曲线明显',露肤程度:'较高'}),{视觉年龄:'young',上身轮廓:'丰满',腰臀轮廓:'曲线明显',露肤程度:'较高'});
assert.equal(resolveAvgPortraits(portraitLog,[{...woman,年龄:16,AVG立绘特征:{视觉年龄:'teen',服饰类别:'江湖劲装'}}],[],bodyAssets)['林姑娘'].assetId,undefined);
assert.equal(resolveAvgPortraits(portraitLog,[{...woman,年龄:16,AVG立绘特征:{视觉年龄:'young',服饰类别:'江湖劲装'}}],[],bodyAssets)['林姑娘'].assetId,undefined);
const monkBindingHistory = [{role:'assistant',content:'',timestamp:1,structuredResponse:{logs:[],avgPortraitBindings:{'林姑娘':{npcId:'npc-1',assetId:'monk',image:'/monk.webp',reason:'first-match'}}}}];
assert.equal(resolveAvgPortraits(portraitLog,[{...monkNpc,身份:'已退出少林'}],monkBindingHistory,archetypeAssets)['林姑娘'].assetId,'monk');
const taoistNpc = {...monkNpc,身份:'已换道袍',AVG立绘特征:{视觉年龄:'young',身份类别:'门派弟子',江湖形象:'道士',服饰类别:'道袍'}};
assert.equal(resolveAvgPortraits(portraitLog,[taoistNpc],monkBindingHistory,archetypeAssets)['林姑娘'].assetId,'monk');
assert.equal(resolveAvgPortraits(portraitLog,[taoistNpc],monkBindingHistory,archetypeAssets)['林姑娘'].image,'/monk.webp');
const beggarNpc = {...monkNpc,身份:'已加入丐帮',AVG立绘特征:{视觉年龄:'young',身份类别:'门派弟子',江湖形象:'乞丐',服饰类别:'乞丐破衣'}};
assert.equal(resolveAvgPortraits(portraitLog,[beggarNpc],monkBindingHistory,archetypeAssets)['林姑娘'].assetId,'monk');
assert.equal(resolveAvgPortraits(portraitLog,[beggarNpc],monkBindingHistory,archetypeAssets.filter(asset => asset.id !== 'monk'))['林姑娘'].assetId,'monk');
const taoistBindingHistory = [{role:'assistant',content:'',timestamp:1,structuredResponse:{logs:[],avgPortraitBindings:{'林姑娘':{npcId:'npc-1',assetId:'taoist',image:'/taoist.webp',reason:'first-match'}}}}];
assert.equal(resolveAvgPortraits(portraitLog,[beggarNpc],taoistBindingHistory,archetypeAssets)['林姑娘'].assetId,'taoist');
const selectedBeggarNpc = {...beggarNpc,图片档案:{已选立绘图片ID:'same-person-new-art',生图历史:[{id:'same-person-new-art',状态:'success',构图:'立绘',本地路径:'/same-person-new-art.webp'}]}};
assert.equal(resolveAvgPortraits(portraitLog,[selectedBeggarNpc],monkBindingHistory,archetypeAssets)['林姑娘'].assetId,'archive:same-person-new-art');
assert.deepEqual(normalizeAvgPortraitProfile({江湖形象:'道士',服饰类别:'僧衣'}),{江湖形象:'僧人',服饰类别:'僧衣'});
assert.equal(normalizeAvgPortraitProfile({江湖形象:'少林'}),undefined);
assert.deepEqual(normalizeAvgPortraitProfile({视觉年龄:'青年',服饰类别:'江湖劲装',发色:'彩虹色'}),{视觉年龄:'young',服饰类别:'江湖劲装'});
const normalizedNpc = 规范化社交列表([{...classifiedWoman,AVG立绘特征:{视觉年龄:'青年',服饰类别:'江湖劲装',发色:'彩虹色'}}],{合并同名:false})[0];
assert.deepEqual(normalizedNpc.AVG立绘特征,{视觉年龄:'young',服饰类别:'江湖劲装'});
const archiveCommand = 解析命令块('{"action":"registerNpc","npcId":"npc-visual","npcName":"林姑娘","value":{"id":"npc-visual","姓名":"林姑娘","性别":"女","年龄":24,"身份":"侠客","简介":"江湖侠客","记忆":[],"AVG立绘特征":{"视觉年龄":"青年","服饰类别":"江湖劲装","上身轮廓":"丰满","腰臀轮廓":"曲线明显","露肤程度":"较高"}}}');
assert.equal(archiveCommand[0].action,'registerNpc');
assert.equal(规范化社交列表([archiveCommand[0].value],{合并同名:false})[0].AVG立绘特征.服饰类别,'江湖劲装');
assert.equal(规范化社交列表([archiveCommand[0].value],{合并同名:false})[0].AVG立绘特征.腰臀轮廓,'曲线明显');
assert.ok(AVG_FULL_PROTOCOL_PROMPT.includes('AVG立绘特征'));
assert.ok(构建变量模型输出格式提示词().includes('AVG立绘特征'));
const generatedWoman = {...woman,图片档案:{已选立绘图片ID:'made-1',生图历史:[
  {id:'made-1',状态:'success',构图:'立绘',本地路径:'data:image/png;base64,AAAA'}
]}};
const selectedBinding = resolveAvgPortraits(portraitLog,[generatedWoman],[],portraitAssets)['林姑娘'];
assert.equal(selectedBinding.assetId,'archive:made-1');
assert.equal(selectedBinding.image,'data:image/png;base64,AAAA');
const pack = parseAvgManifest({version:1,styleFamily:'wuxia-a',scenes:[
  {id:'inn_01',file:'scenes/inn.webp',profile:{空间:'客栈大堂',地域:'江南'}}
],portraits:[
  {id:'young_f_01',file:'portraits/young-f.webp',gender:'女',ageRange:{min:18,max:39},visualAge:'young',reusePolicy:'unique',portraitVerified:true,profile:{服饰类别:'江湖劲装',上身轮廓:'丰满',露肤程度:'较高'}},
  {id:'unsafe',file:'../outside.webp',gender:'男',visualAge:'elder',reusePolicy:'unique',portraitVerified:true}
]});
assert.equal(pack.scenes[0].image,'/assets/avg/scenes/inn.webp');
assert.equal(pack.portraits[0].gender,'女');
assert.deepEqual(pack.portraits[0].ageRange,{min:18,max:39});
assert.equal(pack.portraits[0].profile.上身轮廓,'丰满');
assert.equal(pack.portraits.length,1);
assert.equal(pack.errors.length,1);
const contradictoryPack = parseAvgManifest({version:1,scenes:[],portraits:[
  {id:'bad_monk',file:'portraits/bad.webp',gender:'女',ageRange:{min:18,max:39},visualAge:'young',reusePolicy:'unique',portraitVerified:true,profile:{江湖形象:'道士',服饰类别:'僧衣'}}
]});
assert.equal(contradictoryPack.portraits.length,0);
assert.equal(contradictoryPack.errors.length,1);
const missingAgeRange = parseAvgManifest({version:1,scenes:[],portraits:[
  {id:'missing_range',file:'portraits/missing.webp',gender:'女',visualAge:'young',reusePolicy:'unique',portraitVerified:true,profile:{服饰类别:'江湖劲装'}}
]});
assert.equal(missingAgeRange.portraits.length,0);
assert.equal(missingAgeRange.errors.length,1);
const reversedAgeRange = parseAvgManifest({version:1,scenes:[],portraits:[
  {id:'reversed_range',file:'portraits/reversed.webp',gender:'女',ageRange:{min:39,max:18},visualAge:'young',reusePolicy:'unique',portraitVerified:true,profile:{服饰类别:'江湖劲装'}}
]});
assert.equal(reversedAgeRange.portraits.length,0);
assert.equal(reversedAgeRange.errors.length,1);
console.log('AVG scene regression passed');
`;

const result = await build({
    stdin: { contents: source, loader: 'ts', resolveDir: process.cwd(), sourcefile: 'avgSceneRegression.entry.ts' },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent'
});
await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
