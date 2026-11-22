import { MOVES, SIGNATURE_NORMALS } from './moves.mjs';
import { fighters, fighterIds, fighterName, portrait } from './roster.mjs';

const layouts = {
  p1: { attack:'J', jump:'W', skill:'K', side:'A / D', down:'S' },
  p2: { attack:'1', jump:'↑', skill:'2', side:'← / →', down:'↓' },
  touch: { attack:'击', jump:'跳', skill:'技', side:'◀ / ▶', down:'▼' }
};

function keycaps(keys, join) {
  return keys.map(key => '<kbd>' + key + '</kbd>').join('<span class="key-join">' + join + '</span>');
}

function moveRow(keys, join, name, description) {
  return '<div class="guide-row"><div class="motion">' + keycaps(keys, join) + '</div><div><b>' + name +
    '</b><p>' + description + '</p></div></div>';
}

export function showMoveGuide(container, initial, { seat = 0, onPractice } = {}) {
  let char = initial;
  let layout = seat === 1 ? 'p2' : matchMedia('(pointer: coarse)').matches ? 'touch' : 'p1';
  container.innerHTML = '<div class="guide-tools"><label>斗士<select id="guide-fighter">' +
    fighterIds.map(id => '<option value="' + id + '">' + fighterName(id) + '</option>').join('') +
    '</select></label><label>操作<select id="guide-seat"><option value="p1">玩家 1</option>' +
    '<option value="p2">玩家 2</option><option value="touch">触屏</option></select></label></div>' +
    '<div id="guide-entries" aria-live="polite"></div>' +
    (onPractice ? '<button class="primary guide-practice" id="try-moves">用这个角色练招　→</button>' : '');
  const fighterSelect = container.querySelector('#guide-fighter');
  const layoutSelect = container.querySelector('#guide-seat');
  const body = container.querySelector('#guide-entries');
  function paint() {
    const k = layouts[layout], kit = MOVES[char], signature = SIGNATURE_NORMALS[char];
    const normalInput = {
      jab: k.attack, follow: '普攻第二下', finisher:'普攻第三下',
      sweep: k.down + ' + ' + k.attack, air: '空中 ' + k.attack
    };
    body.innerHTML = '<div class="guide-profile"><img src="' + portrait(char) + '" alt=""><div><h3>' +
      fighterName(char) + '</h3><span>' + fighters[char].style + '</span></div></div>' +
      '<div class="guide-rows">' +
      moveRow([k.attack,k.attack,k.attack], '›', '地面三连', '连续点三下，第三下击飞。地面打中后可以起跳追击。') +
      moveRow([k.jump,k.attack,k.attack], '›', '空中两连', '先起跳，再点一下普攻打跳攻，落地前再点一下接第二招。') +
      moveRow([k.skill], '', kit.special.name, kit.special.desc) +
      moveRow([k.side,k.skill], '+', kit.qcf.name, kit.qcf.desc) +
      moveRow([k.down,k.skill], '+', kit.qcb.name, kit.qcb.desc) + '</div>' +
      '<div class="fighter-normal"><b>' + signature.name + '</b><kbd>' + normalInput[signature.key] +
      '</kbd><p>' + signature.desc + '</p></div>' +
      '<p class="guide-note">按左就面向左，按右就面向右。松手后保持朝向。按住下方向可正面格挡，同时点普攻可出扫击。</p>';
  }
  fighterSelect.value = char;
  layoutSelect.value = layout;
  fighterSelect.onchange = () => { char = fighterSelect.value; paint(); };
  layoutSelect.onchange = () => { layout = layoutSelect.value; paint(); };
  if (onPractice) container.querySelector('#try-moves').onclick = () => onPractice(char);
  paint();
}
