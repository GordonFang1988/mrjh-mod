import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Run against an actual installed-pack manifest, without a model request or save mutation.
const source = String.raw`
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseAvgManifest } from './services/avg/manifest';
import { buildAvgPresentation, inspectAvgSceneCandidates } from './services/avg/sceneResolver';
import { AVG_SCENE_SPACES } from './services/avg/vocabulary';
import { parseStoryRawText } from './services/ai/storyResponseParser';
import { avgCompatibleSpaces } from './services/avg/sceneCompatibility';

const catalogPath = process.argv[2] || 'docs/avg-art-production/complete-webp-008/manifest.json';
const outputPath = process.argv[3] || 'work/avg-gap-audit-2026-10-01/coverage.json';
const parsed = parseAvgManifest(JSON.parse(readFileSync(catalogPath,'utf8').replace(/^\uFEFF/,'')));
if(parsed.errors.length) throw new Error('Catalog validation failed: '+parsed.errors.slice(0,5).join('; '));
const assets=parsed.scenes;
const env={大地点:'审计区域',中地点:'审计城镇',小地点:'审计建筑',具体地点:'独立空间'};
const logs=[{sender:'旁白',text:'回放测试',avgSceneRef:'s1'}];
const failures=[];
const groups={};
const check=(group,name,run)=>{
 groups[group] ||= {cases:0,passed:0,failed:0};groups[group].cases++;
 try{const details=run();if(details!==true){failures.push({group,name,...details});groups[group].failed++;}else groups[group].passed++;}
 catch(error){failures.push({group,name,error:String(error)});groups[group].failed++;}
};
const resolve=(profile,catalog=assets,history=[],location=env,sceneId=undefined)=>buildAvgPresentation(logs,[{ref:'s1',地点:location,场景ID:sceneId,分类:profile}],env as any,history as any,catalog as any).scenes[0];
const tuples=new Map();
for(const asset of assets){
 const p=asset.profile;
 tuples.set(JSON.stringify({空间:p.空间,场所体系:p.场所体系,场所功能:p.场所功能}),{空间:p.空间,场所体系:p.场所体系,场所功能:p.场所功能});
 check('catalog-self',asset.id,()=>resolve(p).image?true:{profile:p});
}
for(const [key,p] of tuples){
 for(const field of ['场所体系','场所功能'])for(const value of ['通用','未知','不适用']){
  const profile={...p,[field]:value};
  check('optional-fields',key+'/'+field+'/'+value,()=>resolve(profile).image?true:{profile,matching:inspectAvgSceneCandidates(profile,assets)});
 }
 for(const space of avgCompatibleSpaces(p.空间)){
  const sample=assets.find(a=>a.profile.空间===space&&a.profile.场所体系===p.场所体系&&a.profile.场所功能===p.场所功能);
  if(sample) check('space-compatibility',key+'/'+space,()=>resolve(p,[sample]).image?true:{profile:p,available:sample.profile});
 }
}
const spaceCoverage=AVG_SCENE_SPACES.filter(s=>s!=='未知').map(space=>{
 const matching=inspectAvgSceneCandidates({空间:space},assets);
 return {space,exactAssets:assets.filter(a=>a.profile.空间===space).length,candidates:matching.counts.afterStylePreference,allowedSpaces:matching.selection.allowedSpaces};
});
for(const space of ['constructor','toString','__proto__','未收录空间'])check('unknown-space',space,()=>!resolve({空间:space}).image?true:{unexpectedImage:true});
for(const shape of ['object','array'])check('scene-json-shape',shape,()=>{
 const hints=Array.from({length:15},(_,i)=>({ref:'s'+(i+1),地点:{...env,具体地点:'空间'+i},分类:{空间:'城内街道'}}));
 const raw='<正文>'+hints.map(h=>'<镜头 ref="'+h.ref+'"/>\n【旁白】测试。').join('\n')+'</正文><演出场景>'+JSON.stringify(shape==='array'?hints:{场景:hints})+'</演出场景>';
 const response=parseStoryRawText(raw);
 return response.avgSceneHints?.length===15&&response.logs.at(-1)?.avgSceneRef==='s15'?true:{hints:response.avgSceneHints?.length,lastRef:response.logs.at(-1)?.avgSceneRef};
});
for(const ref of ['s100','room_1'])check('scene-ref',ref,()=>{
 const response=parseStoryRawText('<正文><镜头 ref="'+ref+'"/>\n【旁白】测试。</正文><演出场景>'+JSON.stringify({场景:[{ref,分类:{空间:'城内街道'}}]})+'</演出场景>');
 return response.logs[0]?.avgSceneRef===ref?true:{actualRef:response.logs[0]?.avgSceneRef};
});
check('json-response','fields-survive-tag-repair',()=>{
 const response=parseStoryRawText(JSON.stringify({logs,avgSceneHints:{场景:[{ref:'s1',分类:{空间:'城内街道'}}]}}));
 return response.avgSceneHints?.length===1&&response.logs[0]?.avgSceneRef==='s1'?true:{hints:response.avgSceneHints?.length};
});
check('binding','id-without-location',()=>{
 const first=resolve({空间:'城内街道'},assets,[],null,'audit:stable');
 const history=[{role:'assistant',timestamp:1,content:'',structuredResponse:{logs,avgPresentation:{schemaVersion:1,mode:'multi',scenes:[first]}}}];
 const returned=resolve(undefined,[],history,null,'audit:stable');
 return first.assetId&&returned.assetId===first.assetId?true:{first:first.assetId,returned:returned.assetId};
});
const report={catalogPath,sceneAssets:assets.length,vocabularySpaces:spaceCoverage.length,distinctCatalogSpaces:new Set(assets.map(a=>a.profile.空间)).size,
 groups,spaceCoverage,uncoveredSpaces:spaceCoverage.filter(s=>!s.candidates).map(s=>s.space),failures};
mkdirSync(dirname(outputPath),{recursive:true});writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({outputPath,sceneAssets:assets.length,vocabularySpaces:spaceCoverage.length,groups,uncoveredSpaces:report.uncoveredSpaces.length,failures:failures.length}));
if(process.argv.includes('--assert')&&failures.length)throw new Error('Coverage audit found '+failures.length+' mechanism failures; see '+outputPath);
`;
const result=await build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
await mkdir('work/regression',{recursive:true});
await writeFile('work/regression/avgSceneCoverageAudit.bundle.mjs',result.outputFiles[0].text);
await import(pathToFileURL(process.cwd()+'/work/regression/avgSceneCoverageAudit.bundle.mjs').href);
