import test from 'node:test';
import assert from 'node:assert/strict';
import { MovementPredictor } from '../client-movement.js';

const hero = extra => ({ id:'a', champion:'garen', x:0, z:0, facing:0, hp:880, dead:false, stunned:0, rooted:false, recalling:0, buffs:{}, speed:7, effectiveSpeed:7, lastInputSeq:0, motionRevision:0, moveTarget:null, ...extra });
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);

test('a click starts the local hero on the very next frame, before a network response', () => {
  const p = new MovementPredictor(), h = hero(); p.receive(h,0);
  assert.equal(p.input({type:'move',x:10,z:0},1,0),true);
  const next=p.step(1/60,16.67);close(next.x,7/60);close(next.z,0);assert.equal(next.predicted,true);
  assert.equal(h.x,0);assert.equal(h.hp,880);
});

test('an older acknowledgement preserves the latest local destination', () => {
  const p=new MovementPredictor();p.setLatency(0);p.receive(hero(),0);
  p.input({type:'move',x:10,z:0},1,0);p.step(.05,50);
  p.input({type:'move',x:0,z:5},2,50);
  p.receive(hero({x:.35,lastInputSeq:1,moveTarget:{x:10,z:0}}),50);
  const next=p.step(.05,100);assert.ok(next.z>0);assert.equal(p.pending.length,1);assert.equal(p.pending[0].seq,2);
});

test('stop is immediate and a snapshot awaiting that stop cannot restart movement', () => {
  const p=new MovementPredictor();p.receive(hero({moveTarget:{x:10,z:0}}),0);
  const before=p.step(.05,50);p.input({type:'stop'},1,50);
  p.receive(hero({x:.35,moveTarget:{x:10,z:0}}),70);
  close(p.step(.05,100).x,before.x);assert.equal(p.step(.05,150).predicted,false);
});

test('a rejected move is dropped and reconciles towards the authoritative position', () => {
  const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'move',x:10,z:0},1,0);p.step(.05,50);
  p.reject(1);p.receive(hero({lastInputSeq:1}),70);
  const corrected=p.step(.05,100);assert.ok(corrected.x>=0&&corrected.x<.35);assert.equal(corrected.predicted,false);assert.equal(p.pending.length,0);
});

test('death, stun, root and channel states immediately restore the authoritative position', () => {
  for(const extra of [{dead:true},{stunned:1},{rooted:true},{recalling:3},{buffs:{meditate:1}}]) {
    const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'move',x:10,z:0},1,0);p.step(.05,50);
    p.receive(hero({x:.1,...extra}),60);const next=p.step(.05,100);close(next.x,.1);assert.equal(next.predicted,false);assert.equal(p.pending.length,0);
  }
});

test('a motion revision makes even a short server teleport immediate', () => {
  const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'move',x:10,z:0},1,0);p.step(.05,50);
  p.receive(hero({x:1,motionRevision:1,lastInputSeq:2}),70);close(p.step(0,70).x,1);assert.equal(p.pending.length,0);
});

test('prediction does not run forever through a network stall or overshoot its destination', () => {
  const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'move',x:.1,z:0},1,0);close(p.step(.05,50).x,.1);
  p.input({type:'move',x:1000,z:1000},2,50);p.step(.05,100);const before=p.step(.05,300);
  const stalled=p.step(.05,351);close(stalled.x,before.x);close(stalled.z,before.z);assert.equal(stalled.predicted,false);
  assert.ok(stalled.x<40&&stalled.z<8);
});

test('combat commands and old servers fall back without predicting combat outcomes', () => {
  const p=new MovementPredictor();p.receive(hero({moveTarget:{x:10,z:0}}),0);p.input({type:'attack',targetId:'b'},1,0);
  const next=p.step(.05,50);close(next.x,0);assert.equal(next.predicted,false);
  p.receive({id:'a',x:1,z:0,hp:880},100);assert.equal(p.input({type:'move',x:10,z:0},2,100),false);assert.equal(p.step(.05,150),null);
});

test('effective buff speed is used and malformed or stale intents are ignored', () => {
  const p=new MovementPredictor();p.receive(hero({effectiveSpeed:9.1,lastInputSeq:3}),0);
  assert.equal(p.input({type:'move',x:10,z:0},3,0),false);assert.equal(p.input({type:'move',x:NaN,z:0},4,0),false);
  p.input({type:'move',x:10,z:0},4,0);close(p.step(.05,50).x,.455);assert.equal(p.input({type:'stop'},3,60),false);
});

test('attack chasing and attack-move retain the server-facing angle after a predicted move',()=>{
  for(const action of [{type:'attack',targetId:'b'},{type:'attack_move',x:10,z:0}]) {
    const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'move',x:10,z:0},1,0);
    close(p.step(.05,50).facing,Math.PI/2);p.input(action,2,50);
    p.receive(hero({lastInputSeq:2,x:.35,facing:-1.2}),100);
    const next=p.step(.05,150);close(next.facing,-1.2);assert.equal(next.predicted,false);
  }
});

test('an acknowledged move blocked by authoritative unit collision stops extrapolating',()=>{
  for(const rttMs of [0,80,400]) {
    const p=new MovementPredictor();p.setLatency(rttMs);p.receive(hero({lastInputSeq:1,motionTick:0,moveTarget:{x:10,z:0}}),0);
    let position;
    for(let frame=1;frame<=180;frame++) {
      const time=frame*1000/60;
      if(frame%3===0)p.receive(hero({lastInputSeq:1,motionTick:frame/3,moveTarget:{x:10,z:0}}),time);
      position=p.step(1/60,time);
    }
    assert.equal(position.predicted,false);assert.ok(position.x<.001,`RTT ${rttMs}: blocked hero drifted ${position.x}`);
    p.receive(hero({x:.35,lastInputSeq:1,motionTick:61,moveTarget:{x:10,z:0}}),3050);
    assert.equal(p.step(1/60,3067).predicted,true,'server movement permits prediction to resume');
  }
});

test('duplicate tick packets cannot falsely declare a moving hero blocked',()=>{
  const p=new MovementPredictor();p.receive(hero({lastInputSeq:1,motionTick:1,moveTarget:{x:10,z:0}}),0);
  for(let i=1;i<=5;i++)p.receive(hero({lastInputSeq:1,motionTick:1,moveTarget:{x:10,z:0}}),i*10);
  assert.equal(p.step(.05,60).predicted,true);
});

test('a move sent after flash survives the older flash acknowledgement',()=>{
  const p=new MovementPredictor();p.receive(hero(),0);p.input({type:'summoner',slot:'d'},1,0);p.input({type:'move',x:10,z:0},2,10);
  p.receive(hero({x:1,motionRevision:1,lastInputSeq:1}),60);
  assert.equal(p.pending.length,1);const next=p.step(.05,110);assert.equal(next.predicted,true);assert.ok(next.x>1);
});
