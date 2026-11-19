import { MOVES, SIGNATURE_NORMALS } from './moves.mjs';
import { fighters, fighterIds, fighterName, portrait } from './roster.mjs';

const directions = { right:['↘','→','↙','←'], left:['↙','←','↘','→'] };

export function showMoveGuide(container, initial, { facing = 1, seat = 0, onPractice } = {}) {
  let char = initial, side = facing < 0 ? 'left' : 'right';
  const arrows = list => list.map(key => '<kbd>'+key+'</kbd>').join('');
  function entries() {
    const attack=seat===1?'逗号':'J', skill=seat===1?'句号':'K';
    const [df,f,db,b] = directions[side];
    const kit = MOVES[char], normal=SIGNATURE_NORMALS[char];
    const input={jab:attack,follow:attack+' → '+attack,heavy:f+' + '+attack,sweep:'↓ + '+attack,air:'空中 '+attack}[normal.key];
    const rows = [
      { motion:[skill], move:kit.special },
      { motion:['↓',df,f,'+',attack], move:kit.qcf },
      { motion:['↓',db,b,'+',skill], move:kit.qcb }
    ];
    const key = side==='right' ? (seat===1?'↓、↓+→、→':'S、S+D、D') : (seat===1?'↓、↓+←、←':'S、S+A、A');
    return '<div class="guide-profile"><img src="'+portrait(char)+'" alt=""><div><h3>'+fighterName(char)+'</h3><span>'+fighters[char].style+'</span></div></div>'+
      '<div class="guide-rows">'+rows.map(({motion,move})=>'<div class="guide-row"><div class="motion">'+arrows(motion)+'</div><div><b>'+move.name+'</b><p>'+move.desc+'</p></div></div>').join('')+'</div>'+
      '<div class="fighter-normal"><b>'+normal.name+'</b><kbd>'+input+'</kbd><p>'+normal.desc+'</p></div>'+
      '<p class="guide-note">键盘搓「下前」依次按 '+key+'，在最后一个方向按 '+attack+'。指令按起手朝向判定。触屏用左拇指从下方沿圆弧滑动，右手点「击」或「技」。同机 P2 的攻／技对应逗号／句号。</p>'+
      '<div class="guide-basics"><b>通用动作</b><p>'+attack+' 轻击，前＋'+attack+' 重击，下＋'+attack+' 扫击；空中按 '+attack+' 可使出空中攻击。轻击命中后再点 '+attack+' 接连段，或接方向必杀。地面按住后方向站防跳入，按住斜下后蹲防扫击。</p></div>';
  }
  container.innerHTML='<div class="guide-tools"><label>查看斗士<select id="guide-fighter">'+fighterIds.map(id=>'<option value="'+id+'">'+fighterName(id)+'</option>').join('')+'</select></label><label>键位<select id="guide-seat"><option value="0">P1</option><option value="1">P2</option></select></label><label>角色朝向<select id="guide-facing"><option value="right">面向右 →</option><option value="left">面向左 ←</option></select></label></div><div id="guide-entries" aria-live="polite"></div>'+
    (onPractice?'<button class="primary guide-practice" id="try-moves">用这个角色练招　→</button>':'');
  const fighterSelect=container.querySelector('#guide-fighter'), facingSelect=container.querySelector('#guide-facing'), body=container.querySelector('#guide-entries');
  fighterSelect.value=char;facingSelect.value=side;body.innerHTML=entries();
  fighterSelect.onchange=()=>{char=fighterSelect.value;body.innerHTML=entries();};
  const seatSelect=container.querySelector('#guide-seat');seatSelect.value=String(seat);
  seatSelect.onchange=()=>{seat=Number(seatSelect.value);body.innerHTML=entries();};
  facingSelect.onchange=()=>{side=facingSelect.value;body.innerHTML=entries();};
  if(onPractice)container.querySelector('#try-moves').onclick=()=>onPractice(char);
}
