import { WALL, TARGET_BOUNDS, POSES, hitTarget, targetVisible } from './rules.js';

export const ROOM_TTL = 60 * 60 * 1000;
export const PLAYER_TIMEOUT = 120000;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const finite = v => typeof v === 'number' && Number.isFinite(v);
export const active = room => ['hiding', 'shooting', 'switching'].includes(room.phase);
export class GameError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new GameError(code, message, status); };
function randomFloat(min, max) {
  return min + crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * (max - min);
}
export function createPlayer(name, now = Date.now()) {
  return { id: crypto.randomUUID(), token: crypto.randomUUID() + crypto.randomUUID(), name: String(name || '匿名狙击手').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 12) || '匿名狙击手', wins: 0, shots: 0, bodyHits: 0, headshots: 0, lastSeen: now };
}
export function createRoom(code, player, now = Date.now()) {
  return { code, players: [player], hostId: player.id, phase: 'lobby', turn: 0, shooterId: null, hiderId: null, target: null, shotsLeft: 3, holes: [], nextHoleId: 1, deadline: 0, moveAt: now, lastShotAt: 0, winnerId: null, reason: null, events: [], eventSeq: 0, processed: [], createdAt: now };
}
function finish(room, winnerId, reason) {
  if (room.phase === 'finished') return;
  room.phase = 'finished'; room.winnerId = winnerId; room.reason = reason; room.deadline = 0;
  const winner = room.players.find(p => p.id === winnerId); if (winner) winner.wins++;
}
export function removePlayer(room, playerId) {
  const before = room.players.length;
  room.players = room.players.filter(p => p.id !== playerId);
  if (room.players.length === before) return false;
  if (room.hostId === playerId) room.hostId = room.players[0]?.id || null;
  if (active(room)) finish(room, room.players[0]?.id || null, 'opponent_left');
  return true;
}
export function resetLobby(room) {
  room.phase = 'lobby'; room.shooterId = null; room.hiderId = null; room.target = null;
  room.winnerId = null; room.reason = null; room.deadline = 0; room.events = [];
}
export function addPlayer(room, player) {
  if (room.players.length >= 2) fail('FULL', '这是双人对决，房间已满');
  if (active(room)) fail('PLAYING', '对决进行中');
  if (room.phase === 'finished') resetLobby(room);
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
}
function beginHiding(room, now, swap = false) {
  if (swap) { [room.shooterId, room.hiderId] = [room.hiderId, room.shooterId]; room.turn++; }
  room.phase = 'hiding'; room.shotsLeft = 3; room.reason = null;
  room.target = { x: randomFloat(-6.5, 6.5), y: randomFloat(1.8, 8.2), pose: 'stand' };
  room.deadline = now + 6000; room.moveAt = now; room.lastShotAt = 0;
}
function beginShooting(room, now) { room.phase = 'shooting'; room.deadline = now + 30000; room.moveAt = now; }
function beginSwitching(room, now, reason) { room.phase = 'switching'; room.reason = reason; room.deadline = now + 1500; }
export function advanceRoom(room, now = Date.now()) {
  let changed = false;
  for (const p of [...room.players]) if (now - p.lastSeen > PLAYER_TIMEOUT) changed = removePlayer(room, p.id) || changed;
  if (room.players.length !== 2) return changed;
  for (let i = 0; i < 12 && active(room) && now >= room.deadline; i++) {
    const at = room.deadline;
    if (room.phase === 'hiding') beginShooting(room, at);
    else if (room.phase === 'shooting') beginSwitching(room, at, 'timeout');
    else beginHiding(room, at, true);
    changed = true;
  }
  return changed;
}
export function snapshot(room, viewerId, now = Date.now(), revision = 0) {
  const role = room.shooterId === viewerId ? 'shooter' : room.hiderId === viewerId ? 'hider' : null;
  const visible = role === 'hider' || room.phase === 'switching' || !['hiding', 'lobby'].includes(room.phase) && targetVisible(room.target, room.holes);
  return {
    phase: room.phase, room: room.code, hostId: room.hostId, turn: room.turn,
    shooterId: room.shooterId, hiderId: room.hiderId, role, shotsLeft: room.shotsLeft,
    countdown: active(room) ? Math.max(0, (room.deadline - now) / 1000) : 0,
    deadline: room.deadline, serverTime: now, revision,
    holes: room.holes.map(h => ({ ...h })), target: room.target && visible && room.phase !== 'lobby' ? { ...room.target } : null,
    players: room.players.map(({ id, name, wins, headshots, bodyHits, shots }) => ({ id, name, wins, headshots, bodyHits, shots })),
    winnerId: room.winnerId, reason: room.reason,
  };
}
export function eventMessages(room, afterCursor = 0) {
  const cursor = finite(afterCursor) ? Math.max(0, afterCursor) : 0;
  return room.events.filter(e => e.seq > cursor).map(({ seq, message }) => ({ ...message, seq }));
}
function emit(room, message) {
  room.events.push({ seq: ++room.eventSeq, message }); room.events = room.events.slice(-64);
}
/** Mutates only an already-authenticated room document, so the store can CAS and retry. */
export function applyAction(room, playerId, action, now = Date.now()) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) fail('SESSION', '你已离开房间，请重新加入', 401);
  const type = action.type;
  if (!['poll', 'ping'].includes(type)) {
    if (typeof action.actionId !== 'string' || action.actionId.length < 8 || action.actionId.length > 100) fail('ACTION', '操作编号无效');
    const key = `${playerId}:${action.actionId}`;
    if (room.processed.includes(key)) return { changed: false, duplicate: true };
  }
  let changed = false;
  if (now - player.lastSeen > 10000) { player.lastSeen = now; changed = true; }
  if (type === 'poll' || type === 'ping') return { changed, messages: type === 'ping' ? [{ type: 'pong', at: finite(action.at) ? action.at : now }] : [] };
  if (type === 'start' || type === 'restart') {
    if (room.hostId !== playerId) fail('HOST', '等待房主开始对决');
    if (room.players.length !== 2) fail('PLAYERS', '需要两位玩家才能开始');
    if (type === 'start' ? room.phase !== 'lobby' : room.phase !== 'finished') fail('PHASE', '当前不能开始对决');
    room.turn = 1; room.shooterId = room.hostId; room.hiderId = room.players.find(p => p.id !== room.hostId).id;
    room.holes = []; room.nextHoleId = 1; room.winnerId = null; room.events = [];
    for (const p of room.players) { p.headshots = 0; p.bodyHits = 0; p.shots = 0; }
    beginHiding(room, now);
  } else if (type === 'ready') {
    if (room.phase !== 'hiding') fail('PHASE', '当前不能确认躲藏');
    if (room.hiderId !== playerId) fail('ROLE', '等待对手完成躲藏');
    beginShooting(room, now);
  } else if (type === 'move') {
    if (!['hiding', 'shooting'].includes(room.phase)) fail('PHASE', '当前不能移动');
    if (room.hiderId !== playerId) fail('ROLE', '只有躲藏者可以移动外星人');
    const x = action.x === undefined ? room.target.x : action.x, y = action.y === undefined ? room.target.y : action.y;
    if (!finite(x) || !finite(y) || action.pose !== undefined && !POSES.includes(action.pose)) fail('MOVE', '移动坐标或姿势无效');
    let nx = clamp(x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX), ny = clamp(y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY);
    if (room.phase === 'shooting') {
      const dx = nx - room.target.x, dy = ny - room.target.y, distance = Math.hypot(dx, dy), max = clamp((now - room.moveAt) / 1000, 0, .5) * 4;
      if (distance > max && distance > 0) { nx = room.target.x + dx / distance * max; ny = room.target.y + dy / distance * max; }
    }
    room.target = { x: nx, y: ny, pose: action.pose ?? room.target.pose }; room.moveAt = now;
  } else if (type === 'shoot') {
    if (room.phase !== 'shooting') fail('PHASE', '等待射击回合');
    if (room.shooterId !== playerId) fail('ROLE', '当前是对手的射击回合');
    if (now - room.lastShotAt < 700) fail('COOLDOWN', '拉栓中');
    const { x, y } = action;
    if (!finite(x) || !finite(y) || Math.abs(x) > WALL.width / 2 || y < 0 || y > WALL.height) fail('AIM', '请瞄准墙面');
    if (room.shotsLeft <= 0) fail('EMPTY', '本轮三发已经用完');
    room.shotsLeft--; room.lastShotAt = now; player.shots++;
    room.holes.push({ id: room.nextHoleId++, x, y });
    const result = hitTarget(room.target, x, y);
    if (result === 'head') player.headshots++;
    if (result === 'body') player.bodyHits++;
    emit(room, { type: 'shot', playerId, shotId: ['string', 'number'].includes(typeof action.shotId) ? action.shotId : null, x, y, result, shotsLeft: room.shotsLeft });
    if (result === 'head') finish(room, playerId, 'headshot');
    else if (result === 'body') beginSwitching(room, now, 'body');
    else if (!room.shotsLeft) beginSwitching(room, now, 'three_misses');
  } else if (type === 'leave') {
    removePlayer(room, playerId);
    return { changed: true, left: true, messages: [{ type: 'left' }] };
  } else fail('MESSAGE', '未知操作');
  player.lastSeen = now;
  room.processed.push(`${playerId}:${action.actionId}`); room.processed = room.processed.slice(-128);
  return { changed: true };
}
