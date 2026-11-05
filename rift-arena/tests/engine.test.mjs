import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, removePlayer, applyAction, step, snapshot } from '../server/engine.js';
import { CHAMPIONS, ITEMS, MAP } from '../shared/definitions.js';

function game(a = 'garen', b = 'ashe') {
  const r = createRoom('1234', { id: 'a', name: '甲', champion: a }); addPlayer(r, { id: 'b', name: '乙', champion: b });
  applyAction(r, 'a', { type: 'ready', value: true }); applyAction(r, 'b', { type: 'ready', value: true }); applyAction(r, 'a', { type: 'start' }); return r;
}
function advance(r, seconds) { for (let t = 0; t < seconds - 1e-8; t += .05) step(r, Math.min(.05, seconds - t)); }
function heroes(r) { return [r.heroes.find(h => h.id === 'a'), r.heroes.find(h => h.id === 'b')]; }
function isolate(r, a = { x: -3, z: 0 }, b = { x: 3, z: 0 }) { r._nextWave = 1e6; r.minions = []; const [h, f] = heroes(r); Object.assign(h, a); Object.assign(f, b); h._order = { type: 'move', x: h.x, z: h.z }; f._order = { type: 'move', x: f.x, z: f.z }; return [h, f]; }
const reject = (fn, code) => assert.throws(fn, e => e.code === code);

