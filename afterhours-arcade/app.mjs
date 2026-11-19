import { HEROES, WEAPONS, STAGES, createGame, stepGame } from './sim.mjs';
import { drawScene } from './render.mjs';
import { LanClient, getServerInfo } from './net.mjs';
import { readInput, resetInput, wireInput } from './controls.mjs';
import * as sound from './audio.mjs';
import { icon } from './icons.mjs';

const $=id=>document.getElementById(id);
const canvas=$('world'),ctx=canvas.getContext('2d'),dialog=$('modal');
const isPages=location.hostname.endsWith('.github.io');
const modes={solo:['solo','单人','一人闯六间房，自动瞄准，长按攻击连发。'],duo:['crew','同机双人','两人共用一把键盘。分别选人，并肩闯关。'],lan:['wifi','局域网','最多四人合作，同一 Wi-Fi 的手机和电脑都能加入。']};
const roles={kobe:'打板投射',iron:'推进穿透',jianguo:'近身反击'};
const picks=['kobe','iron'];
let mode='solo',seat=0,localCount=1,screen='home',room=null,game=null,networked=false,paused=false,lastStage=-1,terminal=false,modalKind='',busy=false;
let accumulated=0,lastRender=performance.now(),lastHud='',lastEventTick=-1,noteTimer,flashTimer;
let invite=new URLSearchParams(location.search).get('room')||'';
if(!/^\d{6}$/.test(invite))invite='';
const count=()=>mode==='duo'?2:mode==='lan'?localCount:1;
const client=new LanClient({onRoom:receiveRoom,onState:receiveState,onError:notice,onClose:message=>{goHome();notice(message||'主机连接已断开');}});
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
function screenTo(next){for(const id of ['home','lobby','battle'])$(id).hidden=id!==next;
 document.body.classList.toggle('playing',next==='battle');if(screen!==next)window.scrollTo(0,0);screen=next;}
