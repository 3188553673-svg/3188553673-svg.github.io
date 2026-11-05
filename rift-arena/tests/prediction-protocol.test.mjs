import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, applyAction, step, snapshot } from '../server/engine.js';

function game(champion='garen') {
  const room=createRoom('1234',{id:'a',name:'甲',champion});addPlayer(room,{id:'b',name:'乙',champion:'garen'});
  applyAction(room,'a',{type:'ready',value:true});applyAction(room,'b',{type:'ready',value:true});applyAction(room,'a',{type:'start'});
  return room;
}
const self=room=>snapshot(room,'a').heroes.find(h=>h.id==='a');

test('only the viewer receives its sequence, move target and effective movement speed',()=>{
  const r=game();applyAction(r,'a',{type:'move',x:-20,z:2,seq:1});
  const h=self(r);assert.equal(h.lastInputSeq,1);assert.deepEqual(h.moveTarget,{x:-20,z:2});assert.equal(h.effectiveSpeed,h.speed);
  const visibleOpponent=snapshot(r,'b').heroes.find(h=>h.id==='a');
  for(const key of ['lastInputSeq','moveTarget','effectiveSpeed','motionRevision','motionTick'])assert.equal(Object.hasOwn(visibleOpponent,key),false,key);
  assert.equal(JSON.stringify(snapshot(r,'b')).includes('_inputSequences'),false);
});

test('rejected sequenced commands are acknowledged and cannot block reconciliation',()=>{
  const r=game();applyAction(r,'a',{type:'move',x:-20,z:0,seq:1});
  assert.throws(()=>applyAction(r,'a',{type:'ability',slot:'r',targetId:'b',seq:2}),e=>e.code==='LEVEL');
  assert.equal(self(r).lastInputSeq,2);assert.deepEqual(self(r).moveTarget,{x:-20,z:0});
  assert.throws(()=>applyAction(r,'a',{type:'move',x:NaN,z:0,seq:3}),e=>e.code==='POINT');assert.equal(self(r).lastInputSeq,3);
});

test('duplicate or older sequence numbers cannot repeat a purchase or replace a newer order',()=>{
  const r=game(),h=r.heroes[0];applyAction(r,'a',{type:'buy',itemId:'blade',seq:1});
  const gold=h.gold;applyAction(r,'a',{type:'buy',itemId:'blade',seq:1});assert.equal(h.gold,gold);assert.equal(h.inventory.length,1);
  applyAction(r,'a',{type:'move',x:-20,z:0,seq:3});applyAction(r,'a',{type:'stop',seq:2});
  assert.equal(self(r).lastInputSeq,3);assert.deepEqual(self(r).moveTarget,{x:-20,z:0});
  applyAction(r,'a',{type:'stop'});assert.equal(self(r).moveTarget,null);assert.equal(self(r).lastInputSeq,3);
});

test('invalid sequence values are rejected before changing authoritative state',()=>{
  const r=game(),x=r.heroes[0].x;
  for(const seq of [0,-1,1.5,NaN,Infinity,'1',0x80000000])assert.throws(()=>applyAction(r,'a',{type:'move',x:10,z:0,seq}),e=>e.code==='SEQUENCE');
  assert.equal(self(r).lastInputSeq,0);assert.equal(r.heroes[0].x,x);assert.equal(self(r).moveTarget,null);
});

test('flash, recall completion, Yi dash and respawn revise the local motion anchor',()=>{
  const r=game(),h=r.heroes[0];let revision=self(r).motionRevision;
  applyAction(r,'a',{type:'summoner',slot:'d',x:-28,z:0});assert.equal(self(r).motionRevision,++revision);
  applyAction(r,'a',{type:'recall'});for(let i=0;i<125;i++)step(r,.05);assert.equal(self(r).motionRevision,++revision);
  h.dead=true;h.respawnIn=.01;step(r,.05);assert.equal(self(r).motionRevision,++revision);
  const yi=game('yi'),[a,b]=yi.heroes;a.x=-5;b.x=3;
  applyAction(yi,'a',{type:'ability',slot:'q',targetId:'b'});assert.equal(self(yi).motionRevision,1);
});

test('buff speed metadata follows the actual authoritative speed modifiers',()=>{
  const r=game(),h=r.heroes[0];h._buffs.haste=2;h._buffs.slow=1;
  assert.equal(self(r).effectiveSpeed,Math.round(h.speed*1.3*.65*100)/100);
  h._buffs.highlander=2;assert.equal(self(r).effectiveSpeed,Math.round(h.speed*1.3*1.35*100)/100);
});
