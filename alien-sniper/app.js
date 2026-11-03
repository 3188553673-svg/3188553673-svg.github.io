import { P2PTransport } from './p2p-transport.js';
import { DuelScene } from './scene.js';
import { WALL, TARGET_BOUNDS } from './rules.js';

const $ = id => document.getElementById(id);
const hide = (id, yes = true) => $(id).classList.toggle('hidden', yes);
const text = (id, value) => { const node = $(id); if (node.textContent !== String(value)) node.textContent = value; };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let savedName = '', muted = false;
try { savedName = localStorage.getItem('duel.name') || ''; muted = localStorage.getItem('duel.muted') === '1'; } catch {}
$('callsign').value = savedName || `狙击手${Math.floor(Math.random() * 90 + 10)}`;
$('invite-name').value = $('callsign').value;
const scene = new DuelScene($('world'));
if (!scene.available) { hide('graphics-error', false); text('graphics-detail', scene.error?.message || 'WebGL 初始化失败'); }

let ws = null, id = null, state = null, connectTimer = null, connectPending = null;
let shareURL = '', scoped = false, aim = { x: 0, y: 5 }, aimValid = true;
let localTarget = null, sentMoveAt = 0, lastShotAt = 0, receivedAt = 0;
let toastTimer, bannerTimer, feedbackTimer, lastPhase = '', lastTurn = 0, lastResultKey = '';
let pointerDown = false, pointerStart = null, pointerLast = null, pointerMoved = false, pointerId = null;
let soundContext = null, soundBus = null, audioReady = false;
let lastUiKey = '', lastLobbyKey = '', lastHoles = 0, fps = 60;
const keys = new Set();
const diagnostics = { frames: 0, fps: 0, errors: [], connected: false };
window.addEventListener('error', e => diagnostics.errors.push(e.message));
window.addEventListener('unhandledrejection', e => diagnostics.errors.push(String(e.reason)));
window.__duel = { get state() { return state; }, get id() { return id; }, scene, diagnostics, get aim() { return { ...aim }; } };

function toast(message) {
  text('toast', message); $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}
function openDialog(name) { if (!$(name).open) $(name).showModal(); }
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); keys.clear(); pointerDown = false; }
function anyDialog() { return Boolean(document.querySelector('dialog[open]')); }
function audioInit() {
  if (!soundContext) {
    try { soundContext = new (window.AudioContext || window.webkitAudioContext)(); soundBus = soundContext.createGain(); soundBus.gain.value = muted ? 0 : 0.18; soundBus.connect(soundContext.destination); } catch { return; }
  }
  soundContext.resume().catch(() => {}); audioReady = true;
}
function tone(frequency, duration = .12, type = 'sine', volume = .5, end = frequency) {
  if (!audioReady || muted || !soundContext) return;
  const now = soundContext.currentTime, osc = soundContext.createOscillator(), gain = soundContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(frequency, now); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  osc.connect(gain); gain.connect(soundBus); osc.start(now); osc.stop(now + duration);
}
function shotSound() {
  tone(100, .22, 'triangle', .9, 29);
  if (!audioReady || muted || !soundContext) return;
  const samples = Math.floor(soundContext.sampleRate * .13), buffer = soundContext.createBuffer(1, samples, soundContext.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples, 3);
  const source = soundContext.createBufferSource(), gain = soundContext.createGain(); source.buffer = buffer; gain.gain.value = .7; source.connect(gain); gain.connect(soundBus); source.start();
}
function setScope(value) {
  const nextScope = Boolean(value && state?.role === 'shooter' && state?.phase === 'shooting');
  if (nextScope !== scoped) pointerLast = null;
  scoped = nextScope;
  scene.setAimPoint(aim.x, aim.y); scene.setScoped(scoped);
  hide('scope', !scoped); $('hud').classList.toggle('scoped', scoped); $('scope-btn').classList.toggle('active', scoped);
  $('scope-btn').querySelector('span').textContent = scoped ? '收镜' : '开镜';
  if (scoped) tone(220, .06, 'sine', .15, 330);
}
function banner(small, title, detail, duration = 1600) {
  text('banner-small', small); text('banner-title', title); text('banner-detail', detail); hide('wave-banner', false);
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => hide('wave-banner'), duration);
}
function send(message) { if (ws?.readyState === P2PTransport.OPEN) { ws.send(JSON.stringify(message)); return true; } return false; }