function notice(msg){if(!msg)return;$('note').textContent=msg;$('note').classList.add('show');clearTimeout(noteTimer);noteTimer=setTimeout(()=>$('note').classList.remove('show'),3100);}
function closeModal(){if(dialog.open)dialog.close();modalKind='';}
function modal(kind,title,body,closable=true){modalKind=kind;$('modal-title').textContent=title;$('modal-body').innerHTML=body;$('modal-close').hidden=!closable;if(!dialog.open)dialog.showModal();}
function openHelp(){modal('help','操作手册','<div class="controls-line"><b>P1</b><span>W A S D 移动 · J 攻击 · K 技能 · L 闪避 · Q 换武器。也可用鼠标指向并按住左键射击。</span></div><div class="controls-line"><b>P2</b><span>方向键移动 · 1 攻击 · 2 技能 · 3 闪避 · 4 换武器。攻击、技能、闪避也可用逗号、句号、斜杠。</span></div><div class="controls-line"><b>触屏</b><span>左摇杆移动，右侧「击」「技」「闪」出招，「换」切换已取得的武器。横屏视野更宽。</span></div><p>按住攻击会自动瞄准附近敌人。靠近倒地队友可救起。击败钢胆侠后，到补给台选择武器，再去跑道找灭霸。</p>');}
function labelSound(){const muted=!sound.audible();$('sound').innerHTML=icon(muted?'mute':'speaker');$('sound').setAttribute('aria-label',muted?'开启声音':'关闭声音');$('sound').setAttribute('aria-pressed',String(!muted));}
$('sound').onclick=()=>{sound.toggle();labelSound();};labelSound();$('help').onclick=openHelp;
function dismiss(){if(modalKind==='result')return;if(modalKind==='pause'){paused=false;resetInput();lastRender=performance.now();}closeModal();}
$('modal-close').onclick=dismiss;dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});dialog.addEventListener('click',e=>{if(e.target===dialog)dismiss();});
function paintSetup(){
 const num=count();if(seat>=num)seat=0;
 $('seat-tabs').hidden=num<2;$('seat-tabs').innerHTML=num===2?picks.map((_,i)=>'<button data-seat="'+i+'" aria-pressed="'+(i===seat)+'">P'+(i+1)+'</button>').join(''):'';
 $('roster').innerHTML=Object.entries(roles).map(([id,role])=>{const chosen=picks.slice(0,num).map((p,i)=>p===id?'P'+(i+1):'').filter(Boolean).join('·');
  return '<button class="fighter '+(picks[seat]===id?'on':'')+'" data-id="'+id+'" aria-label="'+HEROES[id].name+'" aria-pressed="'+(picks[seat]===id)+'"><div class="face"><img src="art/'+id+'.webp" alt="">'+(chosen?'<span class="seat-pin">'+chosen+'</span>':'')+'</div><span class="card-info"><b>'+HEROES[id].name+'</b><small>'+role+'</small></span></button>';}).join('');
 const h=HEROES[picks[seat]];$('skill-name').textContent=h.skill;$('skill-detail').textContent=h.detail;
 $('modes').innerHTML=Object.entries(modes).map(([id,[ico,name]])=>'<button data-mode="'+id+'" aria-pressed="'+(mode===id)+'">'+icon(ico)+name+'</button>').join('');
 $('mode-detail').textContent=modes[mode][2];$('local-seats').hidden=mode!=='lan'||isPages;$('seat-count').value=String(localCount);
 $('join-link').hidden=mode!=='lan'||isPages||!!invite;$('launch').disabled=false;$('launch').innerHTML='<span>'+(mode==='lan'?(isPages?'查看联机方式':invite?'加入房间 '+invite:'创建合作房间'):mode==='duo'?'双人出击':'开始闯关')+'</span>'+icon('go');
}
$('roster').onclick=e=>{const b=e.target.closest('[data-id]');if(b){picks[seat]=b.dataset.id;paintSetup();sound.coin();}};
$('modes').onclick=e=>{const b=e.target.closest('[data-mode]');if(b){mode=b.dataset.mode;seat=0;paintSetup();}};
$('seat-tabs').onclick=e=>{const b=e.target.closest('[data-seat]');if(b){seat=Number(b.dataset.seat);paintSetup();}};
$('seat-count').onchange=e=>{localCount=Number(e.target.value);seat=0;paintSetup();};
function hostKit(){modal('kit','局域网合作','<p>由一台电脑开房。房主下载并完整解压主机包，双击包内对应系统的启动文件，在打开的游戏里选择「局域网」。</p><p>其他人连同一 Wi-Fi，用手机扫码或在浏览器打开房主给的链接，最多四人合作。</p><a class="cta" href="./afterhours-lan.zip" download>下载局域网主机包 ↓</a>');}
function joinForm(){modal('join','加入合作房间','<p>输入房主屏幕上的六位房间码。</p><input id="code-input" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000" aria-label="六位房间码"><div class="button-row"><button class="launch" id="confirm-join">加入房间</button></div>');const field=$('code-input');field.focus();$('confirm-join').onclick=()=>{const c=field.value.trim();if(!/^\d{6}$/.test(c)){notice('请输入六位数字');return;}closeModal();enter(c);};field.onkeydown=e=>{if(e.key==='Enter')$('confirm-join').click();};}
$('join-link').onclick=joinForm;
async function enter(code){if(busy)return;busy=true;$('launch').disabled=true;
 try{await getServerInfo();const choices=picks.slice(0,count());if(code)await client.join(code,choices);else await client.create(choices);}
 catch(e){notice(e.message||'无法连接主机');}finally{busy=false;$('launch').disabled=false;}}
