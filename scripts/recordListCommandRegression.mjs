import assert from 'node:assert/strict';
import {build} from 'esbuild';
const source=String.raw`
import assert from 'node:assert/strict';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {applyStateCommand} from './utils/stateHelpers';
import {规范化世界状态} from './hooks/useGame/storyState';
import {规范化角色物品容器映射} from './hooks/useGame/stateTransforms';
import World from './components/features/World/WorldModal';
import MobileWorld from './components/features/World/MobileWorldModal';
const skill={ID:'KF1',名称:'基础拳法'};
const event={事件名:'早市',事件说明:'市集开放'};
const world={待执行事件:[event],进行中事件:[],已结算事件:[]};
const apply=(key,value,action='push')=>applyStateCommand({功法列表:[skill]}, {},[],world,{}, {},{},undefined,undefined,undefined,{},[],[],key,value,action);
for(const invalid of [[],[event],{},null,'']){
 assert.deepEqual(apply('角色.功法列表',invalid).char.功法列表,[skill]);
 assert.deepEqual(apply('gameState.世界.待执行事件',invalid).world.待执行事件,[event]);
}
assert.deepEqual(apply('角色.功法列表',[],'set').char.功法列表,[]);
assert.deepEqual(apply('角色.功法列表',[[]],'set').char.功法列表,[skill]);
assert.equal(apply('世界.待执行事件',event).world.待执行事件.length,2);
assert.equal(apply('待执行事件',event).world.待执行事件.length,2);
assert.equal(apply('角色.功法列表',skill).char.功法列表.length,2);
assert.deepEqual(apply('角色.功法列表[0]',[],'set').char.功法列表,[skill]);
assert.deepEqual(apply('世界.待执行事件[0].关联人物','姚二郎').world.待执行事件[0].关联人物,['姚二郎']);
assert.deepEqual(规范化角色物品容器映射({功法列表:[[],skill]}).功法列表,[skill]);
const badWorld={待执行事件:[null,[],{},event],进行中事件:[null,[]],已结算事件:[{}],活跃NPC列表:[[]],世界镜头规划:[null],江湖史册:[{}]};
assert.equal(规范化世界状态(badWorld).待执行事件.length,1);
for(const Component of [World,MobileWorld]){
 const html=renderToString(React.createElement(Component,{world:badWorld,onClose(){}}));
 assert.ok(html.includes('早市'));assert.ok(!html.includes('待执行事件 2'));
}
console.log('Record write guards, read normalization, valid writes and desktop/mobile world render: passed');
`;
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',packages:'external',write:false});
const {writeFile,unlink}=await import('node:fs/promises');const p=new URL('../node_modules/.record-list-regression.mjs',import.meta.url);await writeFile(p,result.outputFiles[0].text);try{await import(p.href)}finally{await unlink(p)}