async function joinRoom(room = '') {
  if (!scene.available) return toast('请先使用支持 3D 图形的浏览器');
  if (connectPending) return;
  const name = $('callsign').value.trim().slice(0, 12) || `狙击手${Math.floor(Math.random() * 100)}`;
  $('callsign').value = name;
  try { localStorage.setItem('duel.name', name); } catch {}
  audioInit(); $('create-btn').disabled = true; $('join-btn').disabled = true;
  text('network-status', '正在连接房间…');
  const socket = new P2PTransport();
  ws = socket; connectPending = socket;
  connectTimer = setTimeout(() => { if (connectPending === socket) { toast('连接超时，请检查网络后重试'); socket.close(); } }, 30000);
  socket.addEventListener('open', () => { if (ws === socket) send({ type: 'join', name, ...(room ? { room } : { create: true }) }); });
  socket.addEventListener('message', event => {
    if (ws !== socket) return;
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'welcome') {
      clearTimeout(connectTimer); connectPending = null; id = message.id;
      $('create-btn').disabled = false; $('join-btn').disabled = false;
      diagnostics.connected = true; closeDialogs();
      text('room-code', message.room); text('network-status', `房间 ${message.room} · 已连接`);
      updateShareURL(message.room); tone(440, .15, 'sine', .2, 660);
    } else if (message.type === 'state') receiveState(message.state);
    else if (message.type === 'shot') receiveShot(message);
    else if (message.type === 'pong') text('latency', `在线 · ${Math.max(0, Date.now() - message.at)} ms`);
    else if (message.type === 'error') {
      if (message.code !== 'COOLDOWN') toast(message.message || '操作未完成');
      if (connectPending === socket) {
        clearTimeout(connectTimer); connectPending = null; $('create-btn').disabled = false; $('join-btn').disabled = false; text('network-status', '在线 · 双人对决');
        ws = null; socket.close();
      }
    }
  });
  socket.addEventListener('close', event => {
    if (ws !== socket) return;
    clearTimeout(connectTimer); ws = null; connectPending = null; diagnostics.connected = false;
    $('create-btn').disabled = false; $('join-btn').disabled = false;
    const wasInRoom = Boolean(state); returnToEntry(false); toast(event.reason || (wasInRoom ? '连接已中断，请检查网络后重新加入' : '暂时无法连接，请检查网络后重试'));
  });
  socket.addEventListener('error', () => {});
}
function returnToEntry(disconnect = true) {
  closeDialogs(); setScope(false); const old = ws;
  if (disconnect) { send({ type: 'leave' }); ws = null; old?.close(); }
  state = null; id = null; lastPhase = ''; lastTurn = 0; lastResultKey = ''; lastLobbyKey = ''; lastHoles = 0; lastUiKey = ''; localTarget = null;
  keys.clear(); pointerDown = false; diagnostics.connected = false;
  hide('entry', false); hide('lobby'); hide('hud'); hide('wave-banner'); document.body.classList.remove('playing', 'hider');
  text('network-status', '在线 · 双人对决'); scene.update(null, 0);
}
function receiveState(next) {
  const previous = state; state = next; receivedAt = performance.now();
  if (previous?.phase === 'finished' && next.phase !== 'finished') lastResultKey = '';
  const active = next.phase !== 'lobby';
  hide('entry'); hide('lobby', active); hide('hud', !active);
  document.body.classList.toggle('playing', active); document.body.classList.toggle('hider', active && next.role === 'hider');
  if (next.role !== 'shooter' || next.phase !== 'shooting') setScope(false);
  if (next.role === 'hider' && next.target && (!localTarget || next.turn !== lastTurn || previous?.role !== 'hider')) localTarget = { ...next.target };
  if (next.role !== 'hider') localTarget = null;
  if (next.phase === 'lobby') { if (previous?.phase !== 'lobby') closeDialogs(); updateLobby(); }
  else {
    if (next.phase !== 'finished' && $('result-dialog').open) $('result-dialog').close();
    if (lastPhase !== next.phase || lastTurn !== next.turn) {
      keys.clear(); pointerDown = false;
      if (next.phase === 'hiding') banner(`第 ${next.turn} 回合`, next.role === 'hider' ? '藏好，别露出破绽。' : '对手正在墙后躲藏。', next.role === 'hider' ? '调整位置和姿势，准备迎接三发试探。' : '准备开镜，观察已经留下的弹孔。', 1700);
      if (next.phase === 'shooting') { banner('三发机会', next.role === 'shooter' ? '现在，轮到你狙击。' : '小心，狙击开始了。', next.role === 'shooter' ? '击中身体换边，击中头部获胜。' : '可以继续移动，远离墙上的弹孔。', 1200); tone(600, .12, 'sine', .2, 400); }
      if (next.phase === 'switching') banner('身份交换', next.reason === 'body' ? '命中身体，双方换边。' : next.reason === 'timeout' ? '时间到，双方换边。' : '三发结束，双方换边。', '弹孔会保留，下一轮更加危险。', 1300);
    }
    updateHUD();
    if (next.phase === 'finished') showResult();
  }
  lastPhase = next.phase; lastTurn = next.turn; lastHoles = next.holes.length;
}
function updateLobby() {
  if (!state) return;
  const key = JSON.stringify([state.players, state.hostId]); if (key === lastLobbyKey) return; lastLobbyKey = key;
  text('room-size', `${state.players.length} / 2`); text('room-code', state.room);
  $('lobby-players').innerHTML = state.players.map((p, i) => `<div class="player-row"><span class="player-avatar">0${i + 1}</span><span>${escape(p.name)}${p.id === id ? ' <small>（你）</small>' : ''}</span><em>${p.id === state.hostId ? '房主' : '已就位'}</em></div>`).join('') + (state.players.length < 2 ? '<div class="player-row empty"><span class="player-avatar">＋</span><span>等待朋友加入…</span></div>' : '');
  const host = state.hostId === id; $('start-btn').disabled = !host || state.players.length !== 2;
  text('start-btn', state.players.length < 2 ? '等待对手加入 →' : host ? '开始对决 →' : '等待房主开始 →');
}
function updateHUD() {
  if (!state) return;
  const me = state.players.find(p => p.id === id), other = state.players.find(p => p.id !== id);
  const shooter = state.role === 'shooter', mobile = matchMedia('(pointer:coarse)').matches;
  text('self-name', me?.name || '你'); text('opponent-name', other?.name || '已离线');
  text('self-role', shooter ? '狙击方 / SHOOTER' : '躲藏方 / HIDER'); text('self-icon', shooter ? '⌖' : '◇');
  text('turn-number', `ROUND ${String(state.turn).padStart(2, '0')}`);
  text('phase-label', ({ hiding: '躲藏准备', shooting: '狙击进行中', switching: '交换身份', finished: '对决结束' })[state.phase] || '等待开始');
  text('role-tag', shooter ? '狙击方' : '躲藏方 · 透明战术视图');
  text('role-description', shooter ? state.phase === 'hiding' ? '对手正在躲藏。弹孔会暴露他的行踪。' : '透过弹孔找破绽，只有三发机会。' : '拖动或按方向键移动，1 / 2 / 3 切换姿势。');
  text('scoreline', `${me?.wins || 0} : ${other?.wins || 0}`); text('room-label', `房间 ${state.room}`);
  hide('shooter-controls', !shooter); hide('hider-controls', shooter); hide('touch-movement', shooter || !mobile || state.phase === 'switching' || state.phase === 'finished');
  $('ready-btn').disabled = state.phase !== 'hiding'; hide('ready-btn', state.phase !== 'hiding');
  $('fire-btn').disabled = !shooter || state.phase !== 'shooting'; $('scope-btn').disabled = !shooter || state.phase !== 'shooting';
  $('ammo-rounds').querySelectorAll('i').forEach((node, i) => node.classList.toggle('used', i >= state.shotsLeft));
  document.querySelectorAll('[data-pose]').forEach(node => { node.classList.toggle('active', node.dataset.pose === state.target?.pose); node.disabled = !['hiding', 'shooting'].includes(state.phase); });
  hide('crosshair', !shooter || state.phase !== 'shooting');
  text('controls-hint', shooter ? mobile ? '拖动瞄准 · 点右下角射击 · 点击开镜' : '移动鼠标瞄准 · 左键射击 · 右键 / 空格开镜' : mobile ? '拖动外星人或使用方向按钮躲藏' : 'WASD / 方向键移动 · 1 / 2 / 3 切换姿势');
}
function showResult() {
  const resultKey = `${state.turn}:${state.winnerId}:${state.reason}`;
  const me = state.players.find(p => p.id === id), other = state.players.find(p => p.id !== id), won = state.winnerId === id;
  if (resultKey !== lastResultKey) {
    lastResultKey = resultKey; closeDialogs(); setScope(false); hide('wave-banner');
    text('result-eyebrow', won ? 'HEADSHOT / VICTORY' : 'MATCH COMPLETE');
    text('result-title', won ? '这一局，你赢了。' : '这次，被你找到了。');
    text('result-description', state.reason === 'opponent_left' ? '对手已离开房间，本局判你获胜。' : won ? '精准命中头部，对决结束。' : '对手命中你的头部，换个位置再来。');
    $('result-stats').innerHTML = `<div><b>${String(state.turn).padStart(2, '0')}</b><span>交锋回合</span></div><div><b>${me?.shots || 0}</b><span>你的射击</span></div><div><b>${state.holes.length}</b><span>留下的弹孔</span></div>`;
    openDialog('result-dialog'); tone(won ? 660 : 180, .35, 'sine', .3, won ? 880 : 120);
  }
  $('result-team').innerHTML = [me, other].filter(Boolean).map(p => `<div><span>${escape(p.name)}${p.id === id ? '（你）' : ''}</span><span>${p.wins} 胜</span></div>`).join('');
  $('restart-btn').disabled = state.hostId !== id || state.players.length !== 2;
  text('restart-btn', state.players.length < 2 ? '等待朋友重新加入' : state.hostId === id ? '再来一局 ↗' : '等待房主再来一局');
}
function receiveShot(event) {
  scene.shot(event); shotSound();
  const own = event.playerId === id;
  const result = event.result;
  text('shot-feedback', result === 'head' ? own ? '爆头！' : '头部命中' : result === 'body' ? '命中身体 · 即将换边' : own ? '未命中 · 弹孔已留下' : '对手开枪了');
  $('shot-feedback').classList.add('show'); $('shot-feedback').classList.toggle('headshot', result === 'head');
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(() => $('shot-feedback').classList.remove('show'), 1300);
  if (result !== 'miss') {
    const marker = $('hitmarker'), position = scene.projectWall(event.x, event.y);
    marker.style.left = `${scoped ? innerWidth / 2 : position.x}px`; marker.style.top = `${scoped ? innerHeight / 2 : position.y}px`;
    marker.classList.add('show'); marker.classList.toggle('headshot', result === 'head'); setTimeout(() => marker.classList.remove('show'), 250);
    tone(result === 'head' ? 1050 : 560, .12, 'sine', .35, 360);
    if (!own) { $('damage-flash').classList.add('show'); setTimeout(() => $('damage-flash').classList.remove('show'), 350); }
  }
}
function fire() {
  if (!state || state.role !== 'shooter' || state.phase !== 'shooting' || anyDialog()) return;
  if (performance.now() - lastShotAt < 720) return;
  if (!aimValid) return toast('请将准星移到墙面上');
  audioInit(); lastShotAt = performance.now();
  send({ type: 'shoot', x: aim.x, y: aim.y, shotId: `${id}-${Date.now()}` });
}
function moveTarget(x, y, pose) {
  if (!localTarget || !state || state.role !== 'hider' || !['hiding', 'shooting'].includes(state.phase)) return;
  localTarget.x = clamp(x, TARGET_BOUNDS.minX, TARGET_BOUNDS.maxX);
  localTarget.y = clamp(y, TARGET_BOUNDS.minY, TARGET_BOUNDS.maxY);
  if (pose) localTarget.pose = pose;
}
function setPose(pose) {
  if (!localTarget) return; localTarget.pose = pose;
  send({ type: 'move', ...localTarget }); tone(330, .05, 'sine', .1, 440);
}
function pointFromEvent(event, relative = false) {
  if (relative && !pointerLast) { pointerLast = { x: event.clientX, y: event.clientY }; return; }
  if (relative) {
    const scale = Math.max(18 / innerWidth, 10 / innerHeight) * .4;
    aim.x = clamp(aim.x + (event.clientX - pointerLast.x) * scale, -WALL.width / 2, WALL.width / 2);
    aim.y = clamp(aim.y - (event.clientY - pointerLast.y) * scale, 0, WALL.height); aimValid = true;
  } else {
    const point = scene.pointerToWall(event.clientX, event.clientY);
    aimValid = Boolean(point && Math.abs(point.x) <= WALL.width / 2 && point.y >= 0 && point.y <= WALL.height);
    if (aimValid) aim = { x: point.x, y: point.y };
  }
  scene.setAimPoint(aim.x, aim.y); pointerLast = { x: event.clientX, y: event.clientY };
}

