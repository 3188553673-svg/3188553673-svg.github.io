import { CHAMPIONS, ITEMS, MAP, SUMMONERS } from '../shared/definitions.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const copyPoint = p => ({ x: p.x, z: p.z });
const round = n => Math.round(n * 100) / 100;
const error = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const alive = u => u && !u.dead && u.hp > 0;
const xpNeeded = level => level >= 12 ? 0 : 90 + (level - 1) * 65;
const cleanName = value => String(value || '召唤师').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12) || '召唤师';
const choice = id => typeof id === 'string' && Object.hasOwn(CHAMPIONS, id) ? id : 'garen';
function point(action) {
  if (!Number.isFinite(action.x) || !Number.isFinite(action.z)) error('POINT', '请选择地图上的有效位置');
  return { x: clamp(action.x, MAP.minX + .8, MAP.maxX - .8), z: clamp(action.z, MAP.minZ + .7, MAP.maxZ - .7) };
}
function unit(room, id) { return room.heroes.find(u => u.id === id) || room.minions.find(u => u.id === id) || room.structures.find(u => u.id === id); }
function units(room) { return [...room.heroes, ...room.minions, ...room.structures]; }
function event(room, type, values = {}) {
  const item = { id: `${room.code}:${room.round}:${++room._sequence}`, type, ...values };
  room.events.push(item); if (room.events.length > 40) room.events.splice(0, room.events.length - 40);
  return item;
}
function effect(room, type, x, z, team, radius = 2, ttl = .5, extra = {}) {
  const e = { id: `fx-${++room._entity}`, type, x, z, team, radius, ttl, maxTtl: ttl, ...extra };
  room.effects.push(e); return e;
}
function stats(hero, healDifference = false) {
  const base = CHAMPIONS[hero.champion].stats, oldMax = hero.maxHp || base.hp;
  let hp = base.hp + (hero.level - 1) * 78, mana = base.mana ? base.mana + (hero.level - 1) * 28 : 0;
  let ad = base.ad + (hero.level - 1) * 4.5, ap = base.ap, armor = base.armor + (hero.level - 1) * 3, speed = base.speed, attackSpeed = 0;
  for (const id of hero.inventory) {
    const item = ITEMS.find(i => i.id === id); if (!item) continue;
    hp += item.stats.hp || 0; ad += item.stats.ad || 0; ap += item.stats.ap || 0; armor += item.stats.armor || 0; speed += item.stats.speed || 0; attackSpeed += item.stats.attackSpeed || 0;
  }
  hero.maxHp = hp; hero.maxMana = mana; hero.ad = ad; hero.ap = ap; hero.armor = armor;
  hero.speed = speed; hero.attackRange = base.attackRange; hero.attackInterval = base.attackInterval / (1 + attackSpeed);
  if (healDifference && !hero.dead) hero.hp = Math.min(hp, hero.hp + Math.max(0, hp - oldMax));
  hero.hp = Math.min(hero.hp, hp); hero.mana = Math.min(hero.mana, mana);
}
function makeHero(player) {
  const base = CHAMPIONS[player.champion].stats, spawn = MAP.spawns[player.team];
  const h = { id: player.id, kind: 'hero', name: player.name, team: player.team, champion: player.champion,
    x: spawn.x + (player.team === 0 ? 3 : -3), z: 0, facing: player.team === 0 ? Math.PI / 2 : -Math.PI / 2,
    hp: base.hp, maxHp: base.hp, mana: base.mana, maxMana: base.mana, level: 1, xp: 0, nextXp: xpNeeded(1), gold: 650,
    ad: base.ad, ap: base.ap, armor: base.armor, speed: base.speed, attackRange: base.attackRange, attackInterval: base.attackInterval,
    inventory: [], cooldowns: { q: 0, w: 0, e: 0, r: 0, d: 0, f: 0 }, dead: false, respawnIn: 0,
    shield: 0, stunned: 0, recalling: 0, kills: 0, deaths: 0, cs: 0,
    _order: { type: 'stop' }, _attackTimer: 0, _buffs: {}, _lastDamaged: -999, _revealUntil: 0, _shieldTime: 0,
    _botAt: 0, _spinAt: 0, _lastHeroSource: null, _lastHeroDamage: -999, _radius: .8, attackAnim: 0 };
  return h;
}
function resetBattle(room) {
  room.round++; room.phase = 'playing'; room.time = 0; room.tick = 0; room.winnerTeam = null;
  room.heroes = room.players.map(makeHero); room.minions = []; room.projectiles = []; room.effects = []; room.events = []; room._zones = []; room._reveals = [0, 0]; room._nextWave = 2;
  room.structures = [0, 1].flatMap(team => [
    { id: `tower-${team}`, kind: 'tower', team, x: team === 0 ? -15 : 15, z: 0, hp: 1650, maxHp: 1650, dead: false, invulnerable: false, _radius: 1.6, _attackTimer: .5, _aggroId: null, _aggroUntil: 0 },
    { id: `nexus-${team}`, kind: 'nexus', team, x: MAP.spawns[team].x, z: 0, hp: 1900, maxHp: 1900, dead: false, invulnerable: true, _radius: 2.1 }
  ]);
  event(room, 'start', { text: '对决开始 · 摧毁敌方水晶获胜' });
}
function finish(room, winnerTeam, text) {
  if (room.phase !== 'playing') return;
  room.phase = 'finished'; room.winnerTeam = winnerTeam;
  room.projectiles = []; room._zones = [];
  event(room, 'victory', { team: winnerTeam, text: text || `${winnerTeam === 0 ? '蓝' : '红'}方摧毁了敌方水晶` });
}
export function createRoom(code, host) {
  if (!host || typeof host.id !== 'string' || !host.id) error('PLAYER', '玩家信息无效');
  const room = { code: String(code), room: String(code), hostId: host.id, phase: 'lobby', players: [], time: 0, tick: 0, winnerTeam: null,
    heroes: [], minions: [], structures: [], projectiles: [], effects: [], events: [], round: 0, _sequence: 0, _entity: 0, _zones: [], _reveals: [0, 0], _nextWave: 2 };
  addPlayer(room, host); return room;
}
export function addPlayer(room, data) {
  if (!data || typeof data.id !== 'string' || !data.id || room.players.some(p => p.id === data.id)) error('PLAYER', '玩家身份无效');
  if (room.players.length >= 2) error('FULL', '房间已满');
  if (room.phase === 'playing') error('PLAYING', '对局已经开始');
  if (room.phase === 'finished') {
    room.phase = 'lobby'; room.heroes = []; room.minions = []; room.structures = []; room.projectiles = []; room.effects = []; room.events = []; room.winnerTeam = null;
    for (const p of room.players) p.ready = false;
  }
  const player = { id: data.id, name: cleanName(data.name), champion: choice(data.champion), team: room.players.some(p => p.team === 0) ? 1 : 0, ready: false, isBot: Boolean(data.isBot) };
  room.players.push(player); return player;
}
export function removePlayer(room, playerId) {
  const i = room.players.findIndex(p => p.id === playerId); if (i < 0) return false;
  const [p] = room.players.splice(i, 1);
  if (room.phase === 'playing') finish(room, 1 - p.team, '对手离开了对局');
  if (room.hostId === playerId) room.hostId = room.players.find(p => !p.isBot)?.id || room.players[0]?.id || null;
  return true;
}
function bushAt(p) { return MAP.bushes.find(b => distance(p, b) <= b.radius); }
function visible(room, team, target) {
  if (target.kind !== 'hero' || target.team === team || target.dead) return true;
  if (!bushAt(target) || target._revealUntil > room.time || room._reveals[team] > room.time) return true;
  return units(room).some(u => u.team === team && alive(u) && distance(u, target) < (u.kind === 'tower' ? 12 : u.kind === 'nexus' ? 9 : 7));
}
function cancelChannel(hero) { hero.recalling = 0; hero._buffs.meditate = 0; }
function heal(room, target, amount) {
  if (!alive(target)) return;
  const gain = Math.min(amount, target.maxHp - target.hp); target.hp += gain;
  if (gain > 12) event(room, 'heal', { x: target.x, z: target.z, targetId: target.id, value: Math.round(gain), team: target.team });
}
function gainXp(room, hero, amount) {
  if (!hero || hero.level >= 12) return;
  hero.xp += amount;
  while (hero.level < 12 && hero.xp >= xpNeeded(hero.level)) {
    hero.xp -= xpNeeded(hero.level); hero.level++; stats(hero, true);
    hero.mana = Math.min(hero.maxMana, hero.mana + 35);
    effect(room, 'level', hero.x, hero.z, hero.team, 2.8, 1);
    event(room, 'level', { targetId: hero.id, x: hero.x, z: hero.z, value: hero.level, team: hero.team, text: `${hero.name} 升至 ${hero.level} 级` });
  }
  hero.nextXp = xpNeeded(hero.level);
}
function kill(room, target, source) {
  if (target.dead) return;
  target.dead = true; target.hp = 0; target._deathAt = room.time;
  const sourceHero = room.heroes.find(h => h.id === source?.id);
  if (target.kind === 'hero') {
    target.deaths++; target.respawnIn = 7 + target.level * 1.4; target.recalling = 0; target._order = { type: 'stop' }; target.shield = 0; target._buffs = {};
    let killer = sourceHero;
    if (!killer && target._lastHeroSource && room.time - target._lastHeroDamage < 8) killer = room.heroes.find(h => h.id === target._lastHeroSource);
    if (killer && killer.team !== target.team) { killer.kills++; killer.gold += 300; gainXp(room, killer, 160); }
    effect(room, 'death', target.x, target.z, target.team, 2, 1.2);
    event(room, 'kill', { actorId: killer?.id, targetId: target.id, team: killer?.team ?? 1 - target.team, x: target.x, z: target.z, text: `${killer?.name || '防御塔'} 击败了 ${target.name}` });
  } else if (target.kind === 'minion') {
    if (sourceHero && sourceHero.team !== target.team) { sourceHero.cs++; const gold = target.minionType === 'caster' ? 38 : 45; sourceHero.gold += gold; event(room, 'gold', { targetId: sourceHero.id, value: gold, x: target.x, z: target.z, team: sourceHero.team }); }
    for (const h of room.heroes) if (h.team !== target.team && !h.dead && distance(h, target) < 19) gainXp(room, h, target.minionType === 'caster' ? 40 : 48);
  } else if (target.kind === 'tower') {
    const owner = room.heroes.find(h => h.team !== target.team); if (owner) { owner.gold += 250; gainXp(room, owner, 150); }
    const nexus = room.structures.find(u => u.team === target.team && u.kind === 'nexus'); if (nexus) nexus.invulnerable = false;
    effect(room, 'death', target.x, target.z, target.team, 4, 2);
    event(room, 'tower', { team: 1 - target.team, targetId: target.id, text: `${target.team === 0 ? '蓝' : '红'}方防御塔被摧毁` });
  } else if (target.kind === 'nexus') finish(room, 1 - target.team);
}
function damage(room, target, amount, source, damageType = 'physical', control = {}) {
  if (!alive(target) || target.invulnerable || target.kind === 'hero' && (target._buffs.untargetable || 0) > 0) return 0;
  if (source && source.team === target.team) return 0;
  let value = Math.max(0, amount);
  if (damageType === 'physical') value *= 100 / (100 + (target.armor || 0));
  if (damageType === 'magic') value *= target.kind === 'hero' ? .8 : 1;
  if (target.kind === 'hero') {
    if ((target._buffs.courage || 0) > 0) value *= .75;
    if ((target._buffs.meditate || 0) > 0) value *= .6;
    target._lastDamaged = room.time; target.recalling = 0; target._revealUntil = room.time + 2;
    if (source?.kind === 'hero') { target._lastHeroSource = source.id; target._lastHeroDamage = room.time; }
    if (control.stun) target.stunned = Math.max(target.stunned, control.stun);
    if (control.root) target._buffs.root = Math.max(target._buffs.root || 0, control.root);
    if (control.silence) target._buffs.silence = Math.max(target._buffs.silence || 0, control.silence);
    if (control.slow && !(target._buffs.highlander > 0)) target._buffs.slow = Math.max(target._buffs.slow || 0, control.slow);
    const blocked = Math.min(target.shield, value); target.shield -= blocked; value -= blocked;
  }
  target.hp = Math.max(0, target.hp - value);
  if (value > 0) { event(room, 'damage', { x: target.x, z: target.z, targetId: target.id, actorId: source?.id, value: Math.round(value), team: source?.team, damageType }); effect(room, 'hit', target.x, target.z, target.team, .6, .22); }
  if (source?.kind === 'hero' && target.kind === 'hero') {
    source._revealUntil = room.time + 2;
    for (const t of room.structures) if (t.kind === 'tower' && t.team === target.team && alive(t) && distance(t, source) <= 12) { t._aggroId = source.id; t._aggroUntil = room.time + 3; }
  }
  if (target.hp <= 0) kill(room, target, source);
  return value;
}
function closestEnemy(room, self, range, predicate = () => true) {
  let best = null, d = range;
  for (const u of units(room)) {
    if (u.team === self.team || !alive(u) || u.invulnerable || !predicate(u) || !visible(room, self.team, u)) continue;
    const n = distance(self, u) - (u._radius || .5);
    if (n < d) { best = u; d = n; }
  }
  return best;
}
function aimDirection(hero, target) {
  const dx = target.x - hero.x, dz = target.z - hero.z, n = Math.hypot(dx, dz);
  return n > .001 ? { x: dx / n, z: dz / n } : { x: Math.sin(hero.facing), z: Math.cos(hero.facing) };
}
function projectile(room, source, target, kind, amount, damageType = 'physical', opts = {}) {
  const dir = aimDirection(source, target);
  const p = { id: `p-${++room._entity}`, kind, team: source.team, ownerId: source.id, x: source.x, z: source.z, dx: dir.x, dz: dir.z,
    radius: .4, speed: 25, ttl: 3, amount, damageType, hits: new Set(), ...opts };
  room.projectiles.push(p); return p;
}
function basicAttack(room, source, target) {
  if (!alive(source) || !alive(target) || source._attackTimer > 0) return;
  source._attackTimer = source.attackInterval || (source.minionType === 'caster' ? 1.35 : 1.15);
  source.attackAnim = .3;
  if (source.kind === 'hero') {
    if (source._buffs.focus > 0) source._attackTimer /= 1.65;
    if (source._buffs.highlander > 0) source._attackTimer /= 1.5;
    source._revealUntil = room.time + 2;
  }
  let amount = source.ad || 20, extra = {}, trueDamage = 0;
  if (source.kind === 'hero') {
    if (source.champion === 'garen' && source._buffs.decisive > 0) { amount += 70 + source.ad * .4; source._buffs.decisive = 0; extra.silence = 1.2; }
    if (source.champion === 'ashe') { extra.slow = 1.2; if (source._buffs.focus > 0) amount += 15; }
    if (source.champion === 'yi' && source._buffs.wuju > 0) trueDamage = 28 + source.ad * .18;
  }
  event(room, 'attack', { actorId: source.id, targetId: target.id, x: source.x, z: source.z, team: source.team });
  if ((source.attackRange || 2) >= 6 || source.kind === 'tower') projectile(room, source, target, source.kind === 'tower' ? 'tower' : source.champion === 'ashe' ? 'arrow' : 'bolt', amount, 'physical', { targetId: target.id, control: extra, trueDamage, speed: source.kind === 'tower' ? 34 : 28, radius: .25 });
  else { damage(room, target, amount, source, 'physical', extra); if (trueDamage > 0) damage(room, target, trueDamage, source, 'true'); }
}
function inRange(hero, target, range) { return distance(hero, target) <= range + (target._radius || .5); }
function abilityTarget(room, hero, action, range, heroesOnly = false) {
  let target = action.targetId ? unit(room, action.targetId) : null;
  if (!target && Number.isFinite(action.x) && Number.isFinite(action.z)) {
    const aim = point(action);
    target = units(room).filter(u => u.team !== hero.team && alive(u) && (!heroesOnly || u.kind === 'hero') && inRange(hero, u, range) && visible(room, hero.team, u)).sort((a, b) => distance(a, aim) - distance(b, aim))[0];
    if (target && distance(target, aim) > 4.5) target = null;
  }
  if (!target || target.team === hero.team || !alive(target) || target.invulnerable || ['tower', 'nexus'].includes(target.kind) || heroesOnly && target.kind !== 'hero' || !inRange(hero, target, range) || !visible(room, hero.team, target)) error('TARGET', '目标不在技能范围内');
  return target;
}
function cast(room, hero, action) {
  const slot = typeof action.slot === 'string' ? action.slot.toLowerCase() : '';
  if (!['q', 'w', 'e', 'r'].includes(slot)) error('SKILL', '技能无效');
  const meta = CHAMPIONS[hero.champion].skills[slot];
  if (slot === 'r' && hero.level < 6) error('LEVEL', '终极技能在6级解锁');
  if (hero.cooldowns[slot] > .02) error('COOLDOWN', '技能还在冷却');
  if (hero._buffs.silence > 0) error('SILENCED', '沉默中，无法施放技能');
  if (hero.mana < meta.cost) error('MANA', '法力不足');
  let target = null, aim = null;
  if (meta.shape === 'target') target = abilityTarget(room, hero, action, meta.range, hero.champion === 'garen');
  if (['line', 'cone', 'circle'].includes(meta.shape) && !(hero.champion === 'garen' && slot === 'e')) aim = point(action);
  cancelChannel(hero); hero.cooldowns[slot] = meta.cooldown; hero.mana -= meta.cost; hero._revealUntil = room.time + 2;
  if (aim) { const dir = aimDirection(hero, aim); hero.facing = Math.atan2(dir.x, dir.z); }
  event(room, 'cast', { actorId: hero.id, champion: hero.champion, slot, x: hero.x, z: hero.z, team: hero.team });
  const b = hero._buffs;
  if (hero.champion === 'garen') {
    if (slot === 'q') { b.decisive = 4; b.haste = 3; effect(room, 'haste', hero.x, hero.z, hero.team, 1.7, 3, { ownerId: hero.id }); }
    if (slot === 'w') { hero.shield += 180 + hero.level * 20; hero._shieldTime = 3; b.courage = 3; effect(room, 'shield', hero.x, hero.z, hero.team, 1.5, 3, { ownerId: hero.id }); }
    if (slot === 'e') { b.spin = 3; hero._spinAt = room.time; effect(room, 'spin', hero.x, hero.z, hero.team, 4.2, 3, { ownerId: hero.id }); }
    if (slot === 'r') { effect(room, 'execute', target.x, target.z, hero.team, 2, .8); damage(room, target, 160 + (target.maxHp - target.hp) * .3, hero, 'true'); }
  } else if (hero.champion === 'ashe') {
    if (slot === 'q') { b.focus = 5; effect(room, 'haste', hero.x, hero.z, hero.team, 1.5, 5, { ownerId: hero.id }); }
    if (slot === 'w') {
      const dir = aimDirection(hero, aim), angle = Math.atan2(dir.z, dir.x), groupHits = new Set();
      for (let i = -3; i <= 3; i++) { const a = angle + i * .13; projectile(room, hero, { x: hero.x + Math.cos(a), z: hero.z + Math.sin(a) }, 'arrow', 85 + hero.ad * .5, 'physical', { radius: .5, ttl: .78, speed: 24, control: { slow: 1.7 }, groupHits, spell: true }); }
    }
    if (slot === 'e') { room._reveals[hero.team] = room.time + 5; effect(room, 'scout', hero.x, hero.z, hero.team, 35, 1.2, { toX: aim.x, toZ: aim.z }); }
    if (slot === 'r') projectile(room, hero, aim, 'ice', 210 + hero.ap * .7, 'magic', { radius: 1.2, ttl: 4, speed: 25, heroesOnly: true, spell: true, control: { stun: 2 } });
  } else if (hero.champion === 'lux') {
    if (slot === 'q') projectile(room, hero, aim, 'orb', 110 + hero.ap * .7, 'magic', { radius: .7, speed: 24, ttl: .85, pierce: 2, spell: true, control: { root: 1.5 } });
    if (slot === 'w') { hero.shield += 160 + hero.ap * .45; hero._shieldTime = 3; effect(room, 'shield', hero.x, hero.z, hero.team, 1.6, 3, { ownerId: hero.id }); }
    if (slot === 'e') {
      const dir = aimDirection(hero, aim), len = Math.min(meta.range, distance(hero, aim));
      const zone = { id: `zone-${++room._entity}`, type: 'orb', team: hero.team, ownerId: hero.id, x: hero.x + dir.x * len, z: hero.z + dir.z * len, radius: 4.2, ttl: 1.4, amount: 125 + hero.ap * .7 };
      room._zones.push(zone); effect(room, 'aoe', zone.x, zone.z, hero.team, zone.radius, 1.4, { ownerId: hero.id });
    }
    if (slot === 'r') {
      const dir = aimDirection(hero, aim), end = { x: hero.x + dir.x * meta.range, z: hero.z + dir.z * meta.range };
      room._zones.push({ id: `zone-${++room._entity}`, type: 'laser', team: hero.team, ownerId: hero.id, x: hero.x, z: hero.z, toX: end.x, toZ: end.z, radius: 1.8, ttl: .45, amount: 280 + hero.ap * .9 });
      effect(room, 'laser', hero.x, hero.z, hero.team, 1.8, .8, { toX: end.x, toZ: end.z, ownerId: hero.id });
    }
  } else if (hero.champion === 'yi') {
    if (slot === 'q') {
      const from = copyPoint(hero); hero.x = clamp(target.x + (hero.team === 0 ? -1.4 : 1.4), MAP.minX + 1, MAP.maxX - 1); hero.z = clamp(target.z, MAP.minZ + .7, MAP.maxZ - .7);
      b.untargetable = .35; hero._order = { type: 'attack', targetId: target.id };
      effect(room, 'dash', from.x, from.z, hero.team, 1.2, .45, { toX: hero.x, toZ: hero.z }); damage(room, target, 115 + hero.ad * .8, hero);
    }
    if (slot === 'w') { b.meditate = 3; hero._order = { type: 'stop' }; effect(room, 'heal', hero.x, hero.z, hero.team, 2, 3, { ownerId: hero.id }); }
    if (slot === 'e') { b.wuju = 5; effect(room, 'empower', hero.x, hero.z, hero.team, 1.6, 5, { ownerId: hero.id }); }
    if (slot === 'r') { b.highlander = 8; b.slow = 0; effect(room, 'haste', hero.x, hero.z, hero.team, 2, 8, { ownerId: hero.id }); }
  }
}
export function applyAction(room, playerId, action) {
  const p = room.players.find(p => p.id === playerId); if (!p) error('PLAYER', '你已不在这个房间');
  if (!action || typeof action !== 'object' || Array.isArray(action)) error('ACTION', '操作无效');
  if (['select', 'ready', 'bot', 'start'].includes(action.type)) {
    if (room.phase !== 'lobby') error('PHASE', '此操作只能在准备阶段进行');
    if (action.type === 'select') { if (typeof action.champion !== 'string' || !Object.hasOwn(CHAMPIONS, action.champion)) error('CHAMPION', '请选择有效英雄'); p.champion = action.champion; p.ready = false; return; }
    if (action.type === 'ready') { p.ready = typeof action.value === 'boolean' ? action.value : !p.ready; return; }
    if (playerId !== room.hostId) error('HOST', '只有房主可以进行此操作');
    if (action.type === 'bot') { const b = addPlayer(room, { id: `bot-${room.code}`, name: '训练对手', champion: p.champion === 'lux' ? 'garen' : 'ashe', isBot: true }); b.ready = true; return; }
    if (room.players.length !== 2 || !room.players.every(p => p.ready)) error('READY', '需要双方选好英雄并准备');
    resetBattle(room); return;
  }
  if (action.type === 'rematch') {
    if (room.phase !== 'finished' || playerId !== room.hostId || room.players.length !== 2) error('PHASE', '只有房主可以在双方就位后再来一局');
    resetBattle(room); return;
  }
  if (room.phase !== 'playing') error('PHASE', '当前尚未开始对决');
  const hero = room.heroes.find(h => h.id === playerId);
  if (!hero) error('PLAYER', '没有找到你的英雄');
  if (action.type === 'buy') {
    const item = ITEMS.find(i => i.id === action.itemId); if (!item) error('ITEM', '装备无效');
    if (!hero.dead && distance(hero, MAP.spawns[hero.team]) > 8) error('SHOP', '请回到己方泉水附近购买装备');
    if (hero.inventory.length >= 6) error('INVENTORY', '装备栏已满');
    if (item.id === 'boots' && hero.inventory.includes('boots')) error('ITEM', '你已经拥有鞋子');
    if (hero.gold < item.cost) error('GOLD', '金币不足');
    hero.gold -= item.cost; hero.inventory.push(item.id); stats(hero, true); event(room, 'buy', { actorId: hero.id, itemId: item.id, text: `购买 ${item.name}`, team: hero.team }); return;
  }
  if (hero.dead) error('DEAD', '英雄正在等待复活');
  if (hero.stunned > 0) error('STUNNED', '眩晕中，暂时无法行动');
  if (['move', 'attack_move'].includes(action.type)) { const aim = point(action); cancelChannel(hero); hero._order = { type: action.type, ...aim }; return; }
  if (action.type === 'attack') {
    const target = unit(room, action.targetId); if (!target || !alive(target) || target.team === hero.team || target.invulnerable || !visible(room, hero.team, target)) error('TARGET', '请选择可攻击的敌人');
    cancelChannel(hero); hero._order = { type: 'attack', targetId: target.id }; return;
  }
  if (action.type === 'stop') { cancelChannel(hero); hero._order = { type: 'stop' }; return; }
  if (action.type === 'ability') { cast(room, hero, action); return; }
  if (action.type === 'recall') { hero.recalling = 6; hero._buffs.meditate = 0; hero._order = { type: 'stop' }; effect(room, 'recall', hero.x, hero.z, hero.team, 2, 6, { ownerId: hero.id }); return; }
  if (action.type === 'summoner') {
    const slot = typeof action.slot === 'string' ? action.slot.toLowerCase() : ''; if (!Object.hasOwn(SUMMONERS, slot)) error('SKILL', '召唤师技能无效');
    if (hero.cooldowns[slot] > .02) error('COOLDOWN', '召唤师技能还在冷却');
    const aim = slot === 'd' ? point(action) : null; cancelChannel(hero); hero.cooldowns[slot] = SUMMONERS[slot].cooldown;
    if (slot === 'd') {
      if (hero._buffs.root > 0) { hero.cooldowns[slot] = 0; error('ROOTED', '禁锢中不能闪现'); }
      const before = copyPoint(hero), dir = aimDirection(hero, aim), n = Math.min(9, distance(hero, aim)); hero.x = clamp(hero.x + dir.x * n, MAP.minX + 1, MAP.maxX - 1); hero.z = clamp(hero.z + dir.z * n, MAP.minZ + .7, MAP.maxZ - .7); hero._order = { type: 'stop' };
      effect(room, 'flash', before.x, before.z, hero.team, 2, .55, { toX: hero.x, toZ: hero.z });
    } else { heal(room, hero, 220 + hero.level * 30); hero._buffs.haste = 2; effect(room, 'heal', hero.x, hero.z, hero.team, 2.5, 1, { ownerId: hero.id }); }
    return;
  }
  error('ACTION', '未知操作');
}
function moveToward(hero, target, amount) {
  const dx = target.x - hero.x, dz = target.z - hero.z, len = Math.hypot(dx, dz);
  if (len < .05) return false;
  const step = Math.min(len, amount); hero.x = clamp(hero.x + dx / len * step, MAP.minX + .7, MAP.maxX - .7); hero.z = clamp(hero.z + dz / len * step, MAP.minZ + .7, MAP.maxZ - .7); hero.facing = Math.atan2(dx, dz); return true;
}
function spawnWave(room) {
  for (const team of [0, 1]) for (let i = 0; i < 4; i++) {
    const ranged = i === 3, scale = 1 + Math.min(.8, room.time / 600);
    room.minions.push({ id: `m-${++room._entity}`, kind: 'minion', team, minionType: ranged ? 'caster' : 'melee', x: MAP.spawns[team].x + (team === 0 ? 5 : -5) + (team === 0 ? -i : i) * 1.2,
      z: ranged ? 0 : (i - 1) * 1.5, facing: team === 0 ? Math.PI / 2 : -Math.PI / 2, hp: (ranged ? 155 : 235) * scale, maxHp: (ranged ? 155 : 235) * scale,
      ad: (ranged ? 24 : 18) * scale, armor: 0, speed: ranged ? 4 : 4.2, attackRange: ranged ? 6.5 : 1.6, attackInterval: ranged ? 1.4 : 1.2,
      dead: false, _attackTimer: i * .1, _radius: ranged ? .5 : .6, _bornAt: room.time, attackAnim: 0 });
  }
  event(room, 'wave', { text: '新一波小兵出发' });
}
function botThink(room, h) {
  if (room.time < h._botAt || h.dead) return; h._botAt = room.time + .35;
  const base = MAP.spawns[h.team], foe = room.heroes.find(o => o.team !== h.team && alive(o) && visible(room, h.team, o));
  const invoke = a => { try { applyAction(room, h.id, a); } catch {} };
  if (distance(h, base) < 8 && h.gold >= 350 && h.inventory.length < 6) invoke({ type: 'buy', itemId: h.inventory.includes('boots') ? (h.champion === 'lux' ? 'tome' : 'blade') : h.gold > 500 ? 'boots' : 'blade' });
  if (h.hp / h.maxHp < .25) {
    if (h.cooldowns.f <= 0) invoke({ type: 'summoner', slot: 'f' });
    invoke({ type: 'move', x: base.x + (h.team === 0 ? 2 : -2), z: (h.team === 0 ? -1 : 1) }); return;
  }
  if (distance(h, base) < 7 && h.hp / h.maxHp < .85) { h._order = { type: 'stop' }; return; }
  const tower = room.structures.find(t => t.kind === 'tower' && t.team !== h.team && alive(t));
  const enemyInRange = foe && distance(h, foe) < 12;
  if (enemyInRange) {
    if (h.hp / h.maxHp < .65 && h.cooldowns.w <= 0 && ['garen', 'lux', 'yi'].includes(h.champion)) invoke({ type: 'ability', slot: 'w', x: foe.x, z: foe.z, targetId: foe.id });
    if (h._buffs.meditate > 0) return;
    // One chosen cast per reaction avoids instant full-combo bots and lets players dodge.
    const d = distance(h, foe);
    const useful = slot => {
      if (h.champion === 'garen') return slot === 'r' ? foe.hp / foe.maxHp < .45 && d < 6 : slot === 'e' ? d < 4.8 : slot === 'q' ? d < 11 : h.hp / h.maxHp < .7;
      if (h.champion === 'yi') return slot === 'q' ? d < 10.5 : slot === 'w' ? false : d < 7;
      if (h.champion === 'ashe') return slot === 'e' ? false : slot === 'q' ? d < h.attackRange + 1 : slot === 'r' ? d < 12 && foe.hp / foe.maxHp < .7 : true;
      return slot === 'w' ? h.hp / h.maxHp < .7 : true;
    };
    const chosen = ['r', 'q', 'e', 'w'].find(slot => h.cooldowns[slot] <= 0 && (slot !== 'r' || h.level >= 6) && h.mana >= CHAMPIONS[h.champion].skills[slot].cost && useful(slot));
    if (chosen) invoke({ type: 'ability', slot: chosen, x: foe.x, z: foe.z, targetId: foe.id });
    if (tower && distance(h, tower) < 11 && !room.minions.some(m => m.team === h.team && alive(m) && distance(m, tower) < 10)) invoke({ type: 'move', x: tower.x + (h.team === 0 ? -12 : 12), z: 1 });
    else if (h.attackRange > 6 && distance(h, foe) < 5) invoke({ type: 'move', x: h.x + (h.team === 0 ? -4 : 4), z: clamp(h.z + 2, -4, 4) });
    else invoke({ type: 'attack', targetId: foe.id });
    return;
  }
  const minion = closestEnemy(room, h, 13, u => u.kind === 'minion');
  if (minion) { invoke({ type: 'attack', targetId: minion.id }); if (h.champion === 'lux' && room.minions.filter(m => m.team !== h.team && alive(m) && distance(m, minion) < 4).length >= 2 && h.cooldowns.e <= 0) invoke({ type: 'ability', slot: 'e', x: minion.x, z: minion.z }); return; }
  const objective = tower || room.structures.find(t => t.kind === 'nexus' && t.team !== h.team && alive(t));
  if (objective) {
    const allies = room.minions.filter(m => m.team === h.team && alive(m) && distance(m, objective) < 12);
    if (tower && !allies.length && distance(h, tower) < 13) h._order = { type: 'stop' };
    else if (allies.length) invoke({ type: 'attack', targetId: objective.id });
    else invoke({ type: 'attack_move', x: objective.x + (h.team === 0 ? -13 : 13), z: 1 });
  }
}
function heroStep(room, h, dt) {
  h._attackTimer = Math.max(0, h._attackTimer - dt); h.attackAnim = Math.max(0, h.attackAnim - dt);
  for (const slot of Object.keys(h.cooldowns)) h.cooldowns[slot] = Math.max(0, h.cooldowns[slot] - dt);
  for (const key of Object.keys(h._buffs)) h._buffs[key] = Math.max(0, h._buffs[key] - dt);
  h.stunned = Math.max(0, h.stunned - dt); h._shieldTime = Math.max(0, h._shieldTime - dt); if (h._shieldTime <= 0) h.shield = 0;
  h.gold += dt * 2.2;
  if (h.dead) {
    h.respawnIn = Math.max(0, h.respawnIn - dt);
    if (h.respawnIn <= 0) { h.dead = false; h.x = MAP.spawns[h.team].x + (h.team === 0 ? 2.5 : -2.5); h.z = 0; h.hp = h.maxHp; h.mana = h.maxMana; h._lastDamaged = room.time; h._order = { type: 'stop' }; event(room, 'respawn', { actorId: h.id, team: h.team, text: `${h.name} 已复活` }); }
    return;
  }
  const inFountain = distance(h, MAP.spawns[h.team]) < 7;
  if (inFountain) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .15 * dt); h.mana = Math.min(h.maxMana, h.mana + h.maxMana * .2 * dt); }
  else { h.hp = Math.min(h.maxHp, h.hp + (h.champion === 'garen' && room.time - h._lastDamaged > 6 ? h.maxHp * .025 : 2.2) * dt); h.mana = Math.min(h.maxMana, h.mana + 5.5 * dt); }
  if (h._buffs.meditate > 0 && h.stunned <= 0) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .08 * dt); return; }
  if (h.recalling > 0) {
    h.recalling = Math.max(0, h.recalling - dt);
    if (h.recalling <= 0) { h.x = MAP.spawns[h.team].x + (h.team === 0 ? 2.5 : -2.5); h.z = 0; effect(room, 'flash', h.x, h.z, h.team, 2, .7); }
    return;
  }
  if (h.stunned > 0) return;
  const p = room.players.find(p => p.id === h.id); if (p?.isBot) botThink(room, h);
  if (h._buffs.meditate > 0) return;
  let speed = h.speed * (h._buffs.haste > 0 ? 1.3 : 1) * (h._buffs.highlander > 0 ? 1.35 : 1) * (h._buffs.slow > 0 && !h._buffs.highlander ? .65 : 1);
  if (h._buffs.root > 0) speed = 0;
  const order = h._order;
  let target = order.type === 'attack' ? unit(room, order.targetId) : null;
  if (target && (!alive(target) || !visible(room, h.team, target) || target.invulnerable)) { target = null; h._order = { type: 'stop' }; }
  if (order.type === 'attack_move') target = closestEnemy(room, h, 12, u => u.kind !== 'nexus' || !u.invulnerable);
  if (target) {
    h.facing = Math.atan2(target.x - h.x, target.z - h.z);
    if (inRange(h, target, h.attackRange)) { if (!(h._buffs.spin > 0)) basicAttack(room, h, target); }
    else if (speed > 0) moveToward(h, target, speed * dt);
  } else if (order.type === 'move' || order.type === 'attack_move') { if (speed > 0) moveToward(h, order, speed * dt); }
  else if (!(h._buffs.spin > 0)) { const near = closestEnemy(room, h, h.attackRange, u => u.kind !== 'nexus' || !u.invulnerable); if (near) basicAttack(room, h, near); }
  if (h._buffs.spin > 0 && room.time >= h._spinAt) {
    h._spinAt = room.time + .5;
    for (const enemy of units(room)) if (enemy.team !== h.team && enemy.kind !== 'tower' && enemy.kind !== 'nexus' && alive(enemy) && distance(h, enemy) <= 4.2 + (enemy._radius || .5)) damage(room, enemy, 24 + h.ad * .22, h);
  }
}
function minionStep(room, m, dt) {
  if (!alive(m)) return;
  m._attackTimer = Math.max(0, m._attackTimer - dt); m.attackAnim = Math.max(0, m.attackAnim - dt);
  let target = closestEnemy(room, m, 9, u => u.kind !== 'nexus' || !u.invulnerable);
  if (!target) target = room.structures.find(t => t.team !== m.team && t.kind === 'tower' && alive(t)) || room.structures.find(t => t.team !== m.team && t.kind === 'nexus' && alive(t));
  if (!target) return;
  if (inRange(m, target, m.attackRange)) basicAttack(room, m, target);
  else moveToward(m, target, m.speed * dt);
}
function towerStep(room, t, dt) {
  if (!alive(t) || t.kind !== 'tower') return;
  t._attackTimer = Math.max(0, t._attackTimer - dt);
  let target = t._aggroUntil > room.time ? unit(room, t._aggroId) : null;
  if (!alive(target) || target.team === t.team || distance(target, t) > 12 || !visible(room, t.team, target)) target = null;
  if (!target) target = closestEnemy(room, t, 11, u => u.kind === 'minion') || closestEnemy(room, t, 11, u => u.kind === 'hero');
  if (target && t._attackTimer <= 0) { t.ad = 130 + Math.min(80, room.time * .1); t.attackRange = 11; t.attackInterval = 1.1; basicAttack(room, t, target); }
}
function distanceSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len = dx * dx + dz * dz;
  const t = len ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / len, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}
