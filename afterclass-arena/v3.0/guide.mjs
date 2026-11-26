import { MOVES, BASIC_COMBOS, ASSIST_PARTNERS, ASSIST_MOVES } from './moves.mjs';
import { fighters, fighterIds, fighterName, portrait } from './roster.mjs';

const keys={
  p1:{W:'W',S:'S',J:'J',K:'K',L:'L',U:'U',I:'I',O:'O'},
  p2:{W:'↑',S:'↓',J:'1',K:'2',L:'3',U:'4',I:'5',O:'6'},
  touch:{W:'上',S:'防',J:'击',K:'跳',L:'冲',U:'远',I:'必',O:'援'}
};
function parts(step,layout) {
  return step.split('+').map(key=>keys[layout][key.trim()]??key.trim());
}
export function formatCommand(steps,layout) {
  return steps.map(step=>parts(step,layout).join(' + ')).join(' › ');
}
function row(steps,layout,name,detail) {
  const motion=steps.map(step=>parts(step,layout).map(key=>'<kbd>'+key+'</kbd>').join('<span>+</span>')).join('<span>›</span>');
  return '<div class="guide-row"><div class="motion">'+motion+'</div><div><b>'+name+'</b><p>'+detail+'</p></div></div>';
}

export function showMoveGuide(container,initial,{seat=0,support,onPractice}={}) {
  let char=initial;
  let layout=seat===1?'p2':matchMedia('(pointer: coarse)').matches?'touch':'p1';
  container.innerHTML='<div class="guide-tools"><label>斗士<select id="guide-fighter">'+fighterIds.map(id=>'<option value="'+id+'">'+fighterName(id)+'</option>').join('')+
    '</select></label><label>操作<select id="guide-seat"><option value="p1">玩家 1</option><option value="p2">玩家 2</option><option value="touch">触屏</option></select></label></div><div id="guide-entries" aria-live="polite"></div>'+
    (onPractice?'<button class="primary guide-practice" id="try-moves">用这个角色练招　→</button>':'');
  const fighterSelect=container.querySelector('#guide-fighter'), layoutSelect=container.querySelector('#guide-seat'), body=container.querySelector('#guide-entries');
  function paint() {
    const kit=MOVES[char], partner=(char===initial && support)||ASSIST_PARTNERS[char];
    const display=(steps,name,detail)=>row(steps,layout,name,detail.replace(/\b[WSJKLUIO]\b/g,key=>keys[layout][key]));
    const move=(steps,id)=>display(steps,kit[id].name,kit[id].desc+(kit[id].cost?'　消耗 '+kit[id].cost/100+' 格怒气。':''));
    const combos=BASIC_COMBOS[char].map(combo=>display(combo.inputs,combo.name,combo.detail)).join('');
    body.innerHTML='<div class="guide-profile"><img src="'+portrait(char)+'" alt=""><div><h3>'+fighterName(char)+'</h3><span>'+fighters[char].style+'</span></div></div>'+
      '<h4>基础连段</h4><div class="guide-rows">'+combos+'</div><p class="guide-note">› 依次按键　+ 按住方向再出招</p>'+
      '<h4>常用招式</h4><div class="guide-rows">'+move(['S+J'],'downAttack')+move(['W+J'],'upAttack')+display(['K','J'],'跳攻','靠近时跳起，再点普攻。')+move(['U'],'special')+move(['I'],'super')+
      display(['O'],ASSIST_MOVES[partner].name,'呼叫'+fighterName(partner)+'出场。'+ASSIST_MOVES[partner].desc+' 消耗一格怒气，受击时也可呼叫。')+'</div>'+
      '<details class="guide-extra"><summary>方向派生、空中技与进阶操作</summary><div class="guide-rows">'+move(['W+U'],'upSkill')+move(['S+U'],'downSkill')+move(['K','U'],'airSkill')+move(['W+I'],'upSuper')+move(['S+I'],'downSuper')+move(['K','I'],'airSuper')+
      display(['J'],'近身摔','对手正面格挡时，走到贴身距离点普攻，可以破开防御。')+
      display(['L'],'冲刺 / 受身','地面按冲刺快速移动。被重击击倒时，在触地前后按冲刺可提前起身。')+
      display(['W+L'],'幽步','按住上方向再冲刺，消耗一格怒气。')+display(['S+L'],'幽步绕身','近身时按住防御再冲刺，消耗一格怒气。')+
      (['iron','nailong'].includes(char)?display(['J+K'],'满怒觉醒','站稳时同时点普攻和跳跃。消耗三格怒气，短时间提升移动速度和伤害。'):'')+
      '</div></details>';
  }
  fighterSelect.value=char;layoutSelect.value=layout;
  fighterSelect.onchange=()=>{char=fighterSelect.value;paint();};
  layoutSelect.onchange=()=>{layout=layoutSelect.value;paint();};
  if(onPractice)container.querySelector('#try-moves').onclick=()=>onPractice(char);
  paint();
}