$('entry-form').addEventListener('submit', e => { e.preventDefault(); joinRoom(); });
$('join-open-btn').addEventListener('click', () => { audioInit(); $('invite-name').value = $('callsign').value; openDialog('join-dialog'); $('join-code').focus(); });
$('join-form').addEventListener('submit', e => { e.preventDefault(); $('callsign').value = $('invite-name').value.trim() || $('callsign').value; joinRoom($('join-code').value); });
$('join-code').addEventListener('input', () => { $('join-code').value = $('join-code').value.replace(/\D/g, '').slice(0, 4); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d && !['result-dialog', 'pause-dialog'].includes(d.id)) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
$('help-btn').addEventListener('click', () => openDialog('help-dialog'));
$('sound-btn').addEventListener('click', () => { audioInit(); muted = !muted; if (soundBus) soundBus.gain.value = muted ? 0 : .18; try { localStorage.setItem('duel.muted', muted ? '1' : '0'); } catch {} updateSoundLabel(); });
function updateSoundLabel() { text('sound-btn', muted ? '声音 关' : '声音 开'); }
updateSoundLabel();
$('start-btn').addEventListener('click', () => { audioInit(); send({ type: 'start' }); });
$('restart-btn').addEventListener('click', () => { audioInit(); send({ type: 'restart' }); });
$('ready-btn').addEventListener('click', () => { if (localTarget) send({ type: 'move', ...localTarget }); send({ type: 'ready' }); });
['leave-btn', 'exit-btn', 'result-exit-btn'].forEach(name => $(name).addEventListener('click', () => returnToEntry()));
$('resume-btn').addEventListener('click', () => $('pause-dialog').close());
$('menu-btn').addEventListener('click', () => { keys.clear(); openDialog('pause-dialog'); });
$('scope-btn').addEventListener('click', () => setScope(!scoped));
$('fire-btn').addEventListener('click', fire);
document.querySelectorAll('[data-pose]').forEach(b => b.addEventListener('click', () => setPose(b.dataset.pose)));
document.querySelectorAll('[data-move]').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(b.dataset.move); b.setPointerCapture(e.pointerId); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => keys.delete(b.dataset.move));
});
$('copy-link-btn').addEventListener('click', async () => {
  const value = `${shareURL}  房间码：${state?.room || ''}`;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(value);
    else { const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); const copied = document.execCommand('copy'); input.remove(); if (!copied) throw new Error('copy'); }
    toast('邀请链接和房间码已复制');
  } catch { toast('复制不可用，请手动选取上方地址'); }
});
function updateShareURL(room = state?.room) {
  const url = new URL(location.href);
  url.search = ''; url.hash = '';
  if (room) url.searchParams.set('room', room);
  shareURL = url.href;
  text('lan-url', shareURL);
  text('lan-hint', '把链接发给朋友，双方联网即可，无需处在同一个 Wi-Fi。');
}
updateShareURL();
const invitationCode = new URL(location.href).searchParams.get('room');
if (invitationCode && /^\d{4}$/.test(invitationCode)) {
  $('join-code').value = invitationCode;
  openDialog('join-dialog');
}
setInterval(() => send({ type: 'ping', at: Date.now() }), 10000);

