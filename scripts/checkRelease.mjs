import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const bundled=await build({stdin:{contents:"export {APP_VERSION} from './release/version'; export {releaseNotes} from './release/releaseNotes'; export * from './release/dailyChangelog';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',write:false});
const mod=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.equal(mod.APP_VERSION,pkg.version);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(mod.releaseNotes[0].updates[0].version,'v'+pkg.version);
const ids=new Set();let lastDate='9999-99-99';
for(const day of mod.releaseNotes){assert.match(day.id,/^\d{4}-\d{2}-\d{2}$/);assert.ok(day.id<lastDate);lastDate=day.id;assert.ok(day.updates.length);let lastTime='24:00';for(const u of day.updates){assert.ok(!ids.has(u.id));ids.add(u.id);assert.match(u.time,/^(?:[01]\d|2[0-3]):[0-5]\d$/);assert.ok(u.time<=lastTime);lastTime=u.time;assert.match(u.version,/^v\d+\.\d+\.\d+$/);assert.ok(u.title&&u.summary&&u.items.length);}}
const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};const today=new Date(2026,9,1,12);
assert.equal(mod.shouldShowDailyChangelog(storage,today),true);mod.recordDailyChangelogView(storage,today);assert.equal(mod.shouldShowDailyChangelog(storage,today),false);assert.equal(mod.shouldShowDailyChangelog(storage,new Date(2026,9,2)),true);storage.setItem(mod.CHANGELOG_STORAGE_KEY,JSON.stringify({localDate:mod.formatLocalDateKey(today),latestUpdateId:'older'}));assert.equal(mod.shouldShowDailyChangelog(storage,today),true);console.log('Release identity, chronology and daily/update notice checks passed: '+pkg.version);