function projectileStep(room, p, dt) {
  p.ttl -= dt; if (p.ttl <= 0) return;
  const from = copyPoint(p), source = unit(room, p.ownerId) || { id: p.ownerId, team: p.team };
  if (p.targetId) {
    const target = unit(room, p.targetId);
    if (!alive(target)) { p.ttl = 0; return; }
    const dir = aimDirection(p, target); p.dx = dir.x; p.dz = dir.z;
    if (distance(p, target) <= p.speed * dt + (target._radius || .5)) { damage(room, target, p.amount, source, p.damageType, p.control); if (p.trueDamage) damage(room, target, p.trueDamage, source, 'true'); p.ttl = 0; return; }
  }
  p.x += p.dx * p.speed * dt; p.z += p.dz * p.speed * dt;
  if (!p.targetId) for (const target of units(room)) {
    if (target.team === p.team || !alive(target) || target.invulnerable || p.spell && ['tower', 'nexus'].includes(target.kind) || p.heroesOnly && target.kind !== 'hero' || p.hits.has(target.id) || distanceSegment(target, from, p) > p.radius + (target._radius || .5)) continue;
    if (p.groupHits?.has(target.id)) { p.ttl = 0; break; }
    p.groupHits?.add(target.id);
    p.hits.add(target.id); damage(room, target, p.amount, source, p.damageType, p.control);
    if (!p.pierce || p.hits.size >= p.pierce) { p.ttl = 0; break; }
  }
}
function zoneStep(room, zone, dt) {
  zone.ttl -= dt;
  const source = unit(room, zone.ownerId) || { id: zone.ownerId, team: zone.team };
  if (zone.type === 'orb') for (const h of room.heroes) if (h.team !== zone.team && alive(h) && distance(h, zone) <= zone.radius && !h._buffs.highlander) h._buffs.slow = Math.max(h._buffs.slow || 0, .3);
  if (zone.ttl > 0) return;
  for (const target of units(room)) {
    if (target.team === zone.team || !alive(target) || target.kind === 'tower' || target.kind === 'nexus') continue;
    const hit = zone.type === 'laser' ? distanceSegment(target, zone, { x: zone.toX, z: zone.toZ }) < zone.radius + (target._radius || .5) : distance(target, zone) < zone.radius + (target._radius || .5);
    if (hit) damage(room, target, zone.amount, source, 'magic');
  }
  if (zone.type === 'orb') effect(room, 'burst', zone.x, zone.z, zone.team, zone.radius, .6);
}
export function step(room, elapsed = .05) {
  if (!Number.isFinite(elapsed) || elapsed <= 0 || room.phase !== 'playing') return;
  const dt = Math.min(.1, elapsed); room.time += dt; room.tick++;
  if (room.time >= room._nextWave && room.minions.length < 90) { spawnWave(room); room._nextWave += 18; }
  for (const h of room.heroes) heroStep(room, h, dt);
  for (const m of room.minions) minionStep(room, m, dt);
  for (const t of room.structures) towerStep(room, t, dt);
  for (const p of room.projectiles) projectileStep(room, p, dt);
  for (const z of room._zones) zoneStep(room, z, dt);
  for (const fx of room.effects) { fx.ttl -= dt; if (fx.ownerId && ['spin', 'shield', 'heal', 'haste', 'empower'].includes(fx.type)) { const h = unit(room, fx.ownerId); if (h && alive(h)) { fx.x = h.x; fx.z = h.z; } else fx.ttl = 0; } }
  room.effects = room.effects.filter(e => e.ttl > 0); room.projectiles = room.projectiles.filter(p => p.ttl > 0); room._zones = room._zones.filter(z => z.ttl > 0);
  room.minions = room.minions.filter(m => (!m.dead || room.time - m._deathAt < .6) && room.time - m._bornAt < 240);
}
function heroSnapshot(h) {
  return { id: h.id, kind: h.kind, name: h.name, team: h.team, champion: h.champion, x: round(h.x), z: round(h.z), facing: round(h.facing), hp: round(h.hp), maxHp: h.maxHp, mana: round(h.mana), maxMana: h.maxMana,
    level: h.level, xp: h.xp, nextXp: h.nextXp, gold: Math.floor(h.gold), ad: round(h.ad), ap: round(h.ap), armor: round(h.armor), speed: round(h.speed), attackRange: h.attackRange, attackInterval: round(h.attackInterval),
    inventory: [...h.inventory], cooldowns: Object.fromEntries(Object.entries(h.cooldowns).map(([k, v]) => [k, round(v)])), dead: h.dead, respawnIn: round(h.respawnIn), shield: round(h.shield), stunned: round(h.stunned), recalling: round(h.recalling),
    kills: h.kills, deaths: h.deaths, cs: h.cs, attackAnim: round(h.attackAnim), rooted: h._buffs.root > 0, slowed: h._buffs.slow > 0, silenced: h._buffs.silence > 0,
    buffs: Object.fromEntries(Object.entries(h._buffs).filter(([, v]) => v > 0).map(([k, v]) => [k, round(v)])) };
}
export function snapshot(room, viewerId) {
  const viewer = room.players.find(p => p.id === viewerId), team = viewer?.team;
  const canSee = u => team !== undefined && visible(room, team, u);
  return { room: room.code, phase: room.phase, hostId: room.hostId, players: room.players.map(p => ({ ...p })), time: round(room.time), tick: room.tick, winnerTeam: room.winnerTeam,
    heroes: room.heroes.filter(h => canSee(h)).map(heroSnapshot),
    minions: room.minions.map(m => ({ id: m.id, kind: m.kind, team: m.team, minionType: m.minionType, x: round(m.x), z: round(m.z), facing: round(m.facing), hp: round(m.hp), maxHp: round(m.maxHp), dead: m.dead, attackAnim: round(m.attackAnim) })),
    structures: room.structures.map(t => ({ id: t.id, kind: t.kind, team: t.team, x: t.x, z: t.z, hp: round(t.hp), maxHp: t.maxHp, dead: t.dead, invulnerable: t.invulnerable })),
    projectiles: room.projectiles.map(p => ({ id: p.id, kind: p.kind, team: p.team, ownerId: p.ownerId, x: round(p.x), z: round(p.z), dx: round(p.dx), dz: round(p.dz), radius: p.radius })),
    effects: room.effects.filter(e => !e.ownerId || !unit(room, e.ownerId) || canSee(unit(room, e.ownerId))).map(e => ({ id: e.id, type: e.type, team: e.team, x: round(e.x), z: round(e.z), toX: e.toX, toZ: e.toZ, radius: e.radius, ttl: round(e.ttl), maxTtl: e.maxTtl, ownerId: e.ownerId })),
    events: room.events.flatMap(e => {
      const hidden = [e.actorId, e.targetId].map(id => unit(room, id)).some(u => u?.kind === 'hero' && !canSee(u));
      if (!hidden) return [{ ...e }];
      if (['kill', 'tower', 'victory', 'start', 'wave'].includes(e.type)) return [{ id: e.id, type: e.type, text: e.text, team: e.team }];
      return [];
    }) };
}
