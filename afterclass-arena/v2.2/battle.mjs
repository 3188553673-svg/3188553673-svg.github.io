import {CHARACTERS, SKILL_COOLDOWNS, createGame, stepGame, TICK_RATE} from './engine.mjs';
import {renderStage} from './stage.mjs';
import {wakeAudio, soundEvent} from './sound.mjs';
import {portrait} from './roster.mjs';

const FRAME=1000/TICK_RATE;
const SLOT_COLORS=['#6bf1e8','#ffd274','#a9baff','#ff96b5'];
const KEYMAP=[
  {KeyA:'left',KeyD:'right',KeyS:'down',KeyW:'jump',KeyJ:'attack',KeyK:'skill',KeyL:'dodge'},
  {ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'jump',Comma:'attack',Period:'skill',Slash:'dodge',Digit1:'attack',Digit2:'skill',Digit3:'dodge',Numpad1:'attack',Numpad2:'skill',Numpad3:'dodge'}
];
const $=id=>document.getElementById(id);
function element(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
}

export class Battle{
  constructor({onExit,onRematch,onLobby,onTrainingFacing}={}){
    this.onExit=onExit;this.onRematch=onRematch;this.onLobby=onLobby;this.onTrainingFacing=onTrainingFacing;this.trainingFace=null;
    this.canvas=$('arena');this.hud=$('hud');this.cover=$('game-cover');this.shout=$('shout');this.touch=$('touch');
    this.mode=null;this.latest=null;this.connection=null;this.room=null;this.localIds=[];
    this.keys=new Set();this.pointers=new Map();this.pad=this.touch.querySelector('.touch-pad');
    this.pad.setAttribute('aria-label','方向盘');this.knob=element('i','stick-knob');this.pad.append(this.knob);
    this.stageTitle=document.querySelector('.battle-stage');
    this.defaultStage=this.stageTitle.innerHTML;
    this.footerRule=document.querySelector('.match-foot > :last-child');
    this.defaultRule=this.footerRule.textContent;
    this.resetButton=element('button','utility dojo-reset','复位');this.resetButton.type='button';this.resetButton.hidden=true;this.resetButton.title='复位（R）';this.resetButton.onclick=()=>this.resetTraining();
    $('back-game').before(this.resetButton);
    this.readout=element('div','dojo-readout');this.readout.hidden=true;this.readout.setAttribute('aria-label','练习输入');
    this.directions=element('b','dojo-directions','—');this.lastMove=element('span','dojo-last','等待出招');
    this.readout.append(element('span','dojo-input-label','输入'),this.directions);this.touch.before(this.readout);
    this.queues=[[],[]];this.lastMasks=[0,0];this.history=[];this.lastSymbol='';
    this.skillButton=this.touch.querySelector('[data-action=skill]');
    this.tiles=[];this.raf=0;this.lastEvent=0;this.lastPhase=null;this.lastCount=null;
    this.menuOpen=false;this.helpOpen=false;this.resultShown=false;this.messageEnd=0;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    this.frame=this.frame.bind(this);
    document.addEventListener('keydown',e=>this.key(e,true));
    document.addEventListener('keyup',e=>this.key(e,false));
    window.addEventListener('blur',()=>this.interrupt());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.interrupt();this.lastTime=performance.now();this.bank=0;});
    $('back-game').addEventListener('click',()=>this.menu());
    this.touch.addEventListener('pointerdown',e=>this.touchStart(e));
    this.touch.addEventListener('pointermove',e=>this.touchMove(e));
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])this.touch.addEventListener(ev,e=>this.touchEnd(e));
    this.touch.addEventListener('contextmenu',e=>e.preventDefault());
    this.cover.addEventListener('click',e=>{const button=e.target.closest('button[data-command]');if(button)this.command(button.dataset.command);});
    for(const b of this.touch.querySelectorAll('button'))b.type='button';
    const actionNames={left:'向左移动',right:'向右移动',down:'蹲防',jump:'跳跃',dodge:'闪避',attack:'普通攻击，可连点三次',skill:'招牌技能'};
    for(const b of this.touch.querySelectorAll('button'))b.setAttribute('aria-label',actionNames[b.dataset.action]);
  }
  get active(){return this.mode!==null;}
  get state(){return this.latest;}
  get paused(){return this.mode==='local'&&(this.menuOpen||this.helpOpen);}
  get canInput(){return this.active && !this.menuOpen && !this.helpOpen && this.latest?.phase!=='over' && !document.hidden;}

  startLocal(players){
    this.stop();
    this.mode='local';this.localIds=players.filter(p=>!p.bot&&!p.dummy).map(p=>p.id).slice(0,2);
    this.trainingRoster=players.some(p=>p.dummy)?players.map(p=>({...p})):null;
    this.begin(createGame(players),this.trainingRoster?'木桩练习':this.localIds.length>1?'同机对战':'人机对战');
  }
  resetTraining(){
    if(!this.trainingRoster || this.helpOpen)return;
    const roster=this.trainingRoster.map(p=>({...p}));
    this.startLocal(roster);
  }
  startNetwork(connection,room){
    this.stop();
    this.mode='net';this.connection=connection;this.room=room;
    this.localIds=room.players.filter(p=>p.clientId===room.clientId).sort((a,b)=>a.seat-b.seat).map(p=>p.id);
    this.begin(createGame(room.players),'局域网对战');
  }
  begin(state,label){
    this.latest=state;this.netReceived=false;this.tiles=[];this.hud.replaceChildren();
    this.lastEvent=0;this.resultShown=false;this.menuOpen=false;this.helpOpen=false;
    this.lastPhase=null;this.lastCount=null;this.messageEnd=0;this.shout.textContent='';
    this.bank=0;this.lastTime=performance.now();this.cover.hidden=true;this.cover.replaceChildren();
    this.resetButton.hidden=this.readout.hidden=!this.trainingRoster;
    this.lastMove.textContent='等待出招';this.directions.textContent='—';this.history=[];this.lastSymbol='';
    const training=!!state.training;
    $('battle').classList.toggle('training',training);
    this.stageTitle.innerHTML=training?'<span class="signal"></span>训练场 <b>DOJO</b>':this.defaultStage;
    this.footerRule.textContent=training?'R 复位双方位置与击飞值':this.defaultRule;
    $('battle').hidden=false;$('match-kind').textContent=training?'木桩练习':label+' · '+state.players.length+' 人';
    $('keys-foot').textContent=this.localIds.length>1?'P1  WASD / J K L      P2  方向键 / 1 2 3':'A D 移动   ·   W 跳跃   ·   连按 J 三连击   ·   K 技能   L 闪避';
    this.cover.removeAttribute('aria-modal');this.hud.setAttribute('aria-label','斗士状态');
    this.clearInputs();wakeAudio();
    this.display(state);this.raf=requestAnimationFrame(this.frame);
  }
  receive(state){
    if(this.mode!=='net'||!state)return;
    this.latest=state;this.netReceived=true;
    // A hidden tab may receive the result before its next animation frame.
    if(!document.hidden)this.feedback(state);
  }
  stop(){
    this.clearInputs();
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;this.mode=null;this.connection=null;this.room=null;this.latest=null;this.localIds=[];this.trainingRoster=null;this.resetButton.hidden=this.readout.hidden=true;
    this.netReceived=false;this.menuOpen=false;this.helpOpen=false;this.resultShown=false;
    this.cover.hidden=true;this.cover.replaceChildren();this.shout.textContent='';
    this.hud.replaceChildren();this.tiles=[];
    if(this.trainingFace){this.trainingFace=null;this.onTrainingFacing?.(null,0);}
    $('battle').classList.remove('training');this.stageTitle.innerHTML=this.defaultStage;this.footerRule.textContent=this.defaultRule;
  }
  menu(){
    if(!this.active||this.helpOpen||this.latest?.phase==='over')return;
    if(this.menuOpen){this.command('resume');return;}
    this.clearInputs();this.menuOpen=true;
    this.showCover('menu');
  }
  help(open){
    if(!this.active)return;
    this.clearInputs();this.helpOpen=!!open;
    this.bank=0;this.lastTime=performance.now();
  }
  interrupt(){
    if(!this.active)return;
    this.clearInputs();this.bank=0;this.lastTime=performance.now();
    if(this.mode==='local' && !this.menuOpen && !this.helpOpen && this.latest?.phase!=='over')this.menu();
  }
  key(e,down){
    if(!this.active)return;
    if(e.code==='Escape' && down && !e.repeat && !this.helpOpen && !document.querySelector('dialog[open]')){
      if(this.latest?.phase!=='over'){e.preventDefault();this.menu();} return;
    }
    if(e.code==='KeyR' && down && !e.repeat && this.trainingRoster && !document.querySelector('dialog[open]') && !e.metaKey && !e.ctrlKey && !e.altKey){
      e.preventDefault();this.resetTraining();return;
    }
    const index=KEYMAP.findIndex(row=>Object.hasOwn(row,e.code));
    if(index<0 || index>=this.localIds.length)return;
    if(!down){if(this.keys.delete(e.code))this.networkInput();return;}
    if(!this.canInput||e.metaKey||e.ctrlKey||e.altKey||e.isComposing||document.querySelector('dialog[open]'))return;
    e.preventDefault();
    if(this.keys.has(e.code)||e.repeat)return;
    this.keys.add(e.code);this.networkInput();
  }
  rows(){
    return this.localIds.map((_,index)=>{
      const row={};
      // Set iterates in key-down order. Pressing the opposite arrow while
      // turning should take effect before the first key is released.
      const apply=action=>{
        if(!action)return;
        if(action==='left')delete row.right;
        if(action==='right')delete row.left;
        row[action]=true;
      };
      for(const code of this.keys)apply(KEYMAP[index][code]);
      if(index===0&&this.pointers.size){
        for(const pointer of this.pointers.values())for(const action of pointer.actions)apply(action);
        if(this.trainingRoster)row.touch=true;
      }
      return row;
    });
  }
  networkInput(){
    const rows=this.rows();
    if(this.mode==='net'){this.connection?.input(rows);return;}
    if(!this.canInput || this.mode!=='local')return;
    const keys=['left','right','down','jump','attack','skill','dodge'];
    rows.forEach((row,i)=>{
      const mask=keys.reduce((v,k,j)=>row[k]?v|(1<<j):v,0);
      if(mask===this.lastMasks[i])return;
      this.lastMasks[i]=mask;
      const queue=this.queues[i];
      if(queue.length>=14)queue.shift();
      queue.push(row);
    });
  }
  trainingInput(row){
    const dx=Number(!!row.right)-Number(!!row.left);
    const direction=row.down?['↙','↓','↘'][dx+1]:dx<0?'←':dx>0?'→':'';
    const labels=row.touch?['击','技','闪','跳']:['J','K','L','↑'];
    const actions=['attack','skill','dodge','jump'].map((key,i)=>row[key]?labels[i]:'').filter(Boolean).join('+');
    const symbol=[direction,actions].filter(Boolean).join('+');
    if(symbol && symbol!==this.lastSymbol){
      this.history.push(symbol);if(this.history.length>8)this.history.shift();
      this.directions.textContent=this.history.join(' ');
    }
    this.lastSymbol=symbol;
  }
  clearInputs(){
    this.keys.clear();this.pointers.clear();this.queues.forEach(q=>{q.length=0;});this.lastMasks=[0,0];
    this.paintTouch();
    if(this.mode==='net')this.connection?.input(this.rows());
  }
  readStick(e){
    const b=this.pad.getBoundingClientRect(),dx=(e.clientX-b.left-b.width/2)/(b.width/2),dy=(e.clientY-b.top-b.height/2)/(b.height/2);
    const distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),actions=[];
    if(distance>.22){
      // Half-axes overlap for the full forty-five-degree diagonal sector.
      if(Math.cos(angle)>.38)actions.push('right');
      if(Math.cos(angle)<-.38)actions.push('left');
      if(Math.sin(angle)>.38)actions.push('down');
    }
    const amplitude=Math.min(1,distance)*b.width*.22;
    return {stick:true,actions,x:Math.cos(angle)*amplitude,y:Math.sin(angle)*amplitude};
  }
  touchStart(e){
    if(!this.canInput||!this.localIds.length)return;
    const button=e.target.closest('button[data-action]');
    if(!button&&!this.pad.contains(e.target))return;
    e.preventDefault();wakeAudio();
    this.touch.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId,this.pad.contains(e.target)?this.readStick(e):{actions:[button.dataset.action]});
    this.paintTouch();this.networkInput();
  }
  touchMove(e){
    const current=this.pointers.get(e.pointerId);if(!current)return;
    e.preventDefault();
    if(current.stick)this.pointers.set(e.pointerId,this.readStick(e));
    else{
      const button=document.elementFromPoint(e.clientX,e.clientY)?.closest('.touch-act button[data-action]');
      this.pointers.set(e.pointerId,{actions:button?[button.dataset.action]:[]});
    }
    this.paintTouch();this.networkInput();
  }
  touchEnd(e){
    if(!this.pointers.delete(e.pointerId))return;
    this.paintTouch();this.networkInput();
  }
  paintTouch(){
    const pointers=[...this.pointers.values()],held=new Set(pointers.flatMap(p=>p.actions));
    const stick=pointers.find(p=>p.stick);
    this.knob.style.transform='translate('+Math.round(stick?.x||0)+'px,'+Math.round(stick?.y||0)+'px)';
    for(const b of this.touch.querySelectorAll('button'))b.classList.toggle('pressed',held.has(b.dataset.action));
  }

  frame(now){
    if(!this.active)return;
    const dt=Math.max(0,Math.min(100,now-this.lastTime));this.lastTime=now;
    if(!document.hidden){
      if(this.mode==='local' && !this.paused && this.latest.phase!=='over'){
        this.bank+=dt;
        while(this.bank>=FRAME && this.latest.phase!=='over'){
          const rows=this.rows().map((held,i)=>this.queues[i].shift()||held);
          if(this.trainingRoster)this.trainingInput(rows[0]||{});
          const inputs=Object.fromEntries(this.localIds.map((id,i)=>[id,rows[i]]));
          stepGame(this.latest,inputs);this.bank-=FRAME;this.feedback(this.latest);
        }
      }else this.bank=0;
      if(this.mode==='net')this.networkInput();
      const visible=this.mode==='net'&&this.netReceived?(this.connection.sample()||this.latest):this.latest;
      this.display(visible);
    }
    this.raf=requestAnimationFrame(this.frame);
  }
  feedback(s){
    if(s.phase==='countdown'){
      const count=Math.ceil(s.countdown/TICK_RATE);
      if(count!==this.lastCount){this.lastCount=count;soundEvent('count');}
      return;
    }
    for(const e of s.events){
      if(e.id<=this.lastEvent)continue;
      this.lastEvent=e.id;
      if(document.hidden||s.tick-e.tick>16)continue;
      if(e.kind==='skill'){
        const source=s.players.find(p=>p.id===e.source);
        soundEvent(source?'skill-'+source.char:'skill',e.power,e.move||source?.move);
      }else soundEvent(e.kind,e.kind==='hit'&&e.launch>=13?Math.max(20,e.power):e.power);
      const source=s.players.find(p=>p.id===e.source);
      if(source && ['skill','swing','hit','block'].includes(e.kind)){
        const tile=this.tiles[source.slot],name=e.moveName||source.moveName;
        if(this.trainingRoster && source.id===this.localIds[0] && name){
          this.lastMove.textContent=name;
          const target=this.tiles[s.players.find(p=>p.dummy)?.slot];
          if(target && e.kind==='hit')target.combo.textContent=String(e.combo||1);
        }
        if(!this.trainingRoster && tile && name && (e.kind==='skill'||e.kind==='hit'||e.kind==='block')){
          const count=e.combo||source.comboCount||0;
          tile.tag.textContent=e.kind==='block'?'格挡':e.kind==='hit'&&count>1?count+' 连击 · '+name:name;
          tile.expires=e.tick+42;tile.tag.hidden=false;
        }
      }
      if(e.kind==='ko'){
        const defeated=s.players.find(p=>p.id===e.target);
        if(defeated){
          this.messageEnd=s.tick+57;this.announce((defeated.bot?'CPU ':'P')+(defeated.slot+1)+' '+CHARACTERS[defeated.char].name+(defeated.stocks?' 出界':' 淘汰'),'notice-ko');
        }
      }
    }
  }
  announce(text,cls){
    if(this.shout.textContent!==text)this.shout.textContent=text;
    if(this.shout.className!==cls)this.shout.className=cls;
  }
  display(s){
    if(!s)return;
    renderStage(this.canvas,s,{localIds:this.localIds,reducedMotion:this.reducedMotion.matches});
    if(s.training){
      const player=s.players.find(p=>!p.dummy);
      if(player && (!this.trainingFace||this.trainingFace.char!==player.char||this.trainingFace.facing!==player.facing)){
        this.trainingFace={char:player.char,facing:player.facing};
        this.onTrainingFacing?.(player.char,player.facing);
      }
    }
    this.updateHud(s.players);
    if(s.phase==='countdown')this.announce(String(Math.ceil(s.countdown/TICK_RATE)),'countdown');
    else if(!this.trainingRoster && s.phase==='play' && s.tick<217)this.announce('开打！','fight-go');
    else if(s.tick>=this.messageEnd || s.phase==='over')this.announce('','');
    if(s.phase==='over'&&!this.resultShown){
      this.resultShown=true;this.clearInputs();this.menuOpen=false;this.showCover('result');
    }
    this.lastPhase=s.phase;
  }

  newTile(p){
    const wrap=element('div','fighter-hud'), face=element('img','hud-face');
    face.src=portrait(p.char);face.alt='';
    const mid=element('div','hud-main'), top=element('div','hud-top');
    const seat=p.dummy?'木桩':(p.bot?'CPU ':'P')+(p.slot+1);
    top.append(element('span','hud-seat',seat),element('span','hud-name',CHARACTERS[p.char].name));
    const lives=element('div','hud-lives');
    const pips=Array.from({length:3},()=>element('i'));
    lives.append(...pips);
    const number=element('strong','hud-damage'),unit=element('span','damage-unit','%');
    const low=element('div','hud-low');low.append(number,unit,lives);
    const charge=element('i','hud-charge');
    const tag=element('span','fight-tag');tag.hidden=true;
    mid.append(top,low);wrap.append(face,mid,charge,tag);
    wrap.style.setProperty('--seat-color',SLOT_COLORS[p.slot]);this.hud.append(wrap);
    return {wrap,number,pips,seat,charge,tag,expires:0,damage:null,stocks:null,cooldown:-1};
  }
  newTrainingTile(p){
    const wrap=element('div','fighter-hud dojo-hud'),face=element('img','hud-face');
    wrap.style.setProperty('--seat-color',p.dummy?'#f3b578':SLOT_COLORS[0]);
    face.src=p.dummy?'art/training-dummy.svg':portrait(p.char);face.alt='';
    const mid=element('div','hud-main'),heading=element('div','hud-top');
    heading.append(element('b','hud-name',p.dummy?'训练木桩':CHARACTERS[p.char].name));
    mid.append(heading);wrap.append(face,mid);this.hud.append(wrap);
    if(p.dummy){
      const stats=element('div','dojo-target-stats');
      const number=element('b','dojo-percent','0'),combo=element('b','dojo-combo','0');
      const percent=element('span','dojo-stat'),count=element('span','dojo-stat');
      percent.title='木桩当前击飞值';count.title='最近一次连段的命中数';
      percent.append(number,element('small','','%'));
      count.append(combo,element('small','','连击'));
      stats.append(percent,count);mid.append(stats);
      return {wrap,number,combo,damage:-1};
    }
    mid.append(this.lastMove);
    const charge=element('i','hud-charge');wrap.append(charge);
    return {wrap,charge,cooldown:-1};
  }
  updateTrainingHud(players){
    for(const p of players){
      const tile=this.tiles[p.slot]??=this.newTrainingTile(p);
      if(p.dummy){
        const damage=Math.round(p.damage);
        if(damage!==tile.damage){tile.number.textContent=String(damage);tile.damage=damage;}
      }else if(tile.cooldown!==p.skillCooldown){
        this.updateCharge(p,tile);
      }
    }
  }
  updateCharge(p,tile){
    const ready=1-p.skillCooldown/SKILL_COOLDOWNS[p.char];
    tile.charge.style.transform='scaleX('+ready+')';
    tile.charge.classList.toggle('ready',p.skillCooldown===0);
    if(p.id===this.localIds[0]){
      this.skillButton.style.setProperty('--charge',String(ready));
      this.skillButton.classList.toggle('cooling',p.skillCooldown>0);
    }
    tile.cooldown=p.skillCooldown;
  }
  updateHud(players){
    if(this.trainingRoster)return this.updateTrainingHud(players);
    for(const p of players){
      const tile=this.tiles[p.slot]??=this.newTile(p);
      if(!tile.tag.hidden&&this.latest.tick>=tile.expires)tile.tag.hidden=true;
      if(tile.cooldown!==p.skillCooldown)this.updateCharge(p,tile);
      const damage=Math.round(p.damage);
      if(tile.damage===damage && tile.stocks===p.stocks)continue;
      tile.number.textContent=String(damage);
      tile.wrap.style.setProperty('--damage',damage>=110?'#ff786d':damage>=60?'#ffc07c':'#fff3df');
      for(let i=0;i<3;i++)tile.pips[i].classList.toggle('spent',i>=p.stocks);
      tile.wrap.classList.toggle('eliminated',p.stocks===0);
      tile.wrap.setAttribute('aria-label',tile.seat+' '+CHARACTERS[p.char].name+'，击飞值 '+damage+'%，剩余 '+p.stocks+' 条命');
      tile.damage=damage;tile.stocks=p.stocks;
    }
  }
  showCover(kind){
    const net=this.mode==='net',host=net&&this.room?.clientId===this.room?.host;
    const result=kind==='result',winner=result?this.latest.players.find(p=>p.id===this.latest.winner):null;
    const panel=element('section','battle-dialog');
    const top=element('div','battle-dialog-top');
    if(winner){const img=element('img','win-face');img.src=portrait(winner.char);img.alt='';top.append(img);}
    const text=element('div','battle-dialog-copy');
    text.append(element('span','battle-kicker',result?'MATCH RESULT':net?'MATCH MENU':'PAUSED'));
    const name=winner?CHARACTERS[winner.char].name:'';
    text.append(element('h2','',result?(winner?name+'获胜':'平局'):(net?'对战菜单':this.trainingRoster?'练习已暂停':'对局已暂停')));
    const detail=result?(winner?(winner.bot?'CPU ':'P')+(winner.slot+1)+'  ·  剩余 '+winner.stocks+' 条命  ·  '+winner.kos+' 次击落':'最后两名斗士同时出界'):(net?'房间里的比赛继续进行。':'准备好后回到擂台。');
    text.append(element('p','',detail));top.append(text);panel.append(top);
    const buttons=element('div','battle-buttons');
    const add=(cmd,label,primary=false)=>{const b=element('button',primary?'primary':'secondary',label);b.type='button';b.dataset.command=cmd;buttons.append(b);};
    if(!result){add('resume',this.trainingRoster?'继续练习':'继续对战',true);add('moves','出招表');}
    if(result && (!net||host))add('rematch','再来一局',true);
    if(result&&net&&!host)panel.append(element('p','guest-wait','等待房主开始下一局'));
    if(host)add('lobby','返回房间');
    add('exit',net?'离开房间':'返回选人');
    panel.append(buttons);this.cover.replaceChildren(panel);this.cover.hidden=false;
    this.cover.setAttribute('role','dialog');this.cover.setAttribute('aria-label',result?'对局结果':'对战菜单');
  }
  command(cmd){
    wakeAudio();
    if(cmd==='resume'){
      this.menuOpen=false;this.cover.hidden=true;this.clearInputs();this.lastTime=performance.now();this.bank=0;
    }else if(cmd==='moves')$('moves')?.click();
    else if(cmd==='rematch')this.onRematch?.();
    else if(cmd==='lobby')this.onLobby?.();
    else if(cmd==='exit')this.onExit?.();
  }
}