test('four complete champion kits and items expose consistent metadata', () => {
  assert.equal(Object.keys(CHAMPIONS).length, 4); assert.ok(ITEMS.length >= 6);
  for (const c of Object.values(CHAMPIONS)) for (const slot of ['q','w','e','r']) { assert.ok(c.skills[slot].name); assert.ok(c.skills[slot].cooldown > 0); assert.ok(c.stats.hp > 0); }
});
test('lobby enforces host, readiness, capacity and champion selection', () => {
  const r = createRoom('1234', { id: 'a', name: '<甲>', champion: 'lux' });
  reject(() => applyAction(r, 'a', { type:'start' }), 'READY');
  addPlayer(r, {id:'b',name:'乙',champion:'yi'}); reject(() => addPlayer(r,{id:'c'}),'FULL');
  reject(() => applyAction(r,'b',{type:'start'}),'HOST'); reject(() => applyAction(r,'a',{type:'select',champion:'missing'}),'CHAMPION');
  applyAction(r,'a',{type:'ready',value:true}); applyAction(r,'a',{type:'select',champion:'ashe'}); assert.equal(r.players[0].ready,false); assert.equal(r.players[0].name,'甲');
  applyAction(r,'a',{type:'ready',value:true}); applyAction(r,'b',{type:'ready',value:true}); applyAction(r,'a',{type:'start'}); assert.equal(r.phase,'playing');
  reject(() => applyAction(r,'b',{type:'select',champion:'garen'}),'PHASE');
});
test('movement is bounded and is applied by authoritative elapsed time, not command count', () => {
  const r = game(); const [h] = heroes(r), x = h.x;
  for (let i=0;i<100;i++) applyAction(r,'a',{type:'move',x:1e6,z:1e6});
  assert.equal(h.x,x); advance(r,1); assert.ok(Math.hypot(h.x-x,h.z) <= h.speed + .01);
  reject(() => applyAction(r,'a',{type:'move',x:NaN,z:0}),'POINT'); reject(() => applyAction(r,'a',{type:'move',x:0,z:Infinity}),'POINT');
  advance(r,30); assert.ok(h.x <= MAP.maxX && h.z <= MAP.maxZ);
});
test('spell cost, cooldown and ultimate level gates cannot be bypassed', () => {
  const r=game('lux','garen'), [h]=isolate(r); const mana=h.mana;
  applyAction(r,'a',{type:'ability',slot:'q',x:10,z:0}); assert.equal(h.mana,mana-50); assert.equal(h.cooldowns.q,10);
  reject(() => applyAction(r,'a',{type:'ability',slot:'q',x:10,z:0}),'COOLDOWN'); reject(() => applyAction(r,'a',{type:'ability',slot:'r',x:10,z:0}),'LEVEL');
  h.cooldowns.e=0;h.mana=1; reject(() => applyAction(r,'a',{type:'ability',slot:'e',x:10,z:0}),'MANA');
  assert.equal(h.cooldowns.e,0); assert.equal(h.mana,1);
});
test('target skills reject distant and structural targets before spending mana or cooldown', () => {
  const r=game('yi','garen'),[h,f]=isolate(r,{x:-5,z:0},{x:10,z:0}),mana=h.mana;
  reject(()=>applyAction(r,'a',{type:'ability',slot:'q',targetId:f.id}),'TARGET');
  reject(()=>applyAction(r,'a',{type:'ability',slot:'q',targetId:'tower-0'}),'TARGET');
  assert.equal(h.mana,mana);assert.equal(h.cooldowns.q,0);
});
test('Garen empowered strike silences and spin damages nearby enemies', () => {
  const r=game('garen','lux'),[h,f]=isolate(r,{x:-1,z:0},{x:1,z:0});
  applyAction(r,'a',{type:'ability',slot:'q'}); applyAction(r,'a',{type:'attack',targetId:f.id}); advance(r,.1);
  assert.ok(f.hp < f.maxHp-90);assert.ok(f._buffs.silence > 0);
  reject(()=>applyAction(r,'b',{type:'ability',slot:'w'}),'SILENCED');
  const before=f.hp;applyAction(r,'a',{type:'ability',slot:'e'});advance(r,.7);assert.ok(f.hp<before-30);assert.ok(r.effects.some(e=>e.type==='spin'));
});
test('Ashe volley hits a single target only once, and hawk scouts instead of dealing damage', () => {
  const r=game('ashe','garen'),[h,f]=isolate(r,{x:0,z:0},{x:2,z:0}); const before=f.hp;
  applyAction(r,'a',{type:'ability',slot:'w',x:10,z:0});advance(r,.3);
  assert.ok(before-f.hp>60 && before-f.hp<100,`unexpected volley damage ${before-f.hp}`);
  const after=f.hp; applyAction(r,'a',{type:'ability',slot:'e',x:20,z:0});advance(r,.1);assert.ok(f.hp>=after);assert.ok(r._reveals[0]>r.time);
});
test('Lux binding roots, orb detonates later, and damage cancels recall', () => {
  const r=game('lux','garen'),[h,f]=isolate(r,{x:-5,z:0},{x:2,z:0});
  applyAction(r,'b',{type:'recall'});applyAction(r,'a',{type:'ability',slot:'q',x:10,z:0});advance(r,.5);
  assert.ok(f._buffs.root>0);assert.equal(f.recalling,0);
  const before=f.hp;applyAction(r,'a',{type:'ability',slot:'e',x:f.x,z:f.z});advance(r,.5);assert.ok(f.hp>=before);advance(r,1);assert.ok(f.hp<before-70);
});
test('Yi meditation heals and movement cancels it; dash has limited range and produces an effect', () => {
  const r=game('yi','garen'),[h,f]=isolate(r,{x:-5,z:0},{x:3,z:0});h.hp=200;
  applyAction(r,'a',{type:'ability',slot:'w'});advance(r,1);assert.ok(h.hp>250);
  applyAction(r,'a',{type:'move',x:-4,z:1});assert.equal(h._buffs.meditate,0);
  applyAction(r,'a',{type:'ability',slot:'q',targetId:f.id});assert.ok(Math.hypot(h.x-f.x,h.z-f.z)<2);assert.ok(r.effects.some(e=>e.type==='dash'));
});
test('shop enforces fountain, price, slots and unique boots; purchased stats apply', () => {
  const r=game(),[h]=heroes(r),ad=h.ad;
  applyAction(r,'a',{type:'buy',itemId:'blade'});assert.equal(h.ad,ad+15);assert.equal(h.gold,300);
  reject(()=>applyAction(r,'a',{type:'buy',itemId:'staff'}),'GOLD');h.gold=2000;
  applyAction(r,'a',{type:'buy',itemId:'boots'});reject(()=>applyAction(r,'a',{type:'buy',itemId:'boots'}),'ITEM');
  h.x=0;reject(()=>applyAction(r,'a',{type:'buy',itemId:'ruby'}),'SHOP');h.dead=true;
  applyAction(r,'a',{type:'buy',itemId:'ruby'});assert.ok(h.maxHp>=1080);
});
test('flash is bounded and has a server cooldown; recall returns after a real channel', () => {
  const r=game(),[h]=isolate(r,{x:-20,z:0},{x:30,z:0});
  applyAction(r,'a',{type:'summoner',slot:'d',x:10000,z:0});assert.equal(h.x,-11);
  reject(()=>applyAction(r,'a',{type:'summoner',slot:'d',x:20,z:0}),'COOLDOWN');
  applyAction(r,'a',{type:'recall'});advance(r,3);assert.equal(h.x,-11);advance(r,3.1);assert.ok(h.x < -30);
});
test('minion waves are created and simulated without clients or trusting browser positions', () => {
  const r=game();advance(r,2.1);assert.equal(r.minions.length,8);assert.equal(r.minions.filter(m=>m.team===0).length,4);
  const x=r.minions[0].x;advance(r,1);assert.ok(r.minions[0].x>x);advance(r,18);assert.ok(r.events.some(e=>e.type==='wave'));
});
test('a last hit awards gold, CS and nearby XP, and levelling unlocks R at six', () => {
  const r=game('ashe','garen');advance(r,2.1);const[h,f]=heroes(r);h.x=0;h.z=0;f.x=30;h._order={type:'move',x:0,z:0};
  const m=r.minions.find(m=>m.team===1);m.x=5;m.z=0;m.hp=1; const gold=h.gold;
  applyAction(r,'a',{type:'attack',targetId:m.id});advance(r,.5);assert.equal(h.cs,1);assert.ok(h.gold>=gold+38);assert.ok(h.xp>0);
  h.level=6;h.mana=300;applyAction(r,'a',{type:'ability',slot:'r',x:20,z:0});assert.ok(h.cooldowns.r>0);
});
test('towers protect their nexus, then destruction grants access and nexus victory', () => {
  const r=game('ashe','garen'),[h,f]=isolate(r,{x:6,z:0},{x:-39,z:-7});h.ad=10000;h.attackInterval=.05;
  reject(()=>applyAction(r,'a',{type:'attack',targetId:'nexus-1'}),'TARGET');
  applyAction(r,'a',{type:'attack',targetId:'tower-1'});advance(r,.6);assert.equal(r.structures.find(s=>s.id==='tower-1').dead,true);assert.equal(r.structures.find(s=>s.id==='nexus-1').invulnerable,false);
  h.x=25;h.hp=h.maxHp;r.structures.find(s=>s.id==='nexus-1').hp=1;applyAction(r,'a',{type:'attack',targetId:'nexus-1'});advance(r,.6);assert.equal(r.phase,'finished');assert.equal(r.winnerTeam,0);
});
test('hero death, respawn and scoreboard are authoritative', () => {
  const r=game('garen','lux'),[h,f]=isolate(r,{x:-1,z:0},{x:1,z:0});h.ad=10000;
  applyAction(r,'a',{type:'attack',targetId:f.id});advance(r,.1);assert.equal(f.dead,true);assert.equal(f.deaths,1);assert.equal(h.kills,1);
  reject(()=>applyAction(r,'b',{type:'move',x:0,z:0}),'DEAD');advance(r,9);assert.equal(f.dead,false);assert.equal(f.hp,f.maxHp);assert.ok(f.x>30);
});
test('bush snapshot omits an unseen enemy and scouting reveals it without leaking internals', () => {
  const r=game('ashe','garen'),[h,f]=isolate(r,{x:-30,z:0},{x:10,z:6});
  const s=snapshot(r,'a');assert.equal(s.heroes.length,1);assert.ok(!JSON.stringify(s).includes('_order'));
  reject(()=>applyAction(r,'a',{type:'attack',targetId:f.id}),'TARGET');applyAction(r,'a',{type:'ability',slot:'e',x:20,z:0});
  assert.equal(snapshot(r,'a').heroes.length,2);assert.equal(snapshot(r,'b').heroes.length,2);
});
test('disconnect ends a running match, replacement returns to lobby, and rematch resets battle', () => {
  const r=game();removePlayer(r,'b');assert.equal(r.phase,'finished');assert.equal(r.winnerTeam,0);
  addPlayer(r,{id:'c',name:'新玩家',champion:'yi'});assert.equal(r.phase,'lobby');assert.equal(r.heroes.length,0);
  applyAction(r,'a',{type:'ready',value:true});applyAction(r,'c',{type:'ready',value:true});applyAction(r,'a',{type:'start'});
  r.phase='finished';r.heroes[0].gold=9999;applyAction(r,'a',{type:'rematch'});assert.equal(r.phase,'playing');assert.equal(r.heroes[0].gold,650);assert.equal(r.heroes[0].kills,0);
});
test('practice bot can start, advances by normal movement and plays without invalid state', () => {
  const r=createRoom('1234',{id:'a',name:'玩家',champion:'lux'});applyAction(r,'a',{type:'ready',value:true});applyAction(r,'a',{type:'bot'});applyAction(r,'a',{type:'start'});
  const bot=r.heroes.find(h=>h.id!=='a'),x=bot.x;advance(r,1);assert.ok(Math.abs(bot.x-x)<=bot.speed*1.4);advance(r,90);
  assert.ok(bot.x<30);assert.ok(Number.isFinite(bot.hp));assert.ok(snapshot(r,'a').minions.length<100);
});

