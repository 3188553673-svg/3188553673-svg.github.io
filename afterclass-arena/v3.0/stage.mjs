import {fighterStats, PLATFORMS, WORLD} from './engine.mjs';
import {drawTrainingRoom, drawTrainingDummy} from './training-art.mjs';
import { ASSIST_MOVES } from './moves.mjs';
import {drawFighter} from './fighters.mjs';
import {fighterFX, drawShot, eventFX} from './arena-effects.mjs';

const W=960, H=540;
const SLOT_COLORS=['#6bf1e8','#ffd274','#a9baff','#ff96b5'];
const REPLIES={doubao:'这道题，交给我。',jianguo:'听说有人欺负我家孩子？',rocket:'谁动了我的文具盒？',iron:'贾维斯，下课铃响了吗？',liangzi:'徒步出发！',xujingyu:'这球得这么打。',nailong:'我是奶龙！'};
const scenes=new WeakMap();
let scenery,roof;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,hi));

function box(c,x,y,w,h,color) {
  c.fillStyle=color;
  c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function polygon(c,points,color) {
  c.fillStyle=color;c.beginPath();
  c.moveTo(Math.round(points[0][0]),Math.round(points[0][1]));
  for (const [x,y] of points.slice(1)) c.lineTo(Math.round(x),Math.round(y));
  c.closePath();c.fill();
}
function roofImage() {
  if (!roof) {
    roof=new Image();
    roof.src=new URL('./art/roof.webp',import.meta.url).href;
  }
  return roof.naturalWidth>0?roof:null;
}
function topDeck(c,f) {
  const {x,y,w}=f, ink='#241d32';
  // The exposed front wall follows the platform exactly so both ledges read at a glance.
  box(c,x+14,y+15,w-28,650-y,ink);
  box(c,x+18,y+20,w-36,650-y,'#433548');
  for(let row=0;row<6;row++){
    const by=y+28+row*20;
    box(c,x+18,by,w-36,2,'#342a40');
    for(let bx=x+27+(row%2)*24;bx<x+w-19;bx+=49) box(c,bx,by+2,2,18,'#372e43');
  }
  for(const edge of [x+24,x+w-39]) {
    box(c,edge,y+19,14,650-y,ink);
    box(c,edge+2,y+19,7,650-y,'#645064');
    box(c,edge+2,y+20,2,650-y,'#90716e');
    for(let i=0;i<4;i++) box(c,edge-2,y+34+i*36,14,4,'#2d293b');
  }
  for(let i=0;68+i*96+70<w;i++) {
    const wx=x+68+i*96;
    box(c,wx,y+51,63,59,'#756077');
    box(c,wx+2,y+53,60,56,'#251e33');
    box(c,wx+6,y+57,52,45,i%3===0?'#b47d72':'#65556e');
    for(let blade=0;blade<7;blade++) {
      box(c,wx+7,y+59+blade*6,49,3,'#393149');
      box(c,wx+9,y+59+blade*6,41,1,i%3===0?'#e7a084':'#887185');
    }
    box(c,wx-3,y+107,68,3,'#715c6e');
  }
  box(c,x-2,y+2,w+4,18,ink);
  box(c,x,y,w,3,'#ffdb95');
  box(c,x,y+3,w,3,'#d69678');
  box(c,x+2,y+6,w-4,7,'#91656a');
  box(c,x+2,y+13,w-4,4,'#504257');
  box(c,x+7,y+17,w-14,3,'#2f263a');
  for(let i=x+15;i<x+w-8;i+=24) {
    box(c,i,y+5,1,7,'#724f59');
    box(c,i+1,y+7,3,1,'#b68078');
  }
  for(const edge of [x+3,x+w-38]) {
    box(c,edge,y-1,35,5,'#ffe3a1');
    for(let j=0;j<3;j++) box(c,edge+j*12,y+5,7,3,'#f8a255');
  }
  // No fencing runs along the front edge; players must see when they leave it.
}
function hoverDeck(c,f) {
  const {x,y,w}=f, end=x+w;
  polygon(c,[[x,y],[end,y],[end,y+8],[end-9,y+8],[end-14,y+15],[x+13,y+15],[x+7,y+8],[x,y+8]],'#251e34');
  box(c,x+2,y,w-4,3,'#ffe7ad');
  box(c,x+3,y+3,w-6,3,'#d69d84');
  box(c,x+6,y+6,w-12,3,'#8e6d78');
  box(c,x+13,y+9,w-26,3,'#514456');
  for(let i=12;i<w-9;i+=19) box(c,x+i,y+4,2,4,'#8b646d');
  for(const pivot of [x+14,end-30]){
    box(c,pivot,y+10,17,5,'#372f45');
    box(c,pivot+3,y+14,11,2,'#6ecec5');
    box(c,pivot+5,y+16,7,1,'#385d6b');
  }
}
function backdropProps(c,main) {
  const floor=main.y,ink='#41354d',metal='#705969',pale='#997275';
  const mast=main.x+145;
  box(c,mast-2,floor-147,5,146,ink);
  box(c,mast-28,floor-113,55,4,metal);
  for(let i=0;i<5;i++)box(c,mast-22+i*10,floor-124+i%2*3,2,20,metal);
  polygon(c,[[mast,floor-85],[mast+54,floor-80],[mast+34,floor-72],[mast,floor-74]],'#b95b52');
  for(const dx of [-1,1])polygon(c,[[mast,floor-60],[mast+26*dx,floor-1],[mast+23*dx,floor-1]],ink);
  const clock=main.x+main.w/2;
  box(c,clock-33,floor-87,5,88,ink);box(c,clock+28,floor-87,5,88,ink);
  box(c,clock-47,floor-113,94,34,ink);box(c,clock-43,floor-110,86,26,'#493d50');
  c.font='bold 16px monospace';c.textAlign='center';c.fillStyle='#d9a38a';c.fillText('17:30',clock,floor-91);
  const pump=main.x+main.w-136;
  box(c,pump-24,floor-47,6,47,ink);box(c,pump+20,floor-47,6,47,ink);
  box(c,pump-34,floor-97,68,49,ink);box(c,pump-30,floor-94,60,41,metal);
  polygon(c,[[pump-39,floor-97],[pump-28,floor-104],[pump+23,floor-104],[pump+39,floor-97]],metal);
  box(c,pump-27,floor-89,3,35,pale);box(c,pump-33,floor-69,66,4,'#544755');
  box(c,pump+25,floor-97,3,63,pale);
  for(let i=0;i<9;i++)box(c,pump+20,floor-91+i*7,10,2,'#534455');
}
function stageProps() {
  if(scenery)return scenery;
  const main=PLATFORMS[0], tile=document.createElement('canvas');
  tile.width=WORLD.width;tile.height=650;
  const c=tile.getContext('2d');
  backdropProps(c,main);
  for(const f of PLATFORMS)(f.main?topDeck:hoverDeck)(c,f);
  // Recessed jambs give the long roof three identifiable sections at close zoom.
  for(const [fraction,label] of [[.095,'西翼'],[.50,'中庭'],[.905,'东翼']]){
    const x=main.x+main.w*fraction,y=main.y+25;
    box(c,x-20,y,40,13,'#514052');
    c.textAlign='center';c.font='bold 9px system-ui';c.fillStyle='#d3a491';c.fillText(label,x,y+10);
  }
  scenery=tile;return tile;
}

function shadow(c,p,training) {
  if(p.action==='ko')return;
  const floor=(training?[PLATFORMS[0]]:PLATFORMS).filter(f=>p.x>=f.x && p.x<=f.x+f.w && f.y>=p.y-1).sort((a,b)=>a.y-b.y)[0];
  if(!floor || floor.y-p.y>155) return;
  const radius=Math.max(6,17-(floor.y-p.y)*0.061);
  c.save();c.globalAlpha=0.48-(floor.y-p.y)*0.002;
  box(c,p.x-radius,floor.y-2,radius*2,3,'#312334');box(c,p.x-radius+3,floor.y-3,radius*2-6,1,'#312334');c.restore();
}
function markers(c,players,localIds) {
  const markers=[];
  for (const p of players) {
    if(p.action==='ko'||p.y< -120)continue;
    const local=localIds.includes(p.id), label=p.dummy?'木桩':(p.bot?'CPU ':'P')+(p.slot+1);
    const color=SLOT_COLORS[p.slot]||SLOT_COLORS[0],width=p.bot?43:local?35:27;
    const x=Math.round(p.x-width/2);
    let y=Math.round(p.y-fighterStats(p).height-21);
    while(markers.some(r=>x<r.x+r.w+2 && x+width>r.x-2 && Math.abs(r.y-y)<14))y-=15;
    markers.push({x,y,w:width});
    box(c,x,y,width,13,'#211d2f');box(c,x,y,3,13,color);
    if(local){polygon(c,[[x+7,y+4],[x+11,y+7],[x+7,y+10]],color);}
    c.font='bold 10px monospace';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff3dd';
    c.fillText(label,x+width/2+(local?4:1),y+7);
    polygon(c,[[p.x-3,y+14],[p.x+3,y+14],[p.x,y+17]],color);
  }
}
function oneLiner(c,s,scene) {
  if(scene.lastTick>s.tick) {scene.spokenAt=-200;scene.speaker=null;}
  scene.lastTick=s.tick;
  if(!scene.speaker || s.tick-scene.spokenAt>70) {
    scene.speaker=null;
    if(s.tick-scene.spokenAt>250) {
      const e=s.events.find(e=>e.kind==='skill' && s.tick-e.tick<=3);
      if(e) {scene.speaker=e.source;scene.spokenAt=e.tick;}
    }
  }
  if(!scene.speaker)return;
  const p=s.players.find(p=>p.id===scene.speaker);
  if(!p || p.action==='ko' || p.y<110 || p.x<15 || p.x>WORLD.width-16)return;
  const text=REPLIES[p.char], alpha=clamp((70-(s.tick-scene.spokenAt))/12,0,1);
  c.save();c.font='600 12px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';
  const w=Math.ceil(c.measureText(text).width)+16;
  const x=clamp(Math.round(p.x-w/2),4,WORLD.width-w-4), y=Math.round(p.y-fighterStats(p).height-50);
  c.globalAlpha=alpha;
  box(c,x,y,w,22,'#2e2938');box(c,x+2,y+2,w-4,18,'#fff1d5');
  polygon(c,[[x+w/2-5,y+20],[x+w/2+4,y+20],[x+w/2,y+25]],'#2e2938');
  c.fillStyle='#382c3b';c.fillText(text,x+w/2,y+11);c.restore();
}

// All camera positions and combat geometry use world coordinates. Keep the
// entire group inside the inner rectangle even while the tracking springs ease.
const FULL={x:WORLD.centerX,y:WORLD.height*.46,z:.55};
function cameraTarget(s) {
  const live=s.players.filter(p=>p.action!=='ko' && p.stocks>0);
  if(!live.length)return {...FULL};
  if(s.phase==='countdown')return {x:WORLD.centerX,y:WORLD.height*.48,z:W/(PLATFORMS[0].w+150)};
  const left=Math.min(...live.map(p=>p.x)),right=Math.max(...live.map(p=>p.x));
  const top=Math.min(...live.map(p=>p.y-fighterStats(p).height)),bottom=Math.max(...live.map(p=>p.y));
  const cap=live.length>2?1.65:1.90;
  const z=Math.max(.48,Math.min(cap,(W-160)/(right-left+80),(H-170)/(bottom-top+70)));
  return {x:(left+right)/2,y:(top+bottom)/2-27/z,z,left,right,top,bottom};
}
function updateCamera(scene,s,reduce) {
  const target=cameraTarget(s),prev=scene.camera,reset=!prev||s.tick<scene.cameraTick||scene.cameraReduced!==reduce;
  if(!reset&&s.tick===scene.cameraTick)return prev;
  const dt=reset?1:clamp(s.tick-scene.cameraTick,1,12);
  let view;
  if(reduce){
    if((s.training||s.players.some(p=>p.dummy))&&target.left!==undefined){
      const z=Math.min(1.45,target.z),hw=W/(2*z),hh=H/(2*z);
      const base=prev&&!reset?prev:{x:WORLD.centerX,y:PLATFORMS[0].y-43};
      view={x:clamp(base.x,target.right+75/z-hw,target.left-75/z+hw),
        y:clamp(base.y,target.bottom+50/z-hh,target.top-85/z+hh),z};
    }else view={...FULL};
  }
  else if(reset||target.left===undefined)view={x:target.x,y:target.y,z:target.z};
  else{
    // Zooming out must keep pace with one-frame launches past either ledge.
    const z=target.z<prev.z?target.z:prev.z+(target.z-prev.z)*(1-Math.exp(-dt*.043));
    const track=1-Math.exp(-dt*.115),hw=W/(2*z),hh=H/(2*z);
    const x=clamp(prev.x+(target.x-prev.x)*track,target.right+55/z-hw,target.left-55/z+hw);
    const y=clamp(prev.y+(target.y-prev.y)*track,target.bottom+26/z-hh,target.top-72/z+hh);
    view={x,y,z};
  }
  scene.camera=view;scene.cameraTick=s.tick;scene.cameraReduced=reduce;return view;
}
export function getStageView(canvas){
  return {...(scenes.get(canvas)?.camera||FULL)};
}
export function renderStage(canvas,state,options={}) {
  if(!canvas || !state)return;
  const c=canvas.getContext('2d');
  if(!c)return;
  let scene=scenes.get(canvas);
  if(!scene) {scene={lastTick:-1,spokenAt:-200,speaker:null};scenes.set(canvas,scene);}
  const tick=state.tick,events=state.events||[],training=state.training||state.players.some(p=>p.dummy);
  const reduce=options.reducedMotion ?? (typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const view=updateCamera(scene,state,reduce);
  const shake=reduce?0:events.reduce((v,e)=>{
    const age=tick-e.tick;
    if (age<0 || age>10) return v;
    const size=e.kind==='ko'?5:e.kind==='blast'?3.5:e.kind==='hit'?Math.min(4.8,e.power*0.17+(e.launch>=13?2:0)):0;
    return Math.max(v,size*(1-age/11));
  },0);
  c.save();c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.imageSmoothingEnabled=false;
  c.fillStyle='#442f49';c.fillRect(0,0,W,H);
  if(shake)c.translate(Math.round(Math.sin(tick*2.8)*shake),Math.round(Math.cos(tick*2.14)*shake));
  const img=training?null:roofImage();
  if(training){
    box(c,-6,-6,W+12,H+12,'#344953');
  }else if(img){
    const bgWidth=W*1.28,bgHeight=H*1.12;
    const mx=clamp(view.x/WORLD.width,0,1),my=clamp(view.y/WORLD.height,0,1);
    c.drawImage(img,-8-(bgWidth-W)*mx,-5-(bgHeight-H)*my,bgWidth+16,bgHeight+10);
  }
  else {
    const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#df696e');g.addColorStop(0.53,'#ffae78');g.addColorStop(1,'#594563');
    c.fillStyle=g;c.fillRect(-6,-6,W+12,H+12);
  }
  // A cool wash keeps the much warmer skyline behind the playable silhouettes.
  if(!training)box(c,-6,-6,W+12,H+12,'rgba(44,32,65,.17)');
  c.translate(W/2,H/2);c.scale(view.z,view.z);c.translate(-view.x,-view.y);
  if(training)drawTrainingRoom(c,WORLD,PLATFORMS[0]);
  else c.drawImage(stageProps(),0,0);
  for(const p of state.players)shadow(c,p,training);
  for(const ally of state.assists||[]){
    const duration=ASSIST_MOVES[ally.char].frames, owner=state.players.find(p=>p.id===ally.owner);
    const alpha=clamp(Math.min((ally.age+2)/5,(duration-ally.age)/7),0,1);
    const actor={...ally,action:'skill',move:'assistCast',actionTick:ally.age};
    const color=SLOT_COLORS[owner?.slot]||SLOT_COLORS[0],height=fighterStats(actor).height;
    c.save();c.globalAlpha=.84*alpha;fighterFX(c,actor,height,tick,true);drawFighter(c,actor,tick);fighterFX(c,actor,height,tick,false);
    const ax=Math.round(ally.x),ay=Math.round(ally.y-height-10);
    c.font='bold 9px sans-serif';c.textAlign='center';c.textBaseline='middle';
    box(c,ax-11,ay-5,22,11,'#282534');box(c,ax-11,ay-5,2,11,color);c.fillStyle='#fff4d8';c.fillText('援',ax,ay+1);
    c.restore();
  }
  for(const q of state.projectiles)drawShot(c,q,tick);
  for(const p of state.players)if(p.action!=='ko'){
    if(p.dummy)drawTrainingDummy(c,p,tick,events,reduce);
    else {fighterFX(c,p,fighterStats(p).height,tick,true);drawFighter(c,p,tick);fighterFX(c,p,fighterStats(p).height,tick,false);}
  }
  for(const e of events)eventFX(c,e,tick-e.tick);
  markers(c,state.players,options.localIds||[]);
  if(!training)oneLiner(c,state,scene);
  c.restore();
}