const canvas = $('world');
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (!anyDialog()) setScope(!scoped); });
canvas.addEventListener('pointerdown', e => {
  if (!state || anyDialog() || e.button !== 0) return;
  audioInit(); pointerDown = true; pointerId = e.pointerId; pointerMoved = false; pointerStart = { x: e.clientX, y: e.clientY }; pointerLast = pointerStart;
  canvas.setPointerCapture(e.pointerId);
  if (state.role === 'shooter' && !scoped) pointFromEvent(e);
  if (state.role === 'hider') { const point = scene.pointerToWall(e.clientX, e.clientY); if (point) moveTarget(point.x, point.y); }
});
canvas.addEventListener('pointermove', e => {
  if (!state || anyDialog() || ['switching', 'finished'].includes(state.phase)) return;
  if (pointerStart && pointerDown && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 7) pointerMoved = true;
  if (state.role === 'hider') { if (pointerDown) { const point = scene.pointerToWall(e.clientX, e.clientY); if (point) moveTarget(point.x, point.y); } }
  else if (state.phase === 'shooting' && (e.pointerType === 'mouse' || pointerDown)) pointFromEvent(e, scoped);
});
canvas.addEventListener('pointerup', e => {
  if (e.pointerId !== pointerId) return;
  if (state?.role === 'shooter' && !pointerMoved && e.pointerType === 'mouse') fire();
  pointerDown = false; pointerStart = null; pointerId = null;
});
canvas.addEventListener('pointercancel', () => { pointerDown = false; pointerStart = null; pointerId = null; });
window.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Escape') { keys.clear(); if (state && state.phase !== 'lobby' && !anyDialog()) { e.preventDefault(); openDialog('pause-dialog'); } return; }
  if (anyDialog() || !state) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat) setScope(!scoped);
  if (e.code === 'Enter' && state.role === 'hider' && state.phase === 'hiding') $('ready-btn').click();
  const poses = { Digit1: 'stand', Digit2: 'crouch', Digit3: 'lean' }; if (poses[e.code] && !e.repeat) setPose(poses[e.code]);
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); pointerDown = false; pointerLast = null; });
window.addEventListener('resize', () => scene.resize());
window.addEventListener('pagehide', () => ws?.close());

