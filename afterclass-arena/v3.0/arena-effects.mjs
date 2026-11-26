import { ASSIST_MOVES, FIGHTER_NORMALS, MOVES } from './moves.mjs';
// Effects deliberately use short-lived, opaque clusters so feet, hitboxes and
// the opponent's silhouette remain readable underneath a four-player exchange.
const themes = {
 doubao:['#58deed','#d6fff8','#257aa1'], jianguo:['#bf87fc','#ffebca','#803b94'],
 rocket:['#ff9648','#fff0a0','#925345'], iron:['#46c9ff','#efffff','#3860af'],
 liangzi:['#f4a856','#ffefac','#a86339'], xujingyu:['#53ccb9','#deffed','#416985'],
 nailong:['#ffce55','#fff5c2','#e9824c']
};
function palette(id){return themes[id]||themes.doubao;}
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function shape(c,points,color){
 c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();
}
function ring(c,x,y,rx,ry,color,width=2,start=0,end=Math.PI*2){
 c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(Math.round(x),Math.round(y),Math.max(1,rx),Math.max(1,ry),0,start,end);c.stroke();
}
function arc(c,x,y,r,stretch,from,to,width,color) {
 const pts=[], n=13;
 for(let i=0;i<=n;i++){let a=from+(to-from)*i/n;pts.push([x+Math.cos(a)*r,y+Math.sin(a)*r*stretch]);}
 for(let i=n;i>=0;i--){let a=from+(to-from)*i/n;let inner=r-Math.sin(Math.PI*i/n)*width;pts.push([x+Math.cos(a)*inner,y+Math.sin(a)*inner*stretch]);}
 shape(c,pts,color);
}
function spark(c,id,age,size,color) {
 const prongs=7,pts=[];
 for(let i=0;i<prongs*2;i++){
  const a=i*Math.PI/prongs+id*.37, l=i%2?size*.17:size*(.70+((id+i*7)%11)*.038);
  pts.push([Math.cos(a)*l*1.15,Math.sin(a)*l]);
 }
 shape(c,pts,color);
}
export function fighterFX(c,p,height,tick,before){
 const phase=p.action, t=p.actionTick||0;
 const skill=p.move==='assistCast'?ASSIST_MOVES[p.char]:p.move==='assist'?null:MOVES[p.char]?.[p.move];
 const move=skill?.pose||p.move;
 const [accent,light,shade]=palette(p.char);
 c.save();c.translate(Math.round(p.x),Math.round(p.y));c.scale(p.facing||1,1);
 if(before){
  if(p.awakened>0){
    const surge=3+Math.sin(tick*.14)*2;
    if(p.char==='iron'){
      ring(c,0,-height*.48,25+surge,30+surge,accent,2,-2.65,-1.45);
      ring(c,0,-height*.48,25+surge,30+surge,light,2,.55,1.55);
      for(let i=0;i<3;i++){const y=-((tick*1.6+i*22)%height);rect(c,i%2?23:-23,y,2,6,i%2?light:accent);}
    }else if(p.char==='nailong'){
      for(let i=0;i<4;i++){
        const rise=(tick+i*15)%57, x=(i%2?1:-1)*(18+Math.sin((tick+i)*.16)*4);
        ring(c,x,-rise,3+i%2,3+i%2,i%2?light:accent,2);
      }
    }
  }
  if(skill?.cost>=100&&phase==='skill'&&t<10){
    const charge=skill.cost===300?31:22, r=charge+t*1.4;
    c.globalAlpha=.75*(1-t/12);arc(c,0,-height*.42,r,.84,-3+t*.2,-1.25+t*.2,3,accent);
    arc(c,0,-height*.42,r,.84,.15+t*.2,1.95+t*.2,2,light);
    c.globalAlpha=1;
  }
  const launch=phase==='hurt' && Math.abs(p.vx)>5;
  const burst=phase==='dodge'||(move==='qcf'&&['liangzi','nailong','iron','jianguo'].includes(p.char)&&phase==='skill'&&t>3&&t<19);
  if(launch||burst){
   const sign=Math.sign(p.vx*p.facing)||1, bands=launch&&Math.abs(p.vx)>12?7:4;
   for(let i=0;i<bands;i++){
    const distance=13+(t*4+i*11)%39,x=-sign*distance,y=-height*.3-(i%4)*height*.12;
    const rise=launch?p.vy/Math.max(4,Math.abs(p.vx))*distance:0;
    rect(c,x-(sign>0?9:0),y-rise,7+i%3*4,2,i%3?accent:light);
   }
  }
  if(phase==='guard'||phase==='counter'&&t<11){
    c.globalAlpha=.25;
    arc(c,7,-height*.46,24,1.05,-1.50,1.5,7,accent);
    c.globalAlpha=.82;arc(c,7,-height*.46,24,1.05,-1.25,1.20,2,light);
  }
 }else if(phase==='attack'||phase==='counter'){
   const normal=FIGHTER_NORMALS[p.char]?.[move];
   const reach=39+(normal?.reach??13);
   const wind=normal?.start??4;
   const age=phase==='counter'?t-13:t-wind;
   if(age>=-2 && age<=6){
     const heavy=move==='finisher'||move==='heavy'||phase==='counter',sweep=move==='sweep',air=move==='air'||move==='airFinish';
     const y=sweep?-7:-height*(air?.53:.49), delta=age*.28, end=reach+Math.min(4,age)*2;
     c.globalAlpha=Math.min(.92,Math.max(.15,1-Math.abs(age-1)*.14));
     if(age<0){
       if(heavy){rect(c,12,y-2,12,2,accent);rect(c,8,y+3,6,1,light);}
     }else if(sweep){
       arc(c,7,-6,reach*.86,.23,-2.5+delta,.76+delta,10,accent);arc(c,7,-6,reach*.89,.23,-2.25+delta,.53+delta,4,light);
       rect(c,end-9,-2,9,2,'#fae1a4');
     }else if(air||move==='follow'){
       const tilt=air?.3:-.3;
       arc(c,13,y,reach*.84,air?.80:.66,-1.68+delta+tilt,.85+delta+tilt,8,accent);
       arc(c,13,y,reach*.90,air?.80:.66,-1.5+delta+tilt,.68+delta+tilt,3,light);
     }else{
       shape(c,[[13,y-8],[end-15,y-6],[end+1,y-2],[end-17,y+1],[15,y]],accent);
       shape(c,[[15,y-5],[end-13,y-4],[end+2,y-1],[end-15,y-2]],light);
       if(heavy){
         arc(c,7,y+5,reach*.9,.53,-1.31+delta,.57+delta,7,light);
         rect(c,22,y+9,17,2,accent);rect(c,9,y+14,11,2,shade);
       }
     }
   }
 }else if(phase==='skill'&&t<22){
   const special=move==='qcf'||move==='qcb';
   const strike=skill?.hits?.find(h=>t>=h.from&&t<=h.to+2);
   if(strike && (p.move==='upAttack'||p.move==='downAttack'||move==='launcher')){
     const progress=(t-strike.from)/Math.max(1,strike.to-strike.from+2);
     const low=strike.level==='low', y=low?-9:-height*.55, angle=low?.4-progress:1.1-progress*2.7;
     arc(c,4,y,strike.reach*.78,low?.29:.76,angle-1.05,angle+.88,5,accent);
     arc(c,4,y,strike.reach*.82,low?.29:.76,angle-.75,angle+.87,2,light);
   }
   if(p.char==='iron'&&(move==='qcb'||move==='special')&&t>2){
     for(const x of [-9,8]){shape(c,[[x-3,-4],[x+4,-4],[x+(tick%3),11+(t%4)*2]],accent);rect(c,x-1,-2,3,8,light);}
   }else if(p.char==='nailong'&&t>2&&(move==='qcf'||move==='special')){
     for(let i=0;i<2;i++)arc(c,2,-height*.4,25+i*5,.84,t*.32+i*2,t*.32+i*2+2.0,4-i, i?light:accent);
   }else if(p.char==='xujingyu'&&move==='qcf'){
     for(let i=0;i<2;i++)arc(c,12,-height*.61,12+(t*2+i*13)%29,1,-1.04,1.04,3,i?accent:light);
   }else if(p.char==='liangzi'&&move==='qcb'&&t>=5){
     // Two lateral sways alternate sides in the same rhythm as the two hits.
     const sweep=t<12?1:-1;
     c.scale(sweep,1);arc(c,0,-height*.29,40,.43,-1.5,.86,5,accent);
     arc(c,-1,-height*.29,44,.43,-.9,.84,2,light);
   }else if(p.char==='jianguo'&&move==='qcf'&&t>=3){
     arc(c,17,-height*.49,28,.84,-1.28,1.25,6,accent);arc(c,19,-height*.49,28,.84,-.99,.87,2,light);
   }else if(p.char==='doubao'&&move==='qcb'){
     const trail=5+(t%7)*2;
     shape(c,[[-10,-41],[-trail-12,-37],[-12,-33],[-13,-36],[-3,-36],[-3,-38],[-13,-38]],light);
   }else if(special&&t<=10){
     c.globalAlpha=.6*(1-t/14);
     for(let i=0;i<4;i++){
       const a=i*1.6+tick*.22;
       rect(c,13+Math.cos(a)*(12+t),-height*.48+Math.sin(a)*(9+t),4,3,i%2?light:accent);
     }
   }
 }
 c.restore();
}
export function drawShot(c,q,tick){
 const [accent,light,shade]=palette(q.char);
 c.save();c.translate(Math.round(q.x),Math.round(q.y));c.scale(q.facing||Math.sign(q.vx)||1,1);
 const age=q.age??tick;
 // Orient the muzzle trail along the actual flight. Ground waves keep their feet level.
 if(['beam','rocket'].includes(q.kind))c.rotate(Math.atan2(q.vy||0,Math.abs(q.vx)||1));
 const nativeRadius={bubble:12,orb:25,beam:7,ball:10,disc:11,rocket:10};
 const scale=nativeRadius[q.kind]?Math.max(.72,Math.min(2.25,q.radius/nativeRadius[q.kind])):1;
 c.scale(scale,scale);
 if(q.skin==='stamp'){
   c.rotate(Math.sin(age*.22)*.16);
   rect(c,-11,-4,22,11,'#462e43');rect(c,-10,1,20,5,'#bf4949');rect(c,-8,4,16,2,'#ff9878');
   rect(c,-6,-9,12,7,'#8c434a');rect(c,-4,-13,8,6,'#df7360');rect(c,-2,-12,3,2,'#ffbd84');
   rect(c,-16,6,8,1,'#f3a78c');rect(c,-13,9,6,1,'#e77969');
 }else if(q.skin==='wrap'){
   c.rotate(Math.sin(age*.32)*.23);shape(c,[[-15,-6],[8,-7],[15,-1],[9,7],[-11,7],[-17,3]],'#73543a');
   shape(c,[[-13,-4],[7,-5],[11,0],[7,4],[-11,5]],'#f5c979');
   rect(c,-5,-3,8,2,'#c68149');rect(c,7,-3,3,6,'#75ae63');rect(c,10,-1,3,3,'#b96843');
 }else if(q.skin==='milk'){
   const swell=age%12<6?1:0;
   shape(c,[[-15,-2],[-9,-5],[-7,-10],[1,-12-swell],[9,-8],[12,-2],[11,6],[4,10],[-5,9],[-9,5],[-16,4]],'#b48d60');
   shape(c,[[-12,0],[-6,-4],[-5,-8],[2,-10],[8,-6],[10,0],[8,5],[3,7],[-4,6],[-8,3]],'#fff0bb');
   rect(c,-2,-6,6,2,'#fffdf0');rect(c,3,3,4,2,'#f5ce6a');rect(c,-19,2,4,2,'#fff4d5');
 }else if(q.skin==='sound'){
   for(let i=0;i<3;i++)arc(c,-i*6,0,10+i*2,.65,-1.5,1.5,3,i%2?light:accent);
 }else switch(q.kind){
  case 'mine':
   rect(c,-13,-3,26,5,'#292333');rect(c,-10,-7,20,5,'#625164');rect(c,-7,-8,14,2,'#baaba1');
   rect(c,-4,-11,7,4,age>14&&(tick>>3)%2?'#ff544a':'#ffc16d');rect(c,-13,1,5,2,'#ffa65a');rect(c,8,1,5,2,'#ffa65a');break;
  case 'beam':
   rect(c,-34,-2,20,4,shade);rect(c,-21,-4,24,8,accent);rect(c,-11,-2,18,4,light);rect(c,2,-1,9,2,'#fff');break;
  case 'bubble':
   rect(c,-17,-10,34,18,'#193c52');rect(c,-15,-12,30,21,'#193c52');rect(c,-14,-9,28,15,'#99f2df');
   shape(c,[[-8,5],[-1,5],[-7,13],[-9,13]],'#1b4757');for(let i=0;i<3;i++)rect(c,-8+i*6,-3,3,3,'#357b87');break;
  case 'rocket':
   shape(c,[[-11,-4],[6,-4],[14,0],[5,5],[-13,4]],'#2d2634');rect(c,-10,-3,13,6,'#adc2ca');rect(c,3,-2,7,5,'#ed7644');
   shape(c,[[-9,-3],[-15,-10],[-4,-6],[-1,-2]],'#ed844b');shape(c,[[-9,3],[-14,9],[-4,6],[-1,2]],'#ed844b');
   shape(c,[[-10,-3],[-23-(tick%3)*4,0],[-12,4]],'#ff9e3e');rect(c,-18,-1,8,3,'#fff4ab');break;
  case 'disc':
   for(let i=0;i<3;i++)arc(c,2,0,8+i*7,.85,-1.0,1.0,3,i===2?accent:light);
   rect(c,-11,-3,17,6,shade);rect(c,0,-6,8,12,accent);rect(c,2,-4,5,2,light);break;
  case 'ball':{
   ring(c,0,0,10,10,'#352737',5);c.fillStyle='#fb9d4d';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();
   c.rotate(age*.2);rect(c,-8,-1,16,2,'#79483e');ring(c,-7,0,7,9,'#79483e',2,-1.0,1);ring(c,7,0,7,9,'#79483e',2,Math.PI-1,Math.PI+1);
   rect(c,-5,-5,4,2,'#ffd788');break;
  }
  case 'shock':
   for(let i=0;i<3;i++){
    const x=-i*11, h=22-i*5+((age+i)%4);
    shape(c,[[x-8,0],[x-2,-h*.45],[x+6,-h],[x+8,-h*.65],[x+3,-1]],i%2?light:accent);
    rect(c,x-6,-2,12,3,shade);
   }break;
  case 'flame':
   shape(c,[[-28,-3],[-15,-4],[-20,-12],[-5,-7],[8,-9],[15,-1],[9,8],[-5,10],[-21,6],[-11,3]],'#f57936');
   shape(c,[[-17,0],[-7,-4],[4,-5],[11,-1],[5,6],[-8,5]],'#ffd05c');rect(c,0,-3,6,6,'#fff5af');break;
  case 'orb': default:
   if(q.kind==='orb'&&q.char==='doubao'){
     const pulse=age%20<10?1:0;
     rect(c,-24,-17,48,34,shade);rect(c,-21,-20,42,39,shade);rect(c,-21,-16,42,32,accent);rect(c,-18,-14,36,27,light);
     shape(c,[[-14,15],[-3,15],[-13,25]],shade);
     for(const [i,width] of [23,16,19].entries())rect(c,-13,-9+i*7,width+pulse*2,3,'#55a6af');
     rect(c,-31,-7,4,3,accent);rect(c,-36,3,9,2,light);
   }else{
     arc(c,0,0,14,1,age*.2,age*.2+4.2,4,accent);arc(c,0,0,11,1,age*.2+3,age*.2+6,3,light);
     shape(c,[[-11,0],[-4,-8],[5,-8],[12,0],[4,8],[-5,6]],accent);rect(c,-3,-4,8,7,light);rect(c,-21,-2,8,2,shade);
   }
 }
 c.restore();
}
export function eventFX(c,e,age){
 if(age<0||age>23)return;
 const [accent,light,shade]=palette(e.char),x=e.x,y=e.y;
 c.save();c.translate(Math.round(x),Math.round(y));
 if(e.kind==='hit'||e.kind==='counter'||e.kind==='blast'||e.kind==='guardbreak'){
   const heavy=e.heavy||e.launch>=13||e.power>=13, power=e.kind==='blast'||e.kind==='guardbreak'?38:heavy?30:18;
   c.globalAlpha=Math.max(0,1-age/21);
   if(age<=5){spark(c,e.id,age,power*(1-age/8),e.kind==='guardbreak'?'#a2dfff':accent);
    spark(c,e.id+2,age,power*.59*(1-age/7),light);rect(c,-4,-4,8,8,'#fff9e2');}
   if((heavy||e.kind==='blast')&&age<12){const r=9+age*2.7;arc(c,0,0,r,.87,e.id,3+e.id,3,accent);arc(c,0,0,r,.87,3.9+e.id,5.3+e.id,2,light);}
   for(let i=0;i<(heavy?12:7);i++){const a=i*2.4+e.id*.47,d=4+age*(.9+i%4*.85);
     const px=Math.cos(a)*d,py=Math.sin(a)*d+age*age*.020;
     rect(c,px,py,2+i%4,2,i%3===0?'#fff4c4':i%3===1?accent:light);}
 }else if(e.kind==='ko'){
   c.globalAlpha=1-age/25;
   for(let i=0;i<9;i++){
     const a=i*Math.PI*2/9,inner=10+age*3,outer=inner+32-age*.6;
     shape(c,[[Math.cos(a)*inner,Math.sin(a)*inner],[Math.cos(a)*outer,Math.sin(a)*outer],[Math.cos(a+.12)*inner,Math.sin(a+.12)*inner]],i%2?light:'#ff9874');
   }
 }else if(e.kind==='block'){
   if(age<12){const r=8+age*1.7;c.globalAlpha=1-age/13;arc(c,0,0,r,.95,-1.55,1.52,3,'#99eeff');arc(c,0,0,r,.95,1.9,4.1,2,'#e4fdff');}
 }else if(['assist','escape','recover','awaken'].includes(e.kind)&&age<17){
   c.globalAlpha=1-age/17;
   const r=12+age*1.2;
   arc(c,0,0,r,.64,-.5+age*.12,2.1+age*.12,3,accent);
   arc(c,0,0,r,.64,2.6+age*.12,4.85+age*.12,2,light);
 }else if(e.kind==='respawn'&&age<17){
   c.globalAlpha=1-age/17;ring(c,0,0,14+age,4+age*.4,accent,2);
   for(let i=-1;i<=1;i++)rect(c,i*10,-35+age*1.5,2,9,light);
 }else if((e.kind==='land'||e.kind==='jump'||e.kind==='dodge')&&age<12){
   c.globalAlpha=(1-age/13)*.7;
   for(let i=0;i<5;i++)rect(c,(i%2?-1:1)*(5+age*(1+i*.25)),-2-age*(i%3)*.36,4-i%3,2,'#efd0a5');
 }
 c.restore();
}
