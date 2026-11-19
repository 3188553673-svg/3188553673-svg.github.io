import { HEROES, WEAPONS } from './sim.mjs';

const $ = id => document.getElementById(id);
const roomSymbols = { start: '起', entrance: '起', shop: '店', treasure: '宝', chest: '宝', reward: '宝', boss: '王', elite: '精', combat: '战', battle: '战' };
let lastVitals = '', lastMap = '', lastTalent = '';
const queued = new Map();

export function resetDungeonHud() {
  lastVitals = lastMap = lastTalent = '';
  queued.clear();
  $('talent-panel').hidden = true;
  $('interaction').textContent = '';
}

export function talentInput(id, state) {
  if (state.phase === 'talent' && queued.has(id)) return queued.get(id);
  return -1;
}

export function setTalentByKey(index) {
  const button = $('talent-panel').querySelector('[data-index="' + index + '"]');
  if (button && !button.disabled && !$('talent-panel').hidden) button.click();
}

function drawMap(s) {
  const map = $('minimap');
  if (map.hidden || !s.dungeon?.rooms?.length) return;
  const rooms = s.dungeon.rooms;
  const signature = [s.floor, s.roomId, ...rooms.map(r => r.id + ':' + Number(r.visited) + Number(r.cleared))].join('|');
  if (lastMap === signature) return;
  lastMap = signature;
  const ctx = map.getContext('2d');
  const { width: w, height: h } = map;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#171323'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#88738e'; ctx.strokeRect(1, 1, w - 2, h - 2);
  const known = new Set();
  for (const room of rooms) {
    if (!room.visited && room.id !== s.roomId) continue;
    known.add(room.id);
    for (const id of Object.values(room.links || {})) known.add(id);
  }
  const visible = rooms.filter(r => known.has(r.id));
  if (!visible.length) return;
  const xs = visible.map(r => r.gx), ys = visible.map(r => r.gy);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const scale = Math.min(22, (w - 24) / Math.max(xmax - xmin, 1), (h - 22) / Math.max(ymax - ymin, 1));
  const point = r => [Math.round(w / 2 + (r.gx - (xmin + xmax) / 2) * scale), Math.round(h / 2 + (r.gy - (ymin + ymax) / 2) * scale)];
  const nodes = new Map(visible.map(r => [r.id, r]));
  ctx.lineWidth = 2; ctx.strokeStyle = '#8d7e93';
  for (const r of visible) {
    if (!r.visited && r.id !== s.roomId) continue;
    const [x, y] = point(r);
    for (const id of Object.values(r.links || {})) {
      if (!nodes.has(id)) continue;
      const [nx, ny] = point(nodes.get(id));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
    }
  }
  for (const r of visible) {
    const [x, y] = point(r);
    const current = r.id === s.roomId;
    const mark = roomSymbols[r.type] || '';
    ctx.fillStyle = current ? '#ffd44c' : r.cleared ? '#5abb9f' : '#66516c';
    ctx.fillRect(x - 7, y - 6, 14, 12);
    ctx.fillStyle = current ? '#342030' : '#fff1e6';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(current ? '◆' : mark, x, y);
  }
}

function meter(label, kind, value, max) {
  const percent = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
  return '<span class="meter ' + kind + '" title="' + label + ' ' + value + '/' + max + '"><b style="width:' + percent + '%"></b></span>';
}

function renderVitals(s) {
  const key = s.players.map(p => [p.id, p.hero, p.hp, p.shield, p.energy, p.coins, p.down, p.disconnected, p.weapon, Math.ceil(p.skillCd / 60)].join('|')).join('/');
  if (key === lastVitals) return;
  lastVitals = key;
  $('vitals').innerHTML = s.players.map((p, i) => {
    const bars = meter('生命', 'hp', p.hp, p.maxHp) + meter('护盾', 'shield', p.shield, p.maxShield) + meter('能量', 'energy', p.energy, p.maxEnergy);
    const status = p.disconnected ? '已离开' : p.down ? '待援' : WEAPONS[p.weapon];
    const cooldown = Math.ceil(p.skillCd / 60);
    const resources = '♥ ' + p.hp + '　盾 ' + p.shield + '　蓝 ' + p.energy + '　币 ' + p.coins;
    const stats = '<span class="stat-numbers"><i>♥ ' + p.hp + '</i><i>盾 ' + p.shield + '</i><i>蓝 ' + p.energy + '</i></span>';
    return '<div class="vital-v2" title="' + resources + '"><strong>P' + (i + 1) + ' ' + HEROES[p.hero].name + '</strong>' + stats + '<span class="bars">' + bars + '</span><span class="weapon-name">' + status + '</span><small>币 ' + p.coins + ' · ' + (cooldown ? cooldown + 's' : '技就绪') + '</small></div>';
  }).join('');
}

function renderTalents(s, localIds) {
  const panel = $('talent-panel');
  if (s.phase !== 'talent' || !s.reward) {
    if (!panel.hidden) {
      panel.hidden = true;
      queued.clear();
      lastTalent = '';
    }
    return;
  }
  const { options, choices } = s.reward;
  const player = s.players.find(p => localIds.includes(p.id) && !p.disconnected && choices[p.id] == null && !queued.has(p.id));
  const key = [s.floor, player?.id || '', ...Object.entries(choices).flat(), ...queued.keys(), ...options.map(o => o.id)].join('|');
  if (lastTalent === key) return;
  lastTalent = key;
  panel.hidden = false;
  panel.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = player ? '选择本局天赋' : '等待队友选择';
  const info = document.createElement('p');
  info.textContent = player ? HEROES[player.hero].name + ' · 三选一，持续到本局结束' : '全队选择后前往下一层';
  panel.append(title, info);
  if (!player) return;
  const list = document.createElement('div');
  list.className = 'talents';
  options.forEach((option, index) => {
    const button = document.createElement('button');
    button.dataset.index = index;
    const name = document.createElement('b'), detail = document.createElement('small');
    name.textContent = option.name; detail.textContent = option.detail;
    button.append(name, detail);
    button.onclick = () => {
      queued.set(player.id, index);
      lastTalent = '';
      renderTalents(s, localIds);
    };
    list.append(button);
  });
  panel.append(list);
}

export function renderDungeonHud(s, localIds) {
  drawMap(s);
  renderVitals(s);
  renderTalents(s, localIds);
  const hints = s.players.filter(p => localIds.includes(p.id) && !p.down && p.interactHint);
  const hint = hints.map(p => (hints.length > 1 ? HEROES[p.hero].name + ' · ' : '') + p.interactHint).join('　');
  if ($('interaction').textContent !== hint) $('interaction').textContent = hint;
}

$('map-toggle').onclick = () => {
  const map = $('minimap');
  map.hidden = !map.hidden;
  $('map-toggle').setAttribute('aria-pressed', String(!map.hidden));
  lastMap = '';
};
