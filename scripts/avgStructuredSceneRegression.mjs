import { build } from 'esbuild';

const source = String.raw`
import assert from 'node:assert/strict';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { normalizeAvgHints } from './services/avg/vocabulary';
import { buildAvgPresentation } from './services/avg/sceneResolver';
import { restoreStructuredAvgScenes } from './services/avg/missingArtRecovery';

// Reproduces the location fields and profiles in the 2026-10-01 user diagnostic.
const env = {大地点:'京东东路',中地点:'清河县',小地点:'县前街',具体地点:'清河县衙捕房公廨'};
const hints = [
  {ref:'s1',地点:{大地点:'京东东路',中地点:'清河县',小地点:'县前街',具体地点:'街道'},分类:{空间:'城内街道',地域:'华北',场所体系:'通用'}},
  {ref:'s2',地点:{大地点:'京东东路',中地点:'清河县',小地点:'县衙',具体地点:'捕房值房'},分类:{空间:'厢房',地域:'华北',场所体系:'官署',场所功能:'衙门',空间规模:'适中'}},
  {ref:'s3',地点:{大地点:'京东东路',中地点:'清河县',小地点:'紫石街',具体地点:'武家小楼'},分类:{空间:'民居卧室',地域:'华北',场所体系:'宅院',场所功能:'民居',空间规模:'狭小'}}
];
const assets = [
  {id:'UE417',version:1,image:'/street.webp',profile:{空间:'城内街道',地域:'东北',场所体系:'商旅'}},
  {id:'street-north',version:1,image:'/north.webp',profile:{空间:'城内街道',地域:'华北',场所体系:'通用'}},
  {id:'UI440',version:1,image:'/office.webp',profile:{空间:'厢房',地域:'华北',场所体系:'官署',场所功能:'衙门'}},
  {id:'home',version:1,image:'/home.webp',profile:{空间:'民居卧室',地域:'华北',场所体系:'宅院',场所功能:'民居'}}
];
const logs = ['s1','s2','s3','s2'].map((ref,index) => ({sender:'旁白',text:'镜头'+index,avgSceneRef:ref}));
const before = JSON.stringify({env,hints,logs});
const presentation = buildAvgPresentation(logs,hints,env as any,[],assets);
assert.equal(presentation.mode,'multi');
assert.equal(presentation.diagnostic,undefined);
assert.deepEqual(presentation.scenes.map(scene => scene.assetId),['street-north','UI440','home']);
assert.deepEqual(presentation.scenes[1].profile,hints[1].分类);
assert.equal(presentation.scenes[1].placeKey,'京东东路/清河县/县衙/捕房值房');
assert.equal(JSON.stringify({env,hints,logs}),before);

// A different final game location cannot veto a supplied presentation classification.
assert.deepEqual(buildAvgPresentation(logs,hints,{...env,具体地点:'船舱'} as any,[],assets).scenes,presentation.scenes);
const old = {schemaVersion:1,mode:'final',diagnostic:'invalid-scene-timeline',scenes:[{
  ref:'final',placeKey:'京东东路/清河县/县前街/清河县衙捕房公廨',label:'捕房公廨',profile:{空间:'城内街道'},
  assetId:'UE417',image:'/street.webp',version:1,reason:'first-match'
}]};
const response = {logs,avgSceneHints:hints,avgPresentation:old,tavern_commands:[{action:'set',key:'环境.具体地点',value:env.具体地点}]};
const savedBefore = JSON.stringify(response);
assert.deepEqual(restoreStructuredAvgScenes(response as any,[],assets),presentation);
assert.equal(JSON.stringify(response),savedBefore);
const manual = {...response,avgPresentation:{...old,scenes:[{...old.scenes[0],reason:'manual-place-override'}]}};
assert.equal(restoreStructuredAvgScenes(manual as any,[],assets),manual.avgPresentation);
const legacyWithoutFields = restoreStructuredAvgScenes({...response,avgSceneHints:[]} as any,[],assets);
assert.ok(legacyWithoutFields.scenes.every(scene => !scene.image));

// Model strings survive parsing even if they are not members of the art vocabulary.
const payload = {词表版本:'model-supplied',场景:[{ref:'s1',分类:{空间:'未收录的空间',地域:'模型地域',显著要素:['模型要素']}}]};
const parsed = parseStoryRawText('<正文><镜头 ref="s1"/>\n【旁白】测试。</正文><演出场景>'+JSON.stringify(payload)+'</演出场景>');
assert.deepEqual(parsed.avgSceneHints[0].分类,payload.场景[0].分类);
const unsupported = buildAvgPresentation(parsed.logs,parsed.avgSceneHints,env as any,[],assets);
assert.deepEqual(unsupported.scenes[0].profile,payload.场景[0].分类);
assert.equal(unsupported.scenes[0].image,undefined);
assert.equal(unsupported.diagnostic,undefined);

// Missing fields/ref mappings affect only those frames; names never invent a class.
const partial = normalizeAvgHints({场景:[hints[0],{ref:'s2',分类:{地域:'华北'}},hints[2]]});
assert.deepEqual(partial.map(hint => hint.ref),['s1','s3']);
const incomplete = buildAvgPresentation(logs,partial,env as any,[],assets);
assert.equal(incomplete.mode,'multi');
assert.equal(incomplete.diagnostic,'incomplete-scene-timeline');
assert.deepEqual(incomplete.scenes.map(scene => scene.assetId),['street-north',undefined,'home']);
const duplicates = normalizeAvgHints({场景:[hints[0],hints[1],{...hints[1],分类:{空间:'市集'}},hints[2]]});
assert.deepEqual(duplicates.map(hint => hint.ref),['s1','s3']);
for (const location of [env,{...env,具体地点:'洞内'},{...env,具体地点:'客栈大堂'}]) {
  const neutral = buildAvgPresentation([{sender:'旁白',text:'没有分类'}],[],location as any,[],assets);
  assert.equal(neutral.scenes[0].profile.空间,'未知');
  assert.equal(neutral.scenes[0].image,undefined);
}
const single = buildAvgPresentation([{sender:'旁白',text:'室内'}],[hints[1]],env as any,[],assets);
assert.equal(single.mode,'final');
assert.equal(single.scenes[0].assetId,'UI440');
assert.equal(buildAvgPresentation([{sender:'旁白',text:'缺少映射'}],hints,env as any,[],assets).scenes[0].image,undefined);
console.log('Structured scene authority: diagnostic replay, location independence, stored recovery, manual choices, raw model values and per-frame neutral fallback passed');
`;

const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