let previousFrame = performance.now(), fpsFrames = 0, fpsAt = previousFrame;
function frame(now) {
  const dt = Math.min(.05, (now - previousFrame) / 1000); previousFrame = now;
  diagnostics.frames++; fpsFrames++;
  if (now - fpsAt >= 1000) { fps = Math.round(fpsFrames * 1000 / (now - fpsAt)); diagnostics.fps = fps; fpsFrames = 0; fpsAt = now; }
  if (state && state.phase !== 'lobby') {
    const seconds = Math.max(0, Math.ceil(state.countdown - (now - receivedAt) / 1000)); text('countdown', String(seconds).padStart(2, '0')); $('countdown').parentElement.classList.toggle('urgent', seconds <= 5 && state.phase === 'shooting');
    if (state.role === 'hider' && localTarget && ['hiding', 'shooting'].includes(state.phase) && !anyDialog()) {
      let x = Number(keys.has('KeyD') || keys.has('ArrowRight') || keys.has('right')) - Number(keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('left'));
      let y = Number(keys.has('KeyW') || keys.has('ArrowUp') || keys.has('up')) - Number(keys.has('KeyS') || keys.has('ArrowDown') || keys.has('down'));
      const length = Math.hypot(x, y); if (length) moveTarget(localTarget.x + x / length * 4 * dt, localTarget.y + y / length * 4 * dt);
      if (now - sentMoveAt >= 45) {
        const key = `${localTarget.x.toFixed(3)},${localTarget.y.toFixed(3)},${localTarget.pose}`;
        const catchingUp = state.target && Math.hypot(state.target.x - localTarget.x, state.target.y - localTarget.y) > .035;
        if (key !== lastUiKey || catchingUp) { send({ type: 'move', ...localTarget }); sentMoveAt = now; lastUiKey = key; }
      }
    }
  }
  scene.update(state?.phase === 'lobby' ? null : state, dt); scene.render(dt);
  if (state?.role === 'shooter' && state.phase === 'shooting' && !scoped) {
    const point = scene.projectWall(aim.x, aim.y); $('crosshair').style.left = `${point.x}px`; $('crosshair').style.top = `${point.y}px`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
