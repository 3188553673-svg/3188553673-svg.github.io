import { CHARACTERS } from './engine.mjs';
import { MOVES } from './moves.mjs';
import { showMoveGuide } from './guide.mjs';
import { fighters, fighterIds, portrait, fighterName } from './roster.mjs';
import { Battle } from './battle.mjs';
import { Rooms } from './rooms.mjs';
import { roomCodeFromUrl } from './network.mjs';
import { wakeAudio, setMuted } from './sound.mjs';
import { icon } from './icons.mjs';
import { lobbyDemo } from './demo.mjs';

const $ = id => document.getElementById(id);
const screens = ['home','room','battle'];
const hostKit=/^[a-z0-9-]+\.github\.io$/i.test(location.hostname)
  ? new URL('./afterclass-arena-lan-v2.3.zip',import.meta.url).href : null;
const modes = {
  training: ['dummy','训练场','进入训练场'],
  solo: ['robot','人机对战','开始人机对战'],
  duo: ['duo','同机双人','开始双人对战'],
  lan: ['wifi','局域网','创建局域网房间']
};
const setup = { mode:matchMedia('(pointer: coarse)').matches?'solo':'duo', picks:['doubao','iron'], seat:0,
  lanCount:1, opponent:'auto', bots:{solo:1,duo:0} };
const modal=$('modal');
let screen='home', busy=false, modalType='', noticeTimer=0, localRoster=[], muted=false;
try {muted=localStorage.getItem('afterclass-muted')==='1';} catch {}
setMuted(muted);

function show(next) {
  if(screen!==next) window.scrollTo(0,0);
  screen=next;document.body.dataset.screen=next;
  for(const id of screens) $(id).hidden=id!==next;
}
function notice(text) {
  if(!text)return;
  clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;
  noticeTimer=setTimeout(()=>{$('notice').hidden=true;},3800);
}
function closeModal() {
  if(modal.open) {
    if(typeof modal.close==='function')modal.close();
    else{modal.removeAttribute('open');modalClosed();}
  }
}
function modalClosed() {
  if(modal.open)return;
  if((modalType==='help'||modalType==='moves') && battle.helpOpen)battle.help(false);
  modalType='';
}
function backHome(message='') {
  closeModal();battle.stop();show('home');
  const url=new URL(location.href);
  for(const param of ['room','mode','fighter'])url.searchParams.delete(param);
  if(url.href!==location.href)history.replaceState(null,'',url);
  redraw();notice(message);
}
function practiceReference(char,facing){
  const strip=$('practice-reference');
  strip.hidden=!char;
  if(!char)return;
  $('practice-facing').textContent=fighterName(char)+(facing>0?' · 朝右 →':' · 朝左 ←');
  $('practice-skill').textContent=MOVES[char].special.name;
}
const battle=new Battle({
  onTrainingFacing:practiceReference,
  onExit:()=>{if(rooms.room)rooms.leave();else backHome();},
  onRematch:()=>{if(rooms.room)rooms.rematch();else battle.startLocal(localRoster.map(p=>({...p})));},
  onLobby:()=>{if(rooms.room)rooms.lobby();else backHome();}
});
const rooms=new Rooms({
  onEnter:room=>{closeModal();battle.stop();show('room');},
  onGame:(conn,room)=>{closeModal();show('battle');battle.startNetwork(conn,room);},
  onState:state=>battle.receive(state),
  onHome:message=>backHome(message),onNotice:notice
});

