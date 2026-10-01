import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const source = String.raw`
import assert from 'node:assert/strict';
import { captureAvgSceneTrace, snapshotAvgSceneFields, buildAvgSceneSourceEvidence, diagnoseAvgSceneSource, diagnoseAvgSceneDisplay, redactAvgDiagnosticText } from './services/avg/sceneEvidence';
import { AVG_FULL_PROTOCOL_PROMPT } from './services/avg/vocabulary';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { buildAvgPresentation, inspectAvgSceneCandidates, inspectAvgSceneBindings } from './services/avg/sceneResolver';

const env = {大地点:'京东东路',中地点:'清河县',小地点:'县前街',具体地点:'清河县衙捕房公廨'};
const body = '<正文>【旁白】捕房公廨内安静。</正文>';
const hint = {ref:'s1',地点:env,分类:{空间:'厢房',地域:'华北',场所体系:'官署',场所功能:'衙门'}};
const raw = '<正文><镜头 ref="s1"/>\n【旁白】捕房公廨内安静。</正文><演出场景>'+JSON.stringify({场景:[hint]})+'</演出场景>';
const parsed = parseStoryRawText(raw);
const missing = parseStoryRawText(body);
const turn = (rawJson, structuredResponse, avgSceneTrace?) => ({role:'assistant',content:'',timestamp:1,rawJson,structuredResponse,avgSceneTrace});
const source = (rawJson, structuredResponse = missing, trace?) => buildAvgSceneSourceEvidence(turn(rawJson,structuredResponse,trace) as any);
const code = (rawJson, structuredResponse = missing, trace?) => diagnoseAvgSceneSource(source(rawJson,structuredResponse,trace)).code;
const withProtocol = captureAvgSceneTrace(true,[{content:'safe'}, {content:AVG_FULL_PROTOCOL_PROMPT}],missing,'main');
assert.deepEqual(withProtocol.request.protocolMessageIndexes,[1]);
assert.equal(withProtocol.request.protocolIncluded,true);
assert.equal(captureAvgSceneTrace(true,[{content:'【AVG演出协议 avg-v3】'}],missing,'main').request.protocolIncluded,false);
assert.equal(code(body,missing,captureAvgSceneTrace(true,[],missing,'main')),'avg-protocol-not-sent');
assert.equal(code(body,missing,captureAvgSceneTrace(false,[],missing,'opening')),'avg-disabled-at-request');
assert.equal(code(body,missing,withProtocol),'response-scene-fields-absent');
assert.equal(code(''),'scene-source-evidence-unavailable');
assert.equal(source(body).request,null); // Current AVG settings cannot substitute for historic evidence.
assert.equal(code(raw),'scene-fields-not-retained');
assert.equal(code(raw,parsed),'scene-fields-present');
const trace = captureAvgSceneTrace(true,[{content:AVG_FULL_PROTOCOL_PROMPT}],parsed,'main');
trace.afterPolish = snapshotAvgSceneFields(missing);
trace.final = snapshotAvgSceneFields(missing);
assert.equal(code(raw,missing,trace),'scene-fields-lost-after-parsing');
assert.match(diagnoseAvgSceneSource(source(raw,missing,trace)).summary,/正文处理/);
const afterPolish = {...trace, afterPolish:snapshotAvgSceneFields(parsed),afterVariableGeneration:snapshotAvgSceneFields(missing)};
assert.match(diagnoseAvgSceneSource(source(raw,missing,afterPolish)).summary,/变量合并/);
const arrayRaw = body+'<演出场景>'+JSON.stringify([hint])+'</演出场景>';
assert.equal(code(arrayRaw),'scene-parser-dropped-fields');
assert.equal(source(arrayRaw).rawBlocks[0].structure.readableSceneCount,1);
assert.equal(code(body+'<演出场景>not-json</演出场景>'),'scene-json-unreadable');
assert.equal(code(body+'<演出场景>{"场景":[{"ref":"s1","分类":{"地域":"华北"}}]}</演出场景>'),'scene-fields-incomplete');
assert.equal(code(body+'<演出场景>'+JSON.stringify({场景:[hint,hint]})+'</演出场景>'),'scene-refs-duplicated');
assert.equal(code('<thinking>'+raw+'</thinking>'+body),'response-scene-fields-absent');
const jsonRaw = JSON.stringify({logs:[{sender:'旁白',text:'测试',avgSceneRef:'s1'}],avgSceneHints:{场景:[hint]}});
// Current tag repair intercepts this JSON response; diagnostics must expose that loss, without changing parsing here.
assert.equal(code(jsonRaw),'scene-parser-dropped-fields');
assert.equal(parseStoryRawText(jsonRaw,{enableTagRepair:false}).avgSceneHints.length,1);
assert.equal(source(jsonRaw).reparsedWithoutTagRepair.hintCount,1);
assert.equal(source(jsonRaw).jsonPayload.sceneCount,1);
const unsupportedRaw = raw.replace('厢房','模型未收录空间');
const unsupported = parseStoryRawText(unsupportedRaw);
assert.equal(code(unsupportedRaw,unsupported),'scene-fields-present');
assert.equal(source(unsupportedRaw,unsupported).rawBlocks[0].structure.scenes[0].profile.空间,'模型未收录空间');

const assets = [
 {id:'office',version:1,image:'/office.webp',profile:{空间:'厢房',场所体系:'官署',场所功能:'衙门'}},
 {id:'home',version:1,image:'/home.webp',profile:{空间:'厢房',场所体系:'宅院',场所功能:'民居'}}
];
const pool = inspectAvgSceneCandidates(hint.分类,assets);
assert.equal(pool.counts.total,2);
assert.equal(pool.counts.exactSpaceBeforeFilters,2);
assert.equal(pool.counts.afterInstitution,1);
assert.equal(pool.counts.category,1);
assert.deepEqual(pool.candidateIds,['office']);
const response = {...parsed,avgPresentation:buildAvgPresentation(parsed.logs,parsed.avgSceneHints,env as any,[],assets)};
const scene = response.avgPresentation.scenes[0];
const input = {source:source(raw,response),response,scene,sceneRef:'s1'};
for (const [availability,imageState,expected] of [
 ['local-file-missing','pending','scene-local-file-missing'],
 ['storage-unavailable','pending','scene-storage-unavailable'],
 ['local-file-present','failed','scene-image-load-failed'],
 ['local-file-present','pending','scene-image-loading'],
 ['local-file-present','loaded','scene-image-loaded']
]) assert.equal(diagnoseAvgSceneDisplay({...input,availability,imageState}).code,expected);
const neutral = {...scene,image:undefined,assetId:undefined,reason:'neutral-background'};
const boundHistory = [turn(raw,response)];
const boundLookup = inspectAvgSceneBindings(boundHistory,scene.placeKey,{空间:'未知'});
assert.equal(boundLookup.bindingFound,true);
assert.equal(boundLookup.blockReason,undefined);
assert.equal(boundLookup.reuseAllowedByCurrentResolver,true);
assert.equal(boundLookup.binding.assetId,'office');
assert.equal(diagnoseAvgSceneDisplay({...input,scene:neutral,bindingReuseAvailable:true}).code,'scene-existing-binding-not-applied');
assert.equal(diagnoseAvgSceneDisplay({...input,scene:neutral,bindingReuseBlockReason:'conflicting-scene-identity'}).code,'scene-binding-conflict');
const anotherLookup = inspectAvgSceneBindings(boundHistory,scene.placeKey+'/别名',{空间:'未知'});
assert.equal(anotherLookup.bindingFound,false);
assert.equal(anotherLookup.blockReason,'no-exact-place-binding');
assert.equal(anotherLookup.knownBindingCount,1);
const legacyHistory = [turn(raw,{...response,avgPresentation:{...response.avgPresentation,diagnostic:'invalid-scene-timeline'}})];
assert.equal(inspectAvgSceneBindings(legacyHistory,scene.placeKey,{空间:'未知'}).knownBindingCount,0);
assert.equal(diagnoseAvgSceneDisplay({...input,scene:neutral,candidateCount:0}).code,'scene-no-compatible-art');
assert.equal(diagnoseAvgSceneDisplay({...input,scene:neutral,candidateCount:1}).code,'scene-selection-missing');
assert.equal(diagnoseAvgSceneDisplay({...input,scene:neutral,catalogAvailable:false}).confirmed,false);
assert.equal(diagnoseAvgSceneDisplay({...input,scene:undefined,sceneRef:'s2'}).code,'scene-ref-unmapped');
assert.equal(diagnoseAvgSceneDisplay({...input,scene:{...neutral,reason:'manual-neutral'}}).code,'scene-manual-neutral');
const unmarked = {...response,logs:response.logs.map(log=>({...log,avgSceneRef:undefined})),avgPresentation:{...response.avgPresentation,diagnostic:'no-scene-markers'}};
assert.equal(diagnoseAvgSceneDisplay({...input,source:source(raw,unmarked),response:unmarked,scene:neutral}).code,'scene-markers-not-retained');

const credential = 'sk-proj-fixture-secret-12345678';
const malformed = body+'<演出场景>bad-json apiKey="'+credential+'" Authorization: Bearer fixture.secret token https://image.invalid/art?token=fixture-token&key=another-secret data:image/png;base64,AAAA</演出场景>';
const sanitized = JSON.stringify(source(malformed));
assert.ok(!sanitized.includes(credential));
assert.ok(!sanitized.includes('fixture-token'));
assert.ok(!sanitized.includes('another-secret'));
assert.ok(!sanitized.includes('base64,AAAA'));
assert.ok(!sanitized.includes('fixture.secret'));
assert.ok(!JSON.stringify(withProtocol).includes(AVG_FULL_PROTOCOL_PROMPT));
assert.ok(!JSON.stringify(source(raw)).includes('<正文>'));
assert.equal(redactAvgDiagnosticText('apiKey="abc"'), 'apiKey="[REDACTED]"');
console.log('AVG diagnostic evidence passed: request proof, raw/tag/JSON inspection, parser vs processing loss, refs, candidates, blob/load states and redaction');
`;
const result = await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression', {recursive:true});
await writeFile('work/regression/avgDiagnosticRegression.bundle.mjs', result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/work/regression/avgDiagnosticRegression.bundle.mjs').href);
