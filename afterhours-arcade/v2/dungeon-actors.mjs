import {box,line,ellipse,poly,type,plus} from './pixel-tools.mjs';
const ink='#232438', pale='#ffe7b7';
function shadow(c,x,y,rx){ellipse(c,x,y+1,rx,rx*.3,'#20202c5c');}
function outline(c,coords,fill,edge=ink){poly(c,coords,fill,edge);}
function pulse(t,speed=.12){return (1+Math.sin(t*speed))*.5;}
function star(c,x,y,r,col){poly(c,[x,y-r,x+r*.32,y-r*.30,x+r,y,x+r*.26,y+r*.23,x,y+r,x-r*.30,y+r*.25,x-r,y,x-r*.28,y-r*.25],col);}
function dragonBody(c,mirror,action,frame){
  const dark=mirror?'#915a50':'#a56c32', amber=mirror?'#f1ab57':'#f3b92f', lit=mirror?'#ffd189':'#ffe071';
  const skin=mirror?'#ffd077':'#ffcf3e', underskin=mirror?'#e29b60':'#e7a52a';
  const running=action==='run'||action==='copyRush',stride=running?Math.round(Math.sin(frame*.28)*2):0;
  if(action==='bellyRoll'||action==='copyRush'){
    ellipse(c,0,-10,14,13,ink);ellipse(c,0,-10,13,12,amber);
    c.save();c.translate(0,-10);c.rotate(frame*.35);ellipse(c,1,0,8,7,lit);
    ellipse(c,3,-4,2,3,'#4d622d');ellipse(c,7,-2,2,2,ink);
    box(c,-10,-3,2,7,underskin);box(c,-9,4,3,2,dark);c.restore();return;
  }
  const bob=action==='bellyDrop'?-7:Math.floor(pulse(frame,.1)*1.8)-1;
  c.translate(0,bob);
  // Amber pear body and over-sized eyes are taken from the approved playable portrait.
  ellipse(c,-6,-1+stride,5,3,ink);ellipse(c,7,-1-stride,5,3,ink);
  ellipse(c,-6,-2+stride,4,2,underskin);ellipse(c,7,-2-stride,4,2,amber);
  ellipse(c,0,-11,11,14,ink);ellipse(c,0,-11,10,13,dark);
  ellipse(c,0,-12,9,12,amber);ellipse(c,1,-9,7,7,lit);
  ellipse(c,-8,-11,4,5,ink);ellipse(c,-8,-12,3,4,amber);
  ellipse(c,9,-12,4,5,ink);ellipse(c,9,-13,3,4,skin);
  // Head narrows at the top and flares out into the cheeks.
  outline(c,[-11,-16,-13,-19,-12,-25,-9,-30,-5,-34,0,-36,5,-34,8,-32,11,-27,13,-22,12,-17,8,-14,1,-13,-6,-14],dark);
  poly(c,[-11,-20,-10,-25,-7,-30,-3,-33,2,-34,6,-32,9,-28,11,-22,11,-18,7,-16,0,-15,-6,-16],amber);
  poly(c,[-9,-24,-6,-29,-2,-32,3,-32,7,-29,10,-24,9,-19,5,-17,-2,-17,-8,-19],skin);
  box(c,-6,-29,2,1,lit);box(c,-4,-31,4,1,lit);
  for(const [x,y] of [[-4,-24],[6,-25]]){
    ellipse(c,x,y,3.1,3.9,'#866740');ellipse(c,x,y,2.65,3.3,'#e7ecd2');
    ellipse(c,x+.5,y,1.9,2.7,mirror?'#776284':'#627c32');ellipse(c,x+.82,y+.3,1.25,1.9,ink);
    box(c,x+.3,y-2.4,1,1,'#fffcef');
  }
  ellipse(c,2,-19,1.45,1.95,'#754427');
  if(mirror){
    // The impostor wears a reversible cafeteria apron and a crooked order ticket.
    poly(c,[-8,-13,-4,-15,1,-12,6,-15,9,-13,7,-10,7,-6,-6,-5,-7,-10],'#986c98',ink);
    box(c,-7,-13,2,3,'#c6a1c0');box(c,4,-12,3,3,'#cdb4c5');box(c,-2,-10,4,3,'#e7d0bb');
    poly(c,[-2,-34,6,-37,7,-34,0,-31],'#e9d3ad');box(c,2,-35,3,1,'#9d635e');
  }
}
export function dragon(c,x,y,t,opt={}){
  const scale=opt.scale||1.38,mirror=!!opt.mirror, action=opt.action||'idle';
  c.save();c.translate(Math.round(x),Math.round(y));c.scale((opt.face||1)*scale,scale);
  if(action==='down'){c.rotate(-1.2);c.translate(1,4);}
  if(mirror&&['copyTell','copyRush','copyVolley'].includes(action)){
    c.save();c.translate(-3,1);c.globalAlpha=.32;dragonBody(c,true,action,t-2);c.restore();
  }
  dragonBody(c,mirror,action,t);
  if(opt.flash>0)plus(c,0,-19,6,pale);
  c.restore();
}
export function dragonPortrait(c,x,y,size){
  c.save();c.translate(x,y);c.beginPath();c.rect(0,0,size,size);c.clip();c.scale(size/48,size/48);
  box(c,0,0,48,48,'#805947');
  for(let n=-25;n<60;n+=8)poly(c,[n,48,n+31,0,n+34,0,n+3,48],'#9a7254');
  dragon(c,22,77,1,{scale:2.05});c.restore();
}
export function helicopter(c,b,tick){
  const x=b.x,y=b.y,f=b.dx<-.2?-1:1,alert=b.action==='windup',stun=b.action==='stunned';
  shadow(c,x,y,34);const bob=stun?0:Math.sin(tick*.095)*2;
  c.save();c.translate(Math.round(x),Math.round(y-17+bob));c.scale(f*1.45,1.45);
  // Coin-operated ride: capped landing skids, red coin slot, toy tail and bubble canopy.
  line(c,-14,0,-12,7,ink,3);line(c,11,-1,14,7,ink,3);line(c,-18,7,17,7,ink,3);line(c,-16,6,17,6,'#8c9791',1);
  outline(c,[-33,-20,-25,-19,-17,-14,-6,-14,-2,-8,-18,-9,-32,-15],'#c1654c');
  outline(c,[-34,-26,-30,-26,-25,-16,-30,-15],'#d98956');box(c,-31,-22,3,3,'#eab27c');
  outline(c,[-17,-19,-12,-26,-5,-30,4,-29,11,-25,16,-20,21,-14,21,-8,17,-3,10,0,-9,0,-16,-5,-19,-12],'#b85746');
  poly(c,[-13,-19,-9,-24,-2,-27,4,-26,10,-22,13,-18,16,-14,16,-11,-14,-11],'#719598');
  poly(c,[5,-24,10,-21,14,-15,11,-15,7,-18],'#c0dfce');
  // Fictional sports-show pilot, with a white peaked cap and orange headset.
  box(c,-6,-23,10,9,'#3f4350');box(c,-4,-23,8,7,'#d8a378');box(c,1,-21,3,2,'#344555');
  box(c,-6,-25,11,3,'#e1d8b7');box(c,-4,-27,7,3,'#eee3c9');box(c,-7,-23,2,5,'#e9a34e');box(c,3,-23,4,1,'#4b4d51');
  poly(c,[-17,-12,-8,-10,6,-9,19,-13,20,-8,16,-5,7,-4,-9,-5,-17,-8],'#e98d5c');
  box(c,-11,-6,7,5,'#f1b25b');box(c,-10,-5,4,1,'#643f43');box(c,8,-7,7,2,'#e5dbb2');
  box(c,-5,-32,4,5,'#334550');box(c,-8,-33,11,2,'#8c9b94');
  const reach=12+Math.abs(Math.sin(tick*.82))*20;box(c,-3-reach,-34,reach*2,2,stun?'#8b8b80':'#c4c7a6');
  box(c,-3,-35,4,3,ink);box(c,reach-9,-34,5,2,'#d49157');
  if(alert){box(c,-16,-21,2,4,'#ffe58b');plus(c,-18,-20,3,'#ffb17b');}
  if(stun)for(let i=0;i<3;i++){let a=tick*.09+i*2.1;star(c,Math.cos(a)*13,-34+Math.sin(a)*3,2,'#ffdb83');}
  if(b.flash>0)plus(c,0,-11,6,pale);c.restore();
  if(b.hoopX!=null&&b.hoopY!=null){
    c.save();c.setLineDash([3,3]);line(c,x,y-13,b.hoopX,b.hoopY-10,'#dbbd8d',1.5);c.restore();
  }
}
export function hoop(c,p,tick){
  const x=p.x,y=p.y,r=Math.max(9,Math.min(18,p.r||14));
  ellipse(c,x,y+2,r*.88,3,'#29313e4f');
  line(c,x+2,y-13,x+9,y-19,'#6c7e7d',3);box(c,x-6,y-24,20,8,ink);
  box(c,x-4,y-23,16,6,'#e2c796');box(c,x,y-21,8,3,'#c17d64');
  for(let i=-2;i<=2;i++){line(c,x+i*r*.35,y-10,x+i*r*.21,y-1,'#e1d4ad');}
  ellipse(c,x,y-10,r*.71,3,'#e98353',2.5);box(c,x-3,y,6,1,'#e0d1a6');
}
export function cart(c,p,tick){
  const w=p.w||64,h=p.h||42,x=p.x-w/2,y=p.y-h/2,flash=p.flash>0;
  box(c,x+2,y+4,w,h,'#313c4052');box(c,x+3,y+h-5,8,7,ink);box(c,x+w-12,y+h-5,8,7,ink);
  box(c,x,y-3,w,h-3,ink);box(c,x+2,y-1,w-4,h-19,'#9cb3a6');
  box(c,x+2,y+h-19,w-4,12,flash?'#edd4a2':'#578379');box(c,x+4,y+h-17,w-8,2,'#b5c8b3');
  for(let i=0;i<2;i++){const dx=x+6+i*(w*.46);box(c,dx,y+2,w*.36,h*.38,'#5f7773');box(c,dx+2,y+4,w*.36-4,h*.38-4,i?'#b58355':'#a9a66b');}
  box(c,x+w-3,y+3,5,3,'#d7cba8');box(c,x+7,y+h-11,12,2,'#3e665e');if(flash)star(c,p.x,p.y-9,5,'#ffe39c');
}
export function drawWeapon(c,kind,x,y,dx=1,dy=0,size=1,t=0){
  if(kind==='basket'||kind==='pulse'||kind==='stamp'||!kind)return false;
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(dx<0?-size:size,size);
  const tilt=Math.atan2(dy,Math.max(.3,Math.abs(dx)));c.rotate(tilt*.42);
  if(kind==='tray'){
    ellipse(c,4,0,7.5,3.1,ink);ellipse(c,4,-.5,6.4,2.2,'#a8c4c5');line(c,0,-1,7,-1,'#e5e7cf',1);
  }else if(kind==='bell'){
    outline(c,[-2,2,0,0,1,-4,3,-6,6,-5,7,0,10,2],'#e0ae57');box(c,0,2,8,1,'#ffe09a');box(c,3,-7,2,2,'#9e7a4c');
  }else if(kind==='milk'){
    outline(c,[-3,-2,1,-5,5,-5,8,-2,8,2,5,4,0,4,-3,2],'#d9eada');box(c,-1,-2,6,3,'#95cdbb');box(c,7,-3,3,4,'#e4ac77');box(c,10,-2,2,2,'#fff7d2');
  }else if(kind==='wrap'){
    outline(c,[-2,0,0,-3,7,-4,10,-2,11,1,9,4,1,3],'#deb473');box(c,7,-3,2,5,'#a66045');box(c,9,-1,2,3,'#89a34e');
  }else if(kind==='chalk'){
    outline(c,[-2,-1,0,-4,6,-4,8,-1,7,4,0,4,-2,2],'#70a5ab');box(c,7,-3,6,2,'#f7d1b4');box(c,7,0,5,2,'#b0e4d3');box(c,1,2,3,4,'#627c80');
  }else if(kind==='rollcall'){
    outline(c,[-2,-4,6,-6,10,-4,10,4,2,6,-2,3],'#9365a3');box(c,1,-2,6,2,'#f2dfbc');box(c,0,2,8,2,'#bd93b8');
  }else if(kind==='slipper'){
    outline(c,[-3,0,2,-4,8,-3,11,0,10,2,2,4,-2,3],'#d5824c');box(c,3,-2,4,5,'#f2bb72');box(c,3,0,3,1,'#8a665d');
  }else if(kind==='horn'){
    outline(c,[-3,-2,2,-2,9,-8,10,6,2,2,-3,2],'#ce879c');box(c,1,1,3,4,'#8e617d');box(c,8,-5,2,9,'#eec5af');
  }else{c.restore();return false;}
  c.restore();return true;
}
export function newProjectile(c,p,tick){
  const x=p.x,y=p.y-11-(p.z||0),r=Math.max(2,p.r||5),a=Math.atan2(p.vy||0,p.vx||1);
  if(p.kind==='bellyRing'){
    const u=Math.max(.1,p.timer/Math.max(1,p.life));
    c.save();c.globalAlpha=1-u*.8;ellipse(c,p.x,p.y,r*u,r*u,'#ffdb71',3);ellipse(c,p.x,p.y,r*u*.87,r*u*.87,'#fff0a4',1);c.restore();
  }else if(p.kind==='courtball'){
    const hit=p.deflected||p.team==='player';
    ellipse(c,p.x,p.y+1,r*1.05,r*.33,'#3c3c454a');
    c.save();c.translate(x,y);c.rotate(tick*.15);
    ellipse(c,0,0,r,r,hit?'#326858':'#6a4d42');ellipse(c,0,-.5,r*.82,r*.82,hit?'#8ed7a6':'#e89955');
    line(c,-r*.8,2,r*.8,-2,'#855541',1.4);line(c,-2,-r*.8,2,r*.8,'#805640',1.4);c.restore();
  }else if(p.kind==='milk'){
    c.save();c.translate(x,y);c.rotate(a);ellipse(c,0,0,r,r*.64,'#b5d0c7');ellipse(c,1,-1,r*.73,r*.44,'#fff3d9');box(c,-r-3,-1,3,2,'#d8e9ce');c.restore();
  }else if(p.kind==='chalk'){
    c.save();c.translate(x,y);c.rotate(a);box(c,-6,-2,12,4,'#d8cfc5');box(c,-5,-1,8,2,'#fff0cd');c.restore();
  }else if(['slipper','wrap','rollcall'].includes(p.kind)){
    c.save();c.translate(x,y);c.rotate(tick*.15);drawWeapon(c,p.kind,0,0,1,0,Math.max(.8,r/7));c.restore();
  }else if(p.kind==='hornWave'){
    const progress=(p.timer||0)/Math.max(1,p.life||17),range=Math.max(8,r*progress);
    c.save();c.translate(x,y);c.rotate(Math.atan2(p.dy||0,p.dx||1));c.globalAlpha=1-progress*.72;c.strokeStyle='#ed9fe7';c.lineWidth=2;
    for(let k=0;k<2;k++){c.beginPath();c.arc(0,0,range*(1-k*.15),-.88,.88);c.stroke();}c.restore();
  }else if(p.kind==='ticket'||p.kind==='copyShot'){
    c.save();c.translate(x,y);c.rotate(a);box(c,-r,-r*.50,2*r,r,p.kind==='ticket'?'#cb8e57':'#aa71b2');box(c,-r+2,-r*.4,1.6*r,r*.7,p.kind==='ticket'?'#f2cf8a':'#e8b1d1');line(c,0,-r*.4,0,r*.4,'#8e6b79');c.restore();
  }else return false;
  return true;
}
export function copyTell(c,b,tick){
  if(b.action!=='copyTell')return;
  const name={roll:'滚',shot:'击',skill:'技'}[b.copyMove]||'仿';
  const x=b.x+14,y=b.y-73;box(c,x-10,y-9,21,17,ink);box(c,x-8,y-7,17,12,'#a37ba7');
  type(c,name,x,y+2,'#ffedcc',11,'center');
  if(Number.isFinite(b.targetX)&&Number.isFinite(b.targetY)){
    c.save();c.setLineDash([4,6]);line(c,b.x,b.y,b.targetX,b.targetY,'#e2a8c6',1.8);c.restore();
    ellipse(c,b.targetX,b.targetY,12+pulse(tick)*2,5,'#e8aec7',1.5);
  }
}
export function crosswind(c,h,tick){
  const x=h.x??35,y=h.y??96,w=h.w||890,hh=h.h||390,dir=h.dx<0?-1:1,before=h.timer<h.warn;
  c.save();c.beginPath();c.rect(x,y,w,hh);c.clip();box(c,x,y,w,hh,before?'#ecc78713':'#a2e3df19');
  const shift=before?0:(tick*.95)%99;
  for(let yy=y+18;yy<y+hh;yy+=36){
    for(let xx=x-102+shift*dir;xx<x+w+80;xx+=99){
      const cx=xx+((Math.round(yy)/36)%2)*12,alpha=before?'#e5b97799':'#c6eee0ac';
      line(c,cx-dir*12,yy,cx+dir*9,yy,alpha,2);
      line(c,cx+dir*4,yy-3,cx+dir*9,yy,alpha,2);line(c,cx+dir*4,yy+3,cx+dir*9,yy,alpha,2);
    }
  }
  c.restore();
}

export function spitter(c,e,t){
  const f=e.dx<0?-1:1,charging=e.action==='windup',bob=charging?0:Math.sin(t*.15)*1.4;
  c.save();c.translate(e.x,e.y);c.scale(f,1);
  for(const x of [-7,3]){box(c,x,-7,4,6,'#483e50');box(c,x-1,-2,7,2,'#d9b8a3');}
  c.translate(0,bob);box(c,-10,-22,16,14,ink);box(c,-9,-21,14,12,'#986277');box(c,-6,-18,5,7,'#585872');
  outline(c,[-3,-19,4,-20,13,-27,14,-8,5,-14,-2,-13],'#c58292');box(c,11,-24,2,13,'#f0b29f');box(c,1,-13,4,3,'#7c6175');
  box(c,-8,-25,7,4,ink);box(c,-7,-24,4,2,charging?'#ffd177':'#b1d5c7');
  if(charging)plus(c,15,-18,3,'#ffbcaa');if(e.flash>0)plus(c,0,-17,5,'#f6e5b9');c.restore();
}
