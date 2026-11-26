import {prepareLan, mountLan} from './lan.mjs';

const stage=document.querySelector('#game-stage');
const loader=document.querySelector('#loading');
const label=document.querySelector('#progress');
const progress=loader.querySelector('progress');
const retry=document.querySelector('#retry');
const cabinet=document.querySelector('#cabinet');
let player;
const guest=/^[A-Z0-9]{6}$/i.test(new URLSearchParams(location.search).get('room') || '');
const pressed=new Map();
async function getJSON(path) {
  const response=await fetch(path);
  if (!response.ok) throw new Error('无法读取游戏配置。');
  return response.json();
}
// Keep player two usable on compact keyboards and with Num Lock off.
const heldP2=new Set();
function playerTwoKey(event, down) {
  if (guest || !player || typeof player.sendGameKey!=='function' || event.altKey || event.ctrlKey || event.metaKey) return;
  const match=/^(?:Digit|Numpad)([1-6])$/.exec(event.code);
  if (!match) return;
  const code=96+Number(match[1]);
  if (!heldP2.has(code) && document.activeElement!==player) return;
  event.preventDefault();event.stopImmediatePropagation();
  if(down){if(heldP2.has(code))return;heldP2.add(code);}
  else{if(!heldP2.delete(code))return;}
  player.sendGameKey(code,down);
}
window.addEventListener('keydown',event=>playerTwoKey(event,true),true);
window.addEventListener('keyup',event=>playerTwoKey(event,false),true);
window.addEventListener('blur',()=>{for(const code of heldP2)player?.sendGameKey?.(code,false);heldP2.clear();});
function loadScript(url) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('播放器下载失败，请重试。'));
    document.head.append(script);
  });
}
function key(code,down) {
  if (!player || !/^[WASDJKLUIO]$/.test(code)) return;
  const keyCode=code.charCodeAt(0);
  if(typeof player.sendGameKey==='function'){player.sendGameKey(keyCode,down);return;}
  const target=player.shadowRoot?.querySelector('canvas') || player;
  if (down) player.focus({preventScroll:true});
  target.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{key:code.toLowerCase(),code:'Key'+code,keyCode,which:keyCode,bubbles:true,cancelable:true,composed:true}));
}
for (const button of document.querySelectorAll('#touchpad [data-key]')) {
  button.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(pressed.has(e.pointerId)) return;
    const code=button.dataset.key;
    button.setPointerCapture(e.pointerId);button.classList.add('on');
    pressed.set(e.pointerId,{code,button});key(code,true);
  });
  const release=e=>{
    const input=pressed.get(e.pointerId);
    if (!input) return;
    pressed.delete(e.pointerId);key(input.code,false);input.button.classList.remove('on');
  };
  button.addEventListener('pointerup',release);
  button.addEventListener('lostpointercapture',release);
  button.addEventListener('pointercancel',release);
}
window.addEventListener('blur',()=>{
  for(const {code,button} of pressed.values()){key(code,false);button.classList.remove('on');}
  pressed.clear();
});
document.querySelector('#fullscreen').onclick=async()=>{
  if(document.fullscreenElement) await document.exitFullscreen();
  else if(cabinet.requestFullscreen) await cabinet.requestFullscreen();
  else if(cabinet.webkitRequestFullscreen) cabinet.webkitRequestFullscreen();
  player?.focus();
};
retry.onclick=()=>location.reload();
prepareLan();
if(guest){
  loader.hidden=true;
  document.querySelector('#touchpad').hidden=true;
  document.querySelector('details').open=true;
}
mountLan({container:document.querySelector('#lan-room'),player:()=>player,stage}).catch(()=>{});
getJSON('./roster.json').then(roster=>{
  const list=document.querySelector('#cast');
  for(const r of roster){
    const article=document.createElement('article'),img=document.createElement('img'),desc=document.createElement('span'),small=document.createElement('small');
    img.src='./faces/'+r.id+'.png';img.alt='';img.loading='lazy';
    desc.textContent=r.name;small.textContent=r.ultimate;
    desc.append(small);article.append(img,desc);list.append(article);
  }
});
async function boot(){
  const cfg=await getJSON('./release.json');
  const dl=document.querySelector('#download');if(cfg.download){dl.href=cfg.download;dl.hidden=false;}
  window.RufflePlayer=window.RufflePlayer || {};
  window.RufflePlayer.config={autoplay:'on',splashScreen:false,unmuteOverlay:'hidden',warnOnUnsupportedContent:false,allowScriptAccess:true,allowNetworking:'all',openUrlMode:'deny',publicPath:new URL(cfg.player,location.href).href.replace(/[^/]+$/,''),letterbox:'on',logLevel:'error',...cfg.ruffle};
  label.textContent='正在载入播放器…';
  await loadScript(cfg.player);
  player=window.RufflePlayer.newest().createPlayer();
  player.setAttribute('aria-label','游戏画面');stage.prepend(player);
  const api=player.ruffle();
  label.textContent='首次约 77 MB，正在读取游戏…';
  await api.load({url:new URL(cfg.movie,location.href).href,...cfg.load});
  loader.hidden=true;player.focus({preventScroll:true});
}
if(!guest) boot().catch(error=>{
  loader.hidden=false;
  loader.querySelector('strong').textContent='游戏载入失败';
  label.textContent=error.message;progress.hidden=true;retry.hidden=false;
});
