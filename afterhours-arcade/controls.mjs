const keys=new Set(), touches={attack:false,skill:false,dash:false,swap:false,x:0,y:0};
const k1={left:['KeyA'],right:['KeyD'],up:['KeyW'],down:['KeyS'],attack:['KeyJ','Space'],skill:['KeyK'],dash:['KeyL','ShiftLeft'],swap:['KeyQ']};
const k2={left:['ArrowLeft'],right:['ArrowRight'],up:['ArrowUp'],down:['ArrowDown'],attack:['Comma','Digit1','Numpad1'],skill:['Period','Digit2','Numpad2'],dash:['Slash','Digit3','Numpad3'],swap:['Digit4','Numpad4']};
const playCodes=new Set([...Object.values(k1).flat(),...Object.values(k2).flat(),'Escape']);
let mouse=null,shooting=false,mouseMode=false,stickId=null;
const handles=new Map();
export function resetInput(){
 keys.clear();mouse=null;shooting=false;mouseMode=false;stickId=null;handles.clear();Object.assign(touches,{attack:false,skill:false,dash:false,swap:false,x:0,y:0});
 document.querySelectorAll('.touch-actions button').forEach(b=>b.classList.remove('active'));
 document.querySelector('.stick b').style.transform='translate(-50%,-50%)';
}
export function wireInput(canvas,playing,onPause){
 const captured=()=>playing()&&!document.querySelector('dialog[open]');
 window.addEventListener('keydown',e=>{
  if(!captured()||!playCodes.has(e.code)) return;
  e.preventDefault();if(e.code==='Escape'){if(!e.repeat)onPause();return;}
  if(k1.attack.includes(e.code))mouseMode=false;
  keys.add(e.code);
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',resetInput);
 const track=e=>{const r=canvas.getBoundingClientRect();mouse={x:(e.clientX-r.left)*960/r.width,y:(e.clientY-r.top)*540/r.height};};
 canvas.addEventListener('pointermove',e=>{if(captured()&&e.pointerType==='mouse'){track(e);if(shooting)mouseMode=true;}});
 canvas.addEventListener('pointerdown',e=>{if(!captured()||e.pointerType!=='mouse'||e.button!==0)return;track(e);mouseMode=true;shooting=true;canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{shooting=false;});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 const stick=document.querySelector('#stick'),nub=stick.querySelector('b');
 const move=e=>{const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width*.39),dy=(e.clientY-r.top-r.height/2)/(r.height*.39);const n=Math.max(1,Math.hypot(dx,dy));touches.x=dx/n;touches.y=dy/n;nub.style.transform='translate(calc(-50% + '+touches.x*r.width*.29+'px),calc(-50% + '+touches.y*r.height*.29+'px))';};
 stick.addEventListener('pointerdown',e=>{if(stickId!==null)return;stickId=e.pointerId;stick.setPointerCapture(e.pointerId);move(e);e.preventDefault();});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)move(e);});
 const releaseStick=e=>{if(e.pointerId===stickId){stickId=null;touches.x=touches.y=0;nub.style.transform='translate(-50%,-50%)';}};
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,releaseStick);
 document.querySelectorAll('[data-act]').forEach(b=>{
  const k=b.dataset.act;
  b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);handles.set(e.pointerId,k);touches[k]=true;mouseMode=false;b.classList.add('active');e.preventDefault();});
  const release=e=>{handles.delete(e.pointerId);touches[k]=[...handles.values()].includes(k);b.classList.toggle('active',touches[k]);};
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,release);
 });
}
export function readInput(index,actor){
 const layout=index===0?k1:k2;const has=k=>layout[k].some(code=>keys.has(code));
 const m={x:Number(has('right'))-Number(has('left')),y:Number(has('down'))-Number(has('up')),attack:has('attack'),skill:has('skill'),dash:has('dash'),swap:has('swap')};
 if(index===0){
  if(touches.x||touches.y){m.x=touches.x;m.y=touches.y;}
  m.attack||=touches.attack||shooting;m.skill||=touches.skill;m.dash||=touches.dash;m.swap||=touches.swap;
  if(mouseMode&&mouse&&actor){const x=mouse.x-actor.x,y=mouse.y-actor.y,n=Math.hypot(x,y);if(n>2){m.aimX=x/n;m.aimY=y/n;}}
 }
 return m;
}