function countSeats(){return setup.mode==='duo'?2:setup.mode==='lan'?setup.lanCount:1;}
function selectedSeats(){return setup.picks.slice(0,countSeats());}
function redraw(){
  const activeId=setup.picks[setup.seat], selected=selectedSeats();
  $('modes').innerHTML=Object.entries(modes).map(([id,[glyph,name]])=>
    '<button class="mode '+(id===setup.mode?'active':'')+'" data-mode="'+id+'" aria-pressed="'+(id===setup.mode)+'">'+icon(glyph)+name+'</button>').join('');
  $('seat-switch').innerHTML=countSeats()===2?'<div class="seg" aria-label="选择要换角色的玩家">'+[0,1].map(i=>'<button data-seat="'+i+'" class="mini '+(i===setup.seat?'active':'')+'" aria-label="为玩家 '+(i+1)+' 选人" aria-pressed="'+(i===setup.seat)+'">P'+(i+1)+'</button>').join('')+'</div>':'<span class="seat-tag">P1</span>';
  $('cards').innerHTML=fighterIds.map(id=>{
    const meta=fighters[id], info=CHARACTERS[id], tags=selected.flatMap((s,i)=>s===id?['P'+(i+1)]:[]);
    return '<button class="fighter-card '+(id===activeId?'selected':'')+'" style="--accent:'+info.color+'" data-char="'+id+'" aria-label="选择'+info.name+'" aria-pressed="'+(id===activeId)+'"><span class="portrait"><img src="'+portrait(id)+'" alt="">'+
      (tags.length?'<span class="pick-flag">'+tags.join(' + ')+'</span>':'')+'</span><span class="card-meta"><span class="card-name">'+info.name+'</span><span class="card-code">'+meta.code+'</span></span></button>';
  }).join('');
  const f=fighters[activeId], c=CHARACTERS[activeId];
  $('skill-info').style.setProperty('--accent',c.color);
  $('skill-info').innerHTML='<span class="skill-icon">'+icon(f.icon)+'</span><div class="skill-description"><b>'+c.name+'</b><span class="skill-role">'+f.style+'</span><p>'+f.detail+'</p></div><button class="guide-link" id="fighter-moves">'+icon('book')+'出招表</button>';
  if(setup.mode==='training'){
    $('options').innerHTML='<div class="wood-practice-card"><img src="art/training-dummy.svg" alt="" width="46" height="54"><div><b>训练木桩</b><p>木桩固定在原位。试试普攻三连，或下落时连按普攻练空连。按 R 或点「复位」重新练。</p></div></div>';
  } else if(setup.mode==='lan' && hostKit){
    $('options').innerHTML='<p class="notes">房主用电脑开房，朋友连同一 Wi-Fi 扫码加入。每场支持 2–4 人。</p>';
  } else if(setup.mode==='lan'){
    $('options').innerHTML='<div class="setting-row"><span>本机参战</span><div class="seg">'+[1,2].map(n=>'<button class="mini '+(setup.lanCount===n?'active':'')+'" data-local-count="'+n+'" aria-pressed="'+(setup.lanCount===n)+'">'+n+' 人</button>').join('')+'</div></div><div class="setting-row rule"><span>房间容量</span><b>2–4 人 · 每人 3 命</b></div><button id="join-room" class="setup-join" type="button">已有房间？输入房间码</button>';
  } else {
    const n=setup.bots[setup.mode], min=setup.mode==='solo'?1:0, max=4-countSeats();
    const opponentPicker=setup.mode==='solo'?'<div class="setting-row"><label for="opponent">对手斗士</label><select id="opponent"><option value="auto">随机</option>'+fighterIds.map(id=>'<option value="'+id+'">'+fighterName(id)+'</option>').join('')+'</select></div>':'';
    const countRow='<div class="setting-row"><span>电脑对手</span><div class="stepper"><button class="mini" data-bots="-1" aria-label="减少电脑对手" '+(n<=min?'disabled':'')+'>−</button><b>'+n+'</b><button class="mini" data-bots="1" aria-label="增加电脑对手" '+(n>=max?'disabled':'')+'>＋</button></div></div>';
    $('options').innerHTML=opponentPicker+countRow+'<div class="setting-row rule"><span>比赛规则</span><b>'+(n+countSeats())+' 人混战 · 每人 3 命</b></div>';
    const opponent=$('opponent');
    if(opponent){opponent.value=setup.opponent;opponent.onchange=()=>{setup.opponent=opponent.value;};}

  }
  const startLabel=setup.mode==='lan' && hostKit?'下载主机包与开房说明':modes[setup.mode][2];
  $('launch').disabled=busy;
  $('launch').innerHTML=icon(setup.mode==='lan'?'wifi':'play')+'<span>'+(busy?'正在连接…':startLabel)+'</span>'+icon('arrow');
}
function chooseMode(mode){setup.mode=mode;setup.seat=0;redraw();}
$('home').addEventListener('click',event=>{
  if(busy)return;
  const b=event.target.closest('button');if(!b)return;
  const d=b.dataset;
  if(d.mode)chooseMode(d.mode);
  else if(d.seat!==undefined){setup.seat=Number(d.seat);redraw();}
  else if(d.char){setup.picks[setup.seat]=d.char;redraw();}
  else if(d.localCount){setup.lanCount=Number(d.localCount);setup.seat=Math.min(setup.seat,setup.lanCount-1);redraw();}
  else if(b.id==='fighter-moves')openMoves(setup.picks[setup.seat], setup.seat);
  else if(d.bots){setup.bots[setup.mode]+=Number(d.bots);redraw();}
  else if(b.id==='join-room')openJoin('');
  else if(b.id==='launch')launch();
  if(event.detail===0) {
    const key=['mode','seat','char','bots','localCount'].find(k=>d[k]!==undefined);
    if(key){const next=[...$('home').querySelectorAll('button')].find(el=>el.dataset[key]===d[key]);next?.focus();}
  }
});
function localPlayers(){
  const picks=selectedSeats();
  const roster=picks.map((char,i)=>({id:'p'+(i+1),name:fighterName(char),char,bot:false}));
  if(setup.mode==='training'){
    roster.push({id:'dummy',dummy:true,bot:true});
    return roster;
  }
  const pool=fighterIds.filter(id=>!picks.includes(id));
  for(let i=0;i<setup.bots[setup.mode];i++){
    const chosen=setup.mode==='solo' && i===0 && setup.opponent!=='auto'?setup.opponent:pool[Math.floor(Math.random()*pool.length)];
    const at=pool.indexOf(chosen);if(at>=0)pool.splice(at,1);
    roster.push({id:'cpu'+(i+1),name:fighterName(chosen),char:chosen,bot:true});
  }
  return roster;
}
async function launch(){
  wakeAudio();
  if(setup.mode!=='lan'){
    localRoster=localPlayers();show('battle');battle.startLocal(localRoster.map(p=>({...p})));return;
  }
  if(hostKit){openHostGuide();return;}
  busy=true;redraw();
  try{await rooms.create(selectedSeats());}
  catch(error){notice(error.message||'创建房间失败，请再试一次。');}
  finally{busy=false;redraw();}
}
function openModal(type,title,html){
  closeModal();modalType=type;$('modal-title').textContent=title;$('modal-content').innerHTML=html;
  if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
}
function openHostGuide(){
  openModal('host-guide','局域网开房','<p class="notes"><strong>房主</strong>　将主机包下载到电脑并解压，双击对应系统的启动游戏文件。进入「局域网」，选择本机人数，然后创建房间。</p>'+
    '<div class="dialog-buttons"><a class="primary" id="host-download">下载电脑主机包（ZIP） '+icon('arrow')+'</a></div>'+
    '<p class="notes"><strong>加入朋友的房间</strong>　连接房主的 Wi-Fi，扫描房间二维码，或在浏览器中打开房主发来的完整邀请链接。已有六位房间码时，请在房主电脑显示的局域网地址输入。</p>');
  $('host-download').href=hostKit;
}
function openJoin(code){
  if(hostKit){openHostGuide();return;}

  openModal('join','加入局域网房间','<form id="join-form"><label for="room-code">六位房间码</label><p class="notes">连接房主的 Wi-Fi，打开房主电脑显示的局域网地址。扫码进入会自动填好房间码。</p><input id="room-code" class="entry" type="text" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="off" required placeholder="000000"><p class="error" id="join-error" role="alert"></p><div class="dialog-buttons"><button class="primary" type="submit">加入房间 '+icon('arrow')+'</button></div></form>');
  const input=$('room-code');input.value=/^\d{6}$/.test(code)?code:'';
  if(!input.value)input.focus();
  $('join-form').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const value=input.value.trim();if(!/^\d{6}$/.test(value))return;
    const error=$('join-error'),submit=e.currentTarget.querySelector('[type=submit]');
    busy=true;submit.disabled=true;submit.textContent='正在加入…';error.textContent='';wakeAudio();
    try{await rooms.join(value,selectedSeats());}
    catch(ex){error.textContent=ex.message||'加入失败，请核对房间码。';}
    finally{busy=false;submit.disabled=false;submit.textContent='加入房间';redraw();}
  });
}
function openMoves(id,seat=0){
  openModal('moves','出招表','');
  if(screen==='battle')battle.help(true);
  showMoveGuide($('modal-content'),id,{seat,onPractice:screen==='home'?char=>{
    closeModal();setup.picks[0]=char;chooseMode('training');launch();
  }:null});
}
function currentGuide(){
  const p=battle.state?.players.find(p=>p.id===battle.localIds?.[0]);
  if(p)return openMoves(p.char,0);
  const mine=rooms.room?.players.find(p=>p.clientId===rooms.room.clientId && p.seat===rooms.localSeat);
  openMoves(mine?.char||setup.picks[setup.seat],mine?.seat??setup.seat);
}
$('moves').onclick=currentGuide;
function help(){
  const inTraining=battle.state?.training || (screen==='home' && setup.mode==='training');
  const rule=inTraining?'木桩固定在原位，命中会累计连击和伤害。按 R 或点「复位」归零并回到起始位置。':'每人 3 条命。累积击飞值后，同一拳能把对手打得更远。掉出边界损失 1 条命，最后留在场上的斗士获胜。';
  const rows=[['移动','A / D','← / →'],['跳跃 / 二段跳','W','↑'],['快速下落 / 按住下穿平台','S','↓'],['地面三连','J › J › J','逗号连点三下'],['空中两连','W › J › J','↑ 后连点两下逗号'],['角色技能','K','句号 .'],['闪避','L','斜杠 /']];
  openModal('help','操作指南','<div class="help-row"><b>动作</b><b>玩家 1</b><b>玩家 2</b></div>'+rows.map(r=>'<div class="help-row"><span>'+r[0]+'</span><kbd>'+r[1]+'</kbd><kbd>'+r[2]+'</kbd></div>').join('')+
    '<button type="button" id="help-moves" class="guide-link guide-open">查看角色出招表 →</button><p class="notes">'+rule+'</p><p class="notes">按左或右会转身，松手保持朝向。移动中点技能可出前冲或远程招，按住下再点技能可出另一招。玩家 2 也可用键盘上排或小键盘 1 / 2 / 3 普攻、放技能和闪避。手机建议横屏，用左手移动、右手出招。</p>');
  if(screen==='battle')battle.help(true);
  $('help-moves').onclick=currentGuide;
}
$('help').onclick=help;
$('close-modal').onclick=()=>{if(!busy)closeModal();};
modal.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
modal.addEventListener('close',modalClosed);
modal.addEventListener('click',e=>{if(e.target===modal&&!busy)closeModal();});
function audioButton(){
  $('audio').innerHTML=icon(muted?'mute':'sound');
  $('audio').setAttribute('aria-label',muted?'开启音效':'关闭音效');$('audio').setAttribute('aria-pressed',String(!muted));
}
$('audio').onclick=()=>{muted=!muted;setMuted(muted);if(!muted)wakeAudio();try{localStorage.setItem('afterclass-muted',muted?'1':'0');}catch{}audioButton();};
$('full').onclick=async()=>{
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    else if(document.documentElement.webkitRequestFullscreen)document.documentElement.webkitRequestFullscreen();
    else notice('当前浏览器可横屏游玩。');
  }catch{notice('当前窗口暂不支持全屏。');}
};
for(const el of document.querySelectorAll('[data-icon]'))el.outerHTML=icon(el.dataset.icon);
audioButton();show('home');redraw();
lobbyDemo($('demo'),()=>[setup.picks[0],setup.picks[1]],()=>screen==='home');
const invite=roomCodeFromUrl();
if(invite){chooseMode('lan');openJoin(invite);}
else if(new URL(location.href).searchParams.get('mode')==='training'){
  const initial=new URL(location.href).searchParams.get('fighter');
  if(fighterIds.includes(initial))setup.picks[0]=initial;
  chooseMode('training');launch();
  document.addEventListener('keydown',wakeAudio,{once:true});
  document.addEventListener('pointerdown',wakeAudio,{once:true});
}

window.render_game_to_text=()=>{
  const g=battle.state, r=rooms.room;
  return JSON.stringify({screen,mode:setup.mode,paused:!!battle.paused,
    room:r?{code:r.code,phase:r.phase,host:r.host,clientId:r.clientId,players:r.players,joinUrl:r.joinUrl}:null,
    game:g?{training:!!g.training,tick:g.tick,phase:g.phase,countdown:g.countdown,winner:g.winner,players:g.players.map(p=>({
      id:p.id,name:p.name,char:p.char,slot:p.slot,bot:p.bot,x:Math.round(p.x),y:Math.round(p.y),facing:p.facing,action:p.action,move:p.move,moveName:p.moveName,combo:p.comboCount,guard:p.guard,dummy:!!p.dummy,damage:p.damage,stocks:p.stocks,kos:p.kos,grounded:p.grounded
    })),events:g.events.map(e=>({id:e.id,kind:e.kind,move:e.move,source:e.source,target:e.target}))}:null});
};