$('launch').onclick=()=>{sound.coin();if(mode!=='lan')startLocal();else if(isPages)hostKit();else enter(invite);};
function clearBattle(){resetInput();lastStage=-1;lastEventTick=-1;lastHud='';terminal=false;paused=false;accumulated=0;lastRender=performance.now();clearTimeout(flashTimer);$('stage-flash').hidden=true;}
function startLocal(){closeModal();networked=false;room=null;clearBattle();game=createGame(picks.slice(0,count()));screenTo('battle');applyState(game);}
function goHome(){client.close();room=null;game=null;networked=false;clearBattle();closeModal();if(invite){invite='';history.replaceState(null,'',location.pathname);}screenTo('home');paintSetup();}
function receiveRoom(r){room=r;networked=true;
 if(r.phase==='lobby'){closeModal();if(screen!=='lobby'){clearBattle();game=null;}screenTo('lobby');paintRoom(r);}
 else if(r.phase==='playing'&&screen!=='battle'){closeModal();clearBattle();screenTo('battle');}
 if(r.phase==='ended'&&terminal&&modalKind==='result'&&game){terminal=false;showResult(game);}
 if(r.notice)notice(r.notice);
}
function paintRoom(r){
 const meHost=r.hostId===r.selfId;$('room-code').textContent=r.code;$('share-url').value=r.joinUrl;
 if($('qr').getAttribute('src')!==r.qrUrl)$('qr').src=r.qrUrl;
 $('room-members').replaceChildren();let i=0;for(const m of r.members)for(const hero of m.characters){const node=document.createElement('div');node.className='member';node.textContent='P'+(++i)+'  '+(HEROES[hero]?.name||hero)+(m.id===r.selfId?' · 本机':'')+(m.id===r.hostId?' · 房主':'');$('room-members').appendChild(node);}
 $('start-room').textContent=meHost?(i<2?'等待队友加入':'全队出击'):'等待房主开始';$('start-room').disabled=!meHost||i<2;
}
$('leave-room').onclick=goHome;$('start-room').onclick=()=>{sound.coin();client.start().catch(e=>notice(e.message));};
$('copy-room').onclick=async()=>{try{await navigator.clipboard.writeText(room.joinUrl);}catch{const f=$('share-url');f.focus();f.select();if(!document.execCommand('copy')){notice('已选中邀请链接，可长按复制');return;}}notice('邀请链接已复制');};
function receiveState(s){if(!room||screen==='home')return;if(screen!=='battle'){clearBattle();screenTo('battle');}game=s;applyState(s);}
function leaveFromBattle(){if(networked)client.close();goHome();}
function gameMenu(){if(screen!=='battle'||terminal||dialog.open)return;resetInput();paused=!networked;modal('pause',networked?'联机菜单':'游戏暂停','<p>'+(networked?'房间内的关卡继续进行。':'准备好后继续本局。')+'</p><div class="button-row"><button class="small-btn" id="exit-game">退出到选人</button><button class="launch" id="resume-game">继续闯关</button></div>'+((networked&&room?.selfId===room?.hostId)?'<button class="under" id="back-party">带全队回房间</button>':''));if($('back-party'))$('back-party').onclick=()=>client.backToLobby().catch(e=>notice(e.message));$('resume-game').onclick=dismiss;$('exit-game').onclick=leaveFromBattle;}
$('pause').onclick=gameMenu;
wireInput(canvas,()=>screen==='battle'&&!paused&&!terminal,gameMenu);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='battle'&&!networked&&!dialog.open&&!terminal)gameMenu();});
function showResult(s){if(terminal)return;terminal=true;resetInput();const won=s.phase==='won';const isHost=room?.selfId===room?.hostId;
 modal('result',won?'放学铃响了！':'全队倒下了','<p>'+(won?s.objective:'本次止步于「'+STAGES[s.stage].name+'」。')+'</p><div class="controls-line"><b>成绩</b><span>得分 '+s.score+' · 击败 '+s.kills+' 名敌人</span></div><div class="button-row"><button class="small-btn" id="result-home">返回选人</button>'+(networked&&!isHost?'':'<button class="launch" id="again">'+(networked?'返回房间':'再来一局')+'</button>')+'</div>',false);
 $('result-home').onclick=leaveFromBattle;if($('again'))$('again').onclick=()=>{if(networked)client.backToLobby().catch(e=>notice(e.message));else startLocal();};
}
function applyState(s){
 if(s.stage!==lastStage){const stage=STAGES[s.stage];lastStage=s.stage;$('stage-name').textContent=stage.name;$('stage-count').textContent='ROOM '+String(s.stage+1).padStart(2,'0')+' / '+String(STAGES.length).padStart(2,'0');$('stage-flash').textContent=stage.name;$('stage-flash').hidden=false;clearTimeout(flashTimer);flashTimer=setTimeout(()=>$('stage-flash').hidden=true,1150);
  $('pause').textContent=networked?'菜单':'暂停';$('play-keys').textContent=(count()===2?'P1  WASD / J K L　　P2  方向键 / 1 2 3　·　Q / 4 换武器':'WASD 移动 · 长按 J 攻击 · K 技能 · L 闪避 · Q 换武器')+'　｜　靠近倒地队友救援';}
 const objective=s.objective||STAGES[s.stage].tip;
 const hudKey=[s.score,objective,...s.players.map(p=>[p.hero,p.hp,p.down,p.disconnected,p.weapon,Math.ceil(p.skillCd/60)].join('/'))].join('|');
 if(hudKey!==lastHud){lastHud=hudKey;$('score').textContent=String(s.score||0).padStart(5,'0')+' 分';$('objective').textContent=objective;
  $('vitals').innerHTML=s.players.map((p,i)=>'<div class="vital '+(p.down?'down':'')+'"><em>P'+(i+1)+'</em><b>'+HEROES[p.hero].name+'</b><span class="life" aria-label="生命 '+p.hp+'"><b style="width:'+Math.max(0,Math.min(100,p.hp/p.maxHp*100))+'%"></b></span><span>'+(p.disconnected?'已离开':p.down?'待援':(WEAPONS[p.weapon]||'')+(p.skillCd>0?' · '+Math.ceil(p.skillCd/60)+'s':''))+'</span></div>').join('');}
 if(lastEventTick!==s.tick){sound.events(s.events);lastEventTick=s.tick;}
 if(s.phase==='won'||s.phase==='lost')showResult(s);
}
function inputs(s){const ids=networked?(room?.members.find(m=>m.id===room.selfId)?.seatIds||[]):s.players.map(p=>p.id);const out={};ids.forEach((id,i)=>{out[id]=dialog.open?{}:readInput(i,s.players.find(p=>p.id===id));});return out;}
function frame(t){const dt=Math.min(.15,(t-lastRender)/1000);lastRender=t;
 if(screen==='battle'&&game){if(networked){if(!terminal)client.input(inputs(game));}
 else if(!paused&&!terminal){accumulated+=dt;while(accumulated>=1/60){stepGame(game,inputs(game));applyState(game);accumulated-=1/60;if(terminal)break;}}
 const view=networked?(client.sample()||game):game;drawScene(ctx,view);}
 requestAnimationFrame(frame);}
if(invite)mode='lan';
paintSetup();requestAnimationFrame(frame);
window.render_game_to_text=()=>JSON.stringify({screen,mode,paused,room:room?{code:room.code,phase:room.phase,members:room.members.length}:null,game:game?{phase:game.phase,tick:game.tick,stage:game.stage,roomTick:game.roomTick,stageId:STAGES[game.stage].id,players:game.players.map(p=>({id:p.id,hero:p.hero,x:Math.round(p.x),y:Math.round(p.y),hp:p.hp,weapon:p.weapon,action:p.action,down:p.down})),boss:game.boss?{kind:game.boss.kind,hp:game.boss.hp,action:game.boss.action}:null,props:game.props.filter(o=>!o.hidden&&['rack','barrier','lace'].includes(o.kind)).map(({kind,x,y,w,h,weapon})=>({kind,x,y,w,h,weapon})),enemies:game.enemies.length,kills:game.kills,score:game.score,objective:game.objective}:null});
