import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import React from 'react';
import {renderToString} from 'react-dom/server';
const dir=await mkdtemp(path.resolve('node_modules/.kungfu-regression-'));
try {
 const entries=['utils/kungfuRecords.ts','components/features/Kungfu/KungfuModal.tsx','components/features/Kungfu/MobileKungfuModal.tsx'];
 const modules=[];
 for(let i=0;i<entries.length;i++){
  const file=path.join(dir,`${i}.mjs`);await build({entryPoints:[entries[i]],bundle:true,platform:'node',format:'esm',packages:'external',outfile:file});modules.push(await import(pathToFileURL(file).href));
 }
 const valid={ID:'KF001',名称:'基础拳法',类型:'外功',品质:'凡品',当前重数:1,最高重数:3,当前熟练度:0,升级经验:100,武器限制:[],重数描述映射:[],附带效果:[],被动修正:[],境界特效:[]};
 const mixed=[[],null,{},'bad',valid];
 assert.deepEqual(modules[0].filterValidKungfuRecords(mixed),[valid]);
 assert.equal(modules[0].filterValidKungfuRecords(mixed)[0],valid);
 for(const {default:Modal} of modules.slice(1)){
  const empty=renderToString(React.createElement(Modal,{skills:[[]],onClose(){}}));assert.ok(empty.length>0);assert.ok(!empty.includes('NaN'));
  const normal=renderToString(React.createElement(Modal,{skills:mixed,onClose(){}}));assert.ok(normal.includes('基础拳法'));
 }
 console.log('Kungfu malformed save and valid skill preservation, desktop/mobile render: passed');
}finally{await rm(dir,{recursive:true,force:true});}