test('prototype-property champion and summoner keys are rejected rather than inherited', () => {
  for (const key of ['constructor','toString','__proto__','hasOwnProperty']) {
    const r=createRoom('1234',{id:'a',name:'甲',champion:key});assert.equal(r.players[0].champion,'garen');
    reject(()=>applyAction(r,'a',{type:'select',champion:key}),'CHAMPION');
    addPlayer(r,{id:'b',name:'乙',champion:'ashe'});applyAction(r,'a',{type:'ready',value:true});applyAction(r,'b',{type:'ready',value:true});applyAction(r,'a',{type:'start'});
    const h=r.heroes[0];h.hp=100;reject(()=>applyAction(r,'a',{type:'summoner',slot:key}),'SKILL');reject(()=>applyAction(r,'a',{type:'ability',slot:key,x:0,z:0}),'SKILL');
    assert.equal(h.hp,100);assert.deepEqual(Object.keys(h.cooldowns),['q','w','e','r','d','f']);
  }
});
test('hidden enemy events do not leak position, values or selected identity through the event history', () => {
  const r=game('ashe','garen'),[h,f]=isolate(r,{x:-30,z:0},{x:10,z:6});f.hp=100;
  applyAction(r,'b',{type:'summoner',slot:'f'});
  assert.ok(r.events.some(e=>e.type==='heal'&&e.targetId==='b'));
  const s=snapshot(r,'a');assert.ok(!s.heroes.some(x=>x.id==='b'));assert.ok(!s.events.some(e=>e.targetId==='b'&&'x'in e));assert.ok(!s.events.some(e=>e.type==='heal'&&e.targetId==='b'));
  assert.ok(snapshot(r,'b').events.some(e=>e.type==='heal'&&e.targetId==='b'));
});

test('defensive tower vision prevents an enemy hiding inside its attack radius', () => {
  const r=game(),[h,f]=isolate(r,{x:-32,z:0},{x:-10,z:-6});
  assert.ok(snapshot(r,'a').heroes.some(u=>u.id==='b'));
  const before=f.hp;advance(r,1.7);assert.ok(f.hp<before,'tower should acquire the enemy in its nearby bush');
});
