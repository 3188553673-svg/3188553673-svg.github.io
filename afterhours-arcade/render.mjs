const WIDTH = 960, HEIGHT = 540;
const INK = '#171a2d', WHITE = '#ffecd4';
const PLAYER_COLORS = ['#8cfac0','#76d5ff','#ffd96c','#e6a6ff'];
const floors = new Map();

function box(c,x,y,w,h,color) {
  c.fillStyle=color;
  c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function line(c,x,y,x2,y2,color,width=1) {
  c.strokeStyle=color; c.lineWidth=width;
  c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
}
function ellipse(c,x,y,rx,ry,color,thickness=0) {
  if(rx<=0||ry<=0)return;
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if(thickness){c.strokeStyle=color;c.lineWidth=thickness;c.stroke();}
  else {c.fillStyle=color;c.fill();}
}
function poly(c,coords,color,outline) {
  c.beginPath(); c.moveTo(coords[0],coords[1]);
  for(let i=2;i<coords.length;i+=2)c.lineTo(coords[i],coords[i+1]);
  c.closePath();c.fillStyle=color;c.fill();
  if(outline){c.strokeStyle=outline;c.lineWidth=1;c.stroke();}
}
function type(c,str,x,y,color,size=7,align='left') {
  c.save();c.font='bold '+size+'px ui-monospace, Menlo, "PingFang SC", "Microsoft YaHei", monospace';
  c.textAlign=align;c.fillStyle=color;c.fillText(str,x,y);c.restore();
}
function rng(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function plus(c,x,y,r,color) {
  box(c,x-1,y-r,2,r*2,color);box(c,x-r,y-1,r*2,2,color);
}
function floorGraphic(stage) {
  if(floors.has(stage))return floors.get(stage);
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(480,270):Object.assign(document.createElement('canvas'),{width:480,height:270});
  const c=canvas.getContext('2d');
  const track=stage>=4,show=stage===2, rand=rng(1441+stage);
  c.imageSmoothingEnabled=false;
  box(c,0,0,480,270,'#191e30');
  // The parquet and cinder track share fixed landmarks with collision coordinates.
  if(!track) {
    const planks=show?['#624c43','#685045','#6b5246','#705446','#664d44']:['#745847','#765a48','#795e4c','#705544','#775b49'];
    box(c,0,34,480,228,planks[1]);
    for(let y=35,row=0;y<261;y+=7,row++){
      for(let x=-((row*27)%55);x<480;x+=55){
        box(c,x,y,54,6,planks[Math.floor(rand()*planks.length)]);
        box(c,x+3+rand()*12,y+4,2+rand()*13,1,'#ffffff09');
        box(c,x+8+rand()*18,y+2,7+rand()*11,1,'#27182514');
      }
    }
    // Evening light from the clerestory falls across the lacquer in broad bands.
    c.save();c.beginPath();c.rect(7,43,466,211);c.clip();
    for(const x of [-76,40,156,272,388]){
      poly(c,[x,44,x+54,44,x+134,172,x+91,171],'#ffd2990a');
      poly(c,[x+3,44,x+5,44,x+94,171,x+91,171],'#211e2d0c');
    }
    c.restore();
    const marks=show?'#9d8975':'#af9781';
    c.strokeStyle=marks;c.lineWidth=1;
    c.strokeRect(12.5,43.5,455,207);line(c,240,44,240,250,marks);
    ellipse(c,240,146,30,30,marks,1);ellipse(c,240,146,26,26,'#8a7465',1);
    for(let k=0;k<2;k++){
      c.save();if(k){c.translate(480,0);c.scale(-1,1);}
      c.strokeRect(12.5,118.5,47,57);c.beginPath();c.arc(60,147,17,-Math.PI/2,Math.PI/2);c.stroke();
      c.beginPath();c.arc(20,147,84,-Math.PI/2,Math.PI/2);c.stroke();c.restore();
    }
    // Large College Athletics lightning crest, a faded painted floor mark.
    c.save();c.translate(240,146);
    poly(c,[-15,-10,-3,-10,1,-15,14,-15,6,-3,12,-3,-4,15,-2,5,-12,5],'#af8a61');
    poly(c,[-11,-6,-4,-6,-7,-1,-14,-1],'#c39767');
    c.restore();
    type(c,show?'LIVE  //  COURT 01':'AFTERCLASS  ATHLETICS',239,221,'#987968',6,'center');
    for(let k=0;k<2;k++){ 
      const x=k?466:10;box(c,x-2,132,4,27,'#4a3a39');box(c,x,131,2,28,'#bdb3a0');
      const hx=k?x-5:x+5;ellipse(c,hx,144,5,2,'#e1a46a',1);line(c,hx-4,145,hx-2,150,'#d3bca7');line(c,hx+4,145,hx+2,150,'#d3bca7');
    }
  } else {
    box(c,0,33,480,230,'#784f4a');
    const colors=['#84574f','#895a51','#85564f','#905c50','#875850'];
    for(let i=0;i<5;i++){
      const y=41+i*43;box(c,0,y,480,42,colors[i]);
      box(c,0,y+41,480,1,'#b88976');
      type(c,String(i+1).padStart(2,'0'),20,y+26,'#b38775',9);
      type(c,String(i+1).padStart(2,'0'),452,y+26,'#b38775',9);
    }
    for(let n=0;n<1560;n++){
      let x=rand()*480,y=41+rand()*213; box(c,x,y,rand()<.9?1:2,1,rand()>.52?'#c390721d':'#462e371d');
    }
    for(let y=41;y<255;y+=5) {
      box(c,405,y,2,4,'#c09a85');if((y-41)%10===0)box(c,407,y,2,4,'#b5927e');
    }
    for(const x of [80,285])for(const y of [83,169,212]) {
      poly(c,[x-4,y-2,x+2,y-2,x+4,y,x+2,y+2,x-4,y+2,x-2,y],'#b0816c');
    }
    type(c,'AFTERCLASS   TRACK   CLUB',242,152,'#ae7868',8,'center');
    type(c,'2 4    /    A T H L E T I C S',241,160,'#a77565',4,'center');
  }
  // Upper grandstand. Its silhouette anchors the play space without making fake obstacles.
  box(c,0,0,480,26,track?'#222f3b':'#272334');
  box(c,0,0,480,3,'#151927');
  if(track){
    for(let x=0;x<480;x+=28){
      const h=9+rand()*11;box(c,x,22-h,26,h,'#344049');
      for(let wx=x+4;wx<x+23;wx+=6)box(c,wx,20-h,3,2,'#7a7760');
    }
    box(c,0,18,480,9,'#3d625a');
    for(let x=12;x<475;x+=47){
      const h=7+Math.round(rand()*6);box(c,x,21-h,2,h,'#4a5151');
      box(c,x-5,17-h,12,6,'#3e6263');box(c,x-3,14-h,8,7,'#557a70');box(c,x-1,13-h,5,2,'#6b8b79');
    }
    for(let xx=0;xx<480;xx+=13){line(c,xx,19,xx+6,26,'#69877b');line(c,xx+6,26,xx+13,19,'#69877b');}
  } else {
    for(let x=0;x<480;x+=37){line(c,x,0,x+13,22,'#3a3444',2);line(c,x+26,0,x+13,22,'#423847',2);}
    for(let x=23;x<480;x+=111){box(c,x,2,23,3,'#4d4752');box(c,x+2,4,20,2,'#e5c893');box(c,x+5,6,14,1,'#92795e');}
  }
  for(let row=0;row<2;row++){
    const y=17+row*6;
    box(c,0,y+4,480,2,'#131b28');
    for(let x=-1+row*2;x<480;x+=9){
      const px=x+Math.floor(rand()*3),m=Math.floor(rand()*6);
      if(m===0)continue;
      box(c,px+1,y+1,4,4,['','#8b625e','#777580','#b18465','#777d6c','#83738e'][m]);
      box(c,px+1,y,4,1,'#302c37');box(c,px,y+4,6,2,['','#795b70','#4e7c85','#79576c','#6d7368','#985e52'][m]);
      if(row){box(c,px+3,y+2,1,1,'#cf9e7e');box(c,px+1,y+5,1,1,'#afa29b');}
      if(show&&row&&m===2){box(c,px+6,y,1,4,'#dca1ac');box(c,px+6,y,1,2,'#f3bd9f');}
    }
  }
  box(c,0,30,480,10,'#252c39');box(c,0,30,480,1,'#696571');
  for(let x=0;x<480;x+=60){box(c,x,32,1,6,'#696071');for(let t=0;t<3;t++)poly(c,[x+5+t*5,38,x+9+t*5,33,x+12+t*5,33,x+8+t*5,38],track?'#618078':'#a36b50');}
  const label=['EQUIPMENT   /   GYM 01','GRANDSTAND   /   REHEARSAL','ON AIR   /   LIVE PK','LOCKER   /   HALF TIME','VARSITY   /   TRACK & FIELD','FINALS   /   MORNING RUN'][stage]||'AFTERCLASS';
  box(c,176,28,128,12,'#202333');box(c,179,29,122,8,'#343644');type(c,label,240,35,track?'#99c8b3':'#eab58d',5,'center');
  box(c,0,40,480,2,'#261f2d');box(c,0,42,480,2,'#3227334d');
  box(c,0,255,480,15,'#272a37');box(c,0,255,480,2,'#6b625e');box(c,0,258,480,1,'#171b29');
  for(let x=4;x<480;x+=17){box(c,x,262,9,1,'#56515a');box(c,x,264,9,1,'#353845');}
  for(const x of [0,474]){box(c,x,43,6,212,'#263142');box(c,x+(x?0:5),44,1,210,'#8a756b');}
  if(stage===0||stage===3){
    for(const x of [23,425]){
      box(c,x,24,34,2,'#202631');box(c,x,26,2,11,'#829293');box(c,x+31,26,2,11,'#829293');
      box(c,x,34,34,2,'#596a72');for(let i=0;i<4;i++)basket(c,x+5+i*8,31,3.5);
    }
  }
  if(stage===1){
    for(const x of [38,390]){poly(c,[x,1,x+39,1,x+34,16,x+25,14,x+17,17,x+3,13],'#705267');type(c,'FAN CLUB',x+18,10,'#e3c4ac',5,'center');}
  }
  if(stage===3){
    for(const x of [127,240,352]){box(c,x-19,164,38,16,'#567068');box(c,x-19,164,38,1,'#91a28a');for(let i=0;i<4;i++)box(c,x-16+i*9,178,5,1,'#394f52');}
  }
  if(stage===5){
    ellipse(c,240,147,170,89,'#714e4c');
    ellipse(c,240,147,165,84,'#9d6958');ellipse(c,240,147,161,81,'#8d5d53');
    ellipse(c,240,147,106,38,'#78684e');ellipse(c,240,147,102,35,'#687858');
    c.save();c.beginPath();c.ellipse(240,147,100,34,0,0,Math.PI*2);c.clip();
    for(let xx=126;xx<354;xx+=30)box(c,xx,111,15,73,'#637655');
    for(let j=0;j<300;j++){const gx=135+rand()*210,gy=115+rand()*66;box(c,gx,gy,2,1,'#b1a57a30');}
    c.restore();
    type(c,'MORNING  ATHLETICS',240,145,'#acb892',7,'center');type(c,'C A M P U S    /    R U N',240,154,'#9ca886',4,'center');
    for(const [rx,ry] of [[153,73],[116,47]]){
      ellipse(c,240,147,rx+7,ry+6,'#c5967c',1);
      ellipse(c,240,147,rx-7,ry-6,'#c5967c',1);
      c.setLineDash([6,8]);ellipse(c,240,147,rx,ry,'#c4977b',.7);c.setLineDash([]);
    }
  }
  floors.set(stage,canvas);return canvas;
}

// All actors use the same bottom-centre anchor and retain their palette across animation poses.
const SKINS={
  kobe: {skin:['#623d36','#985d45','#bd8058','#deaa77'],suit:['#433156','#714d8f','#9c71b5'],trim:'#f7c54e',hair:'#382b31',boot:'#7d5a9d'},
  iron: {skin:['#75483d','#aa7055','#d3956d','#f5ba8a'],suit:['#6d283a','#a53c45','#d95a50'],trim:'#edb354',hair:'#49302f',boot:'#a33b42'},
  jianguo: {skin:['#5c416d','#856097','#ab81bb','#cdabd0'],suit:['#314857','#4c6876','#74919b'],trim:'#d7bd94',hair:'#ccbfbc',boot:'#4c4957'},
  steel: {skin:['#6e443d','#ac7050','#d39768','#f7c299'],suit:['#6d2939','#ab3b42','#da5a47'],trim:'#ffcb60',hair:'#312a31',boot:'#973747'},
  thanos: {skin:['#57395d','#875786','#ad76a4','#d49eb6'],suit:['#45394c','#72536a','#9c7088'],trim:'#f1ba6c',hair:'#674460',boot:'#e6c8ab'},
  clone: {skin:['#51465c','#716378','#988397','#b4a1b1'],suit:['#42444d','#656773','#7e8790'],trim:'#b3a291',hair:'#574b5d',boot:'#aca294'},
  runner: {skin:['#744d41','#ab765c','#d5a272','#efbe92'],suit:['#24545e','#48808b','#69a8a3'],trim:'#e2c6a0',hair:'#493c39',boot:'#728995'},
  mage: {skin:['#6c453a','#aa6d52','#cf9667','#f1bc8b'],suit:['#273f61','#466b90','#6892a4'],trim:'#ea963e',hair:'#3b333a',boot:'#644346'}
};
function actorHead(c,kind,x,y,p) {
  const [shade,mid,light,hi]=p.skin;
  c.save();c.translate(x,y);
  // Crown, temples, ears and chin are stepped at whole pixels.
  box(c,-5,-13,9,1,INK);box(c,-7,-12,13,2,INK);box(c,-8,-10,15,9,INK);
  box(c,-7,-1,13,2,INK);box(c,-5,1,10,2,INK);box(c,-3,3,6,1,INK);
  box(c,-6,-11,11,2,shade);box(c,-7,-9,13,8,mid);box(c,-5,-10,10,10,light);
  box(c,-6,-7,11,6,light);box(c,-3,0,7,2,mid);
  box(c,2,-9,3,3,hi);box(c,-7,-5,2,3,shade);box(c,-8,-5,2,2,mid);
  box(c,-5,-6,4,1,shade);box(c,2,-6,4,1,shade);
  box(c,-4,-5,3,1,'#efe0bc');box(c,2,-5,3,1,'#f5dfbe');
  box(c,-2,-5,1,1,INK);box(c,4,-5,1,1,INK);
  box(c,0,-5,1,3,mid);box(c,0,-3,3,1,shade);box(c,1,-4,1,1,hi);
  box(c,-2,0,5,1,shade);box(c,0,1,2,1,light);
  if(kind==='kobe'){
    box(c,-6,-11,11,1,p.hair);box(c,-4,-12,8,1,shade);box(c,-7,-10,3,3,p.hair);
    box(c,-5,-10,10,1,mid);box(c,2,-10,3,1,hi);
    box(c,-5,-7,4,1,INK);box(c,2,-7,4,1,INK);
    box(c,-4,-1,1,2,shade);box(c,3,-1,1,2,shade);box(c,-2,2,5,1,shade);
  } else if(kind==='iron'||kind==='steel'||kind==='mage'||kind==='runner'){
    const h=p.hair;
    box(c,-7,-10,3,5,h);box(c,-6,-12,10,3,h);box(c,-4,-14,7,3,h);
    box(c,-1,-13,6,3,h);box(c,3,-12,3,3,h);
    box(c,-5,-12,5,1,'#685049');box(c,-2,-13,3,1,'#7c594c');box(c,-6,-8,2,3,h);
    if(kind!=='runner'){
      box(c,-4,-2,4,1,h);box(c,2,-2,3,1,h);
      box(c,-4,-1,1,2,h);box(c,4,-1,1,2,h);
      box(c,-3,1,1,1,h);box(c,3,1,1,1,h);box(c,-2,2,5,1,h);
      if(kind==='steel'){box(c,-6,-3,2,1,h);box(c,5,-3,1,1,h);box(c,-1,1,3,1,h);}
    }
  } else if(kind==='jianguo'){
    box(c,-8,-10,3,4,'#a79e9e');box(c,-7,-11,4,2,'#d7cfc6');
    box(c,-5,-13,9,2,'#eeeadb');box(c,2,-12,5,2,'#b9b1ae');
    box(c,-5,-11,6,1,'#cabec1');box(c,5,-10,2,3,'#bcb3ae');
    box(c,-6,-7,5,1,'#ebe2cc');box(c,2,-7,4,1,'#ebe2cc');
    box(c,-6,-5,5,1,shade);box(c,2,-5,4,1,shade);
    box(c,-6,-3,3,1,mid);box(c,4,-2,2,1,shade);
    box(c,-3,-1,6,1,'#bfaeb0');box(c,-2,1,3,1,shade);
  } else {
    box(c,-4,-10,5,1,mid);box(c,-3,-9,7,1,mid);
    box(c,-6,-7,5,2,shade);box(c,2,-7,4,2,shade);
    for(const xx of [-3,-1,2,4])box(c,xx,0,1,2,shade);
    box(c,-7,-2,2,2,shade);box(c,5,-2,1,2,shade);
  }
  c.restore();
}
function arm(c,x,y,dx,dy,p,glove) {
  const elbowX=x+dx*.45,elbowY=y+3+dy*.36;
  line(c,x,y,elbowX,elbowY,INK,6);line(c,elbowX,elbowY,x+dx,y+dy,INK,6);
  line(c,x,y,elbowX,elbowY,p.suit[1],4);
  line(c,elbowX,elbowY,x+dx,y+dy,glove?p.suit[2]:p.skin[2],4);
  box(c,x+dx-2,y+dy-2,4,4,glove?p.trim:p.skin[2]);
  box(c,x+dx,y+dy-2,2,1,glove?'#ffdfa1':p.skin[3]);
}
function legs(c,p,stride,kind,shoeless){
  const shorts=kind==='kobe'||kind==='thanos'||kind==='runner'||kind==='clone';
  for(const [x,y] of [[-6,stride],[2,-stride]]){
    box(c,x,y-9,6,8,INK);box(c,x+1,y-9,4,5,shorts?p.skin[1]:p.suit[0]);
    box(c,x+1,y-6,4,4,shorts?p.skin[2]:p.suit[1]);
    const bare=shoeless&&x===2;
    box(c,x-1,y-3,8,4,INK);box(c,x,y-3,6,2,bare?p.skin[2]:p.boot);
    box(c,x+4,y-2,3,2,bare?p.skin[2]:'#dac4ab');
    if(shorts&&!bare)box(c,x+1,y-5,4,2,kind==='kobe'?'#e9d9bc':'#d9c9b0');
  }
}
function body(c,kind,p) {
  box(c,-7,-19,14,13,INK);box(c,-9,-18,18,5,INK);box(c,-6,-7,13,2,INK);
  box(c,-7,-17,14,8,p.suit[1]);box(c,-5,-18,10,12,p.suit[1]);box(c,-7,-15,3,7,p.suit[0]);box(c,4,-16,2,8,p.suit[2]);
  box(c,-6,-8,12,2,p.suit[0]);box(c,-5,-7,3,1,p.trim);
  if(kind==='kobe'){
    box(c,-7,-18,3,5,p.trim);box(c,4,-18,3,5,p.trim);box(c,-3,-18,6,2,p.trim);
    // 24, drawn at sprite resolution so the jersey survives every animation.
    const digits=['110101','010101','110111','100001','110001'];
    digits.forEach((row,y)=>{for(let x=0;x<row.length;x++)if(row[x]==='1')box(c,x-2,y-14,1,1,'#ffdb75');});
    box(c,-6,-8,13,1,p.trim);
  } else if(kind==='steel'||kind==='iron'){
    poly(c,[-7,-18,-2,-17,0,-14,-2,-12,-7,-15],p.suit[2]);poly(c,[7,-18,2,-17,0,-14,2,-12,7,-15],p.trim);
    box(c,-2,-15,5,4,'#385b64');box(c,-1,-15,3,3,'#8de1e2');box(c,0,-15,2,2,'#e9ffff');
    box(c,-3,-9,7,1,p.trim);
  } else if(kind==='jianguo'){
    box(c,-6,-18,5,3,'#a5acaa');box(c,1,-18,4,3,'#a5acaa');
    box(c,-1,-15,1,7,p.suit[0]);box(c,0,-13,1,1,p.trim);box(c,0,-9,1,1,p.trim);box(c,3,-14,3,1,p.trim);
  } else if(kind==='mage'){poly(c,[-8,-19,-4,-19,0,-14,6,-19,9,-18,5,-12,0,-10,-6,-14],'#a7473f');box(c,-1,-12,3,2,p.trim);}
  else{
    box(c,-7,-18,3,6,p.trim);box(c,5,-18,2,6,p.trim);
    box(c,-3,-15,7,5,kind==='clone'?'#aba69a':'#efcf9a');box(c,-1,-14,1,3,'#554449');box(c,1,-14,1,3,'#554449');
  }
}
function bigGlove(c,x,y) {
  box(c,x-4,y-7,8,11,INK);box(c,x-5,y-5,10,6,INK);
  box(c,x-3,y-5,7,7,'#9b3739');box(c,x-3,y-4,6,3,'#e16449');box(c,x-4,y,8,2,'#b68145');
  for(let i=0;i<3;i++){
    box(c,x-4+i*3,y-7,2,3,['#e89f74','#eaa94e','#e77c54'][i]);
    box(c,x-4+i*3,y-6,2,1,['#a8f7fa','#c59afa','#9bb7ff'][i]);
  }
  box(c,x-1,y-3,3,2,'#8bddee');box(c,x,y-3,1,1,WHITE);
}
function human(c,kind,x,y,frame,opt={}) {
  const p=SKINS[kind]||SKINS.runner;
  const face=opt.face||1,scale=opt.scale||1.4;
  const action=opt.action||'idle',run=['run','charge','swap','chase'].includes(action);
  const stride=run?Math.round(Math.sin(frame*.27)*3):0;
  const bob=run?(Math.abs(stride)>1?-1:0):Math.round(Math.sin(frame*.07)*.55);
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(face*scale,scale);
  if(action==='down'){c.translate(0,-3);c.rotate(-1.15);c.scale(.82,.82);}
  if(action==='dash')c.transform(1,0,-.32,1,0,0);
  legs(c,p,stride,kind,kind==='thanos'&&['stunned','chase'].includes(action));
  c.translate(0,bob);
  let attack=['attack','skill','volley','snap','portal','stunned'].includes(action);
  if(action==='skill'&&kind==='kobe'){c.translate(-1,-3);c.rotate(-.18);}
  arm(c,-6,-17,-2-stride*.38,attack?(kind==='kobe'?-3:2):7+stride*.5,p,kind==='iron');
  body(c,kind,p);
  box(c,-2,-21,5,3,p.skin[1]);actorHead(c,kind,0,-21,p);
  if(kind==='steel'){
    let hand=action==='snap'||action==='portal';
    arm(c,6,-16,hand?5:7,hand?-7:3,p,true);
    bigGlove(c,hand?12:14,hand?-24:-14);
  } else if(kind==='kobe'&&action==='skill'){
    arm(c,6,-17,5,-11,p,false);box(c,9,-28,5,2,p.skin[3]);
  } else {
    arm(c,6,-17,attack?(kind==='jianguo'?4:8):2,attack?-1:6-stride*.4,p,kind==='iron');
    if(kind==='kobe'){
      box(c,attack?10:6,attack?-19:-13,3,3,'#ebe5d6');
      if(!attack){const by=action==='run'?-8+Math.abs(stride):-10+bob;basket(c,11,by,3.5);}
    }
    if(kind==='iron'&&attack){box(c,14,-19,2,3,'#d8fffa');}
    if(kind==='jianguo'&&action==='skill'){poly(c,[6,-24,13,-22,14,-14,10,-8,5,-11,4,-19],'#8ed6d5',INK);}
  }
  if(opt.flash>0){c.globalAlpha=.65;plus(c,0,-15,5,'#fff4d5');}
  c.restore();
}
function basket(c,x,y,r) {
  ellipse(c,x,y,r,r,'#512c2b');ellipse(c,x,y,r*.79,r*.79,'#e88940');
  line(c,x-r*.78,y+r*.12,x+r*.78,y-r*.12,'#78412d',Math.max(.8,r*.18));
  line(c,x-r*.28,y-r*.78,x+r*.27,y+r*.75,'#84502e',Math.max(.8,r*.17));
  box(c,x-r*.52,y-r*.55,Math.max(1,r*.55),1,'#ffd18a');
}
function chair(c,e,tick) {
  const jump=e.action==='windup'?Math.max(1,Math.sin((38-e.timer)/38*Math.PI)*16):0;
  c.save();c.translate(e.x,e.y-jump);c.scale(e.dx<0?-1.35:1.35,1.35);
  line(c,-8,-16,7,0,INK,3);line(c,4,-15,-5,0,INK,3);
  line(c,-8,-16,7,0,'#b4a78d',1);line(c,4,-15,-5,0,'#797d77',1);
  poly(c,[-9,-25,4,-25,6,-22,4,-13,-7,-13,-9,-16],'#c58a53',INK);
  box(c,-7,-23,10,3,'#eab878');box(c,-7,-19,8,1,'#996142');
  box(c,-6,-20,3,2,INK);box(c,0,-20,3,2,INK);box(c,-5,-20,1,1,'#fff3bd');box(c,1,-20,1,1,'#fff3bd');
  poly(c,[-6,-13,5,-13,10,-10,8,-8,-4,-9,-8,-11],'#e1a864',INK);
  if(e.flash>0)plus(c,0,-16,5,WHITE);
  c.restore();
}
function mop(c,e,tick){
  const s=e.action==='charge'?Math.cos(tick*.5)*2:0;
  c.save();c.translate(e.x,e.y);const scale=e.elite?1.28:1;c.scale((e.dx<0?-1:1)*scale,scale);c.translate(s,0);
  box(c,-9,-5,6,6,INK);box(c,5,-5,6,6,INK);box(c,-13,-14,25,10,INK);
  box(c,-15,-12,30,8,'#3d7b83');box(c,-13,-13,25,5,'#7caeaa');
  box(c,-10,-20,16,9,INK);box(c,-8,-19,12,6,'#4c8591');box(c,-7,-18,10,2,'#b7d5be');
  box(c,8,-11,6,3,['charge','windup','aim'].includes(e.action)?'#ffe499':'#ecb575');
  line(c,-4,-20,-11,-32,'#2b3440',3);line(c,-4,-20,-11,-32,'#cfac79');
  box(c,-16,-34,11,3,'#9b8b78');
  for(let i=0;i<5;i++)box(c,-16+i*2,-34-(i%2),1,5,'#d4c7b2');
  if(e.elite){box(c,-5,-24,5,4,'#a84f43');box(c,-4,-25,3,2,tick%24<12?'#ffba59':'#f56653');}
  if(e.flash>0)plus(c,0,-12,6,WHITE);c.restore();
}
function groundShadow(c,x,y,rx=15){
  ellipse(c,x,y+1,rx,rx*.32,'#221b2b65');
}
function playerSprite(c,p,index,tick) {
  const color=PLAYER_COLORS[index%4],x=p.x,y=p.y;
  groundShadow(c,x,y,15);
  ellipse(c,x,y+2,15.5,5,color,1.4);
  c.save();if(p.invuln>0&&Math.floor(tick/4)%2)c.globalAlpha=.68;
  human(c,p.hero,x,y,tick+index*12,{action:p.down?'down':p.action,face:p.dx<-.08?-1:1,scale:1.32});
  c.restore();
  if(p.down) {
    const v=Math.min(1,Math.max(0,p.revive||0));
    box(c,x-12,y-26,24,5,INK);box(c,x-11,y-25,22*v,3,'#8ce6a8');
    plus(c,x,y-32,4,'#b4ffc3');
  } else {
    const tag='P'+(index+1);
    box(c,x-7,y-56,15,8,'#1b2030');box(c,x-7,y-56,2,8,color);
    type(c,tag,x+1,y-50,color,7,'center');
  }
}
function enemySprite(c,e,tick) {
  if(e.hp<=0)return;
  const boss=e.kind==='steel'||e.kind==='thanos';
  groundShadow(c,e.x,e.y,boss?27:14);
  if(e.kind==='chair')chair(c,e,tick);
  else if(e.kind==='mop')mop(c,e,tick);
  else {
    const sc=boss?1.88:(e.kind==='clone'?1.35:1.23);
    human(c,e.kind,e.x,e.y,tick+Math.round(e.x*.03),{face:e.dx<-.05?-1:1,scale:sc,action:e.action,flash:e.flash});
    if(e.kind==='steel'&&e.action==='snap'){
      const offset=e.dx<-.05?-1:1;
      plus(c,e.x+offset*24,e.y-54,4+Math.round((Math.sin(tick*.31)+1)*2),'#fff1a1');
    }
    if(e.action==='stunned'){
      for(let i=0;i<3;i++){let a=tick*.08+2.09*i;plus(c,e.x+Math.cos(a)*16,e.y-69+Math.sin(a)*3,2,'#ffd580');}
    }
  }
  if(!boss&&e.hp<e.maxHp){
    box(c,e.x-8,e.y+6,16,3,'#24212d');box(c,e.x-7,e.y+7,14*Math.max(0,e.hp/e.maxHp),1,'#e5936f');
  }
}
function danger(c,h,tick){
  const before=h.timer<h.warn, pulse=(Math.sin(tick*.22)+1)*.5;
  const stroke=before?'#ffd58d':'#ff9878';
  c.save();
  if(h.kind==='charge'&&h.length){
    c.translate(h.x,h.y);c.rotate(Math.atan2(h.dy,h.dx));
    const len=h.length,rad=h.r||14;c.fillStyle='#ffc75d28';c.fillRect(0,-rad,len,rad*2);
    c.setLineDash([8,5]);line(c,0,-rad,len,-rad,stroke,1.5);line(c,0,rad,len,rad,stroke,1.5);c.setLineDash([]);
    for(let i=27;i<len-8;i+=37)poly(c,[i,-5,i+4,-5,i+10,0,i+4,5,i,5,i+5,0],stroke);
  } else if(h.w>0&&h.h>0) {
    const x=h.x,y=h.y,w=h.w,hh=h.h;
    c.fillStyle=before?'rgba(222,97,66,'+(.12+pulse*.07)+')':'rgba(246,91,56,.35)';
    c.fillRect(x,y,w,hh);c.strokeStyle=stroke;c.lineWidth=before?2:3;
    c.setLineDash(before?[9,7]:[]);c.strokeRect(x+1,y+1,Math.max(0,w-2),Math.max(0,hh-2));c.setLineDash([]);
    c.save();c.beginPath();c.rect(x,y,w,hh);c.clip();
    const stripes=h.kind==='stands'?25:34;
    for(let k=x-hh;k<x+w;k+=stripes)line(c,k,y+hh,k+hh,y, before?'#ffd28728':'#fec49838',3);
    c.restore();
    if(h.kind==='stands'&&w>60){
      type(c,before?'!  应援棒来袭':'!  看台齐射',x+w/2,y+Math.min(25,hh/2),stroke,12,'center');
    } else if(w>22&&hh>12) {
      const cx=x+w/2,cy=y+hh/2,dx=h.dx||((w>=hh)?1:0),dy=h.dy||((w<hh)?1:0);
      c.save();c.translate(cx,cy);c.rotate(Math.atan2(dy,dx));poly(c,[-7,-6,2,-6,9,0,2,6,-7,6,-1,0],stroke);c.restore();
    }
  } else if(h.r>0){
    const r=h.r;
    ellipse(c,h.x,h.y,r,r,before?'#e57a4933':'#fd775840');
    c.setLineDash(before?[7,5]:[]);ellipse(c,h.x,h.y,r,r,stroke,2);c.setLineDash([]);
    if(before){const fraction=Math.max(.08,Math.min(1,h.timer/Math.max(1,h.warn)));ellipse(c,h.x,h.y,r*fraction,r*fraction,'#fabe7766',1);}
    plus(c,h.x,h.y,3,stroke);
  }
  c.restore();
}
function cone(c,x,y){
  groundShadow(c,x,y,12);box(c,x-10,y-3,20,4,'#30303a');box(c,x-9,y-5,18,3,'#d98c51');
  poly(c,[x-6,y-5,x-2,y-19,x+1,y-19,x+6,y-5],'#e98950','#6d554f');
  poly(c,[x-4,y-10,x-3,y-13,x+3,y-13,x+4,y-10],'#f4d6af');
}
function kit(c,p,tick) {
  if(p.hidden)return;
  const x=p.x,y=p.y,r=p.r||11;
  if(p.kind==='cone'){cone(c,x,y);return;}
  if(p.kind==='barrier'){
    const w=p.w||48,h=p.h||23,left=x-w/2,back=y-h/2;
    box(c,left+2,back+5,w,h,'#271f2f55');
    box(c,left,back-6,w,h+6,'#342f3b');box(c,left+2,back-4,w-4,h-2,'#668383');
    box(c,left+4,back-3,w-8,2,'#9ba99a');box(c,left+3,back+h-8,w-6,6,'#45565d');
    for(const xx of [left+5,left+w-9]){box(c,xx,back-5,4,h+4,'#a2977b');box(c,xx+1,back-3,1,h-2,'#d1bd97');}
    for(let xx=left+17;xx<left+w-14;xx+=9){box(c,xx,back+h/2-2,5,2,'#50666a');}
    return;
  }
  if(p.kind==='portal'){
    groundShadow(c,x,y,25);const a=(p.id?.toString().charCodeAt(0)||0)+tick*.04;
    const outer=p.color||(x<480?'#98d9f4':'#ed9ad6');
    ellipse(c,x,y-11,r,r*.74,'#243843');ellipse(c,x,y-11,r,r*.74,outer,3);
    ellipse(c,x,y-11,r*.74,r*.50,'#b3ede0',1);
    for(let i=0;i<5;i++){const ang=a+i*1.2566;box(c,x+Math.cos(ang)*r-1,y-11+Math.sin(ang)*r*.75,3,3,'#fbddb1');}
    return;
  }
  if(p.kind==='gong'){
    groundShadow(c,x,y,18);box(c,x-13,y-36,27,3,'#6d4631');
    box(c,x-13,y-36,3,36,'#4c3c38');box(c,x+11,y-36,3,36,'#4c3c38');
    line(c,x-5,y-33,x-3,y-27,'#efcb8d');line(c,x+5,y-33,x+3,y-27,'#efcb8d');
    if(p.flash>0){ellipse(c,x,y-19,15+Math.sin(tick*.3)*2,15,'#ffeab1',2);}
    ellipse(c,x,y-20,11,11,'#673d37');ellipse(c,x,y-20,9,9,'#d49d58');ellipse(c,x,y-20,6,6,'#f0c776',1);ellipse(c,x,y-20,3,3,'#955c42');
    return;
  }
  if(p.kind==='lace'){
    const a=tick*.12; c.save();c.lineWidth=3;
    const dx=(p.endX??x+24)-x,dy=(p.endY??y+10)-y;const points=[];
    for(let i=0;i<7;i++)points.push([x+dx*i/6,y+dy*i/6+Math.sin(a+i*1.5)*2]);
    ellipse(c,x,y,15+Math.sin(a)*2,6,'#edb3ff',1.4);
    for(let i=1;i<points.length;i++)line(c,...points[i-1],...points[i],'#e2a5ff',3);
    plus(c,x,y-1,2,'#fff2b3');c.restore();return;
  }
  if(p.kind==='shoe'){
    groundShadow(c,x,y,12);poly(c,[x-9,y-7,x-4,y-7,x-2,y-4,x+6,y-4,x+10,y-1,x+10,y+2,x-10,y+2],'#ead6a6',INK);
    box(c,x-8,y,17,2,'#9c7c9d');box(c,x-1,y-5,2,3,'#614564');plus(c,x+6,y-13,2,'#ffe69b');
    return;
  }
  if(p.kind==='rebound'){
    const wave=1+Math.sin(tick*.17)*.12;ellipse(c,x,y,r*wave,r*.65*wave,'#fbb75a',2);
    ellipse(c,x,y,r*.64,r*.40,'#ffdf8e',1);plus(c,x,y,3,'#fff0b4');return;
  }
  if(p.kind==='heart'){
    groundShadow(c,x,y,9);const yy=y-11+Math.sin(tick*.08)*2;
    box(c,x-8,yy-4,16,11,INK);box(c,x-7,yy-3,14,9,'#ead9b9');plus(c,x,yy+1,4,'#ce675e');return;
  }
  if(p.kind==='dummy'){
    groundShadow(c,x,y,16);if(p.flash>0)plus(c,x,y-26,10,'#fff0a5');box(c,x-9,y-4,18,4,'#674b3f');box(c,x-3,y-35,6,34,'#5c453a');
    box(c,x-8,y-33,16,21,INK);box(c,x-7,y-32,14,18,'#c09258');box(c,x-6,y-29,12,3,'#e0b477');
    box(c,x-6,y-20,12,3,'#896a4b');line(c,x-13,y-24,x+12,y-22,'#8c6347',4);
    box(c,x-5,y-41,10,8,'#b88558');box(c,x-4,y-40,8,2,'#edbd7b');return;
  }
  if(p.kind==='rack'){
    const yy=y-7+Math.sin(tick*.07)*2;
    groundShadow(c,x,y,17);ellipse(c,x,y+2,r*.9,r*.43,'#aad7ac',1);
    box(c,x-13,yy-4,26,8,INK);box(c,x-12,yy-4,24,3,'#809ca4');box(c,x-11,yy-1,22,4,'#4c646c');
    if(p.weapon==='basket'){basket(c,x,yy-12,8);}
    else if(p.weapon==='tray'){ellipse(c,x,yy-11,12,5,'#bed5d8');ellipse(c,x,yy-11,9,3,'#7c939f');}
    else {poly(c,[x-7,yy-8,x-5,yy-12,x-4,yy-17,x,yy-20,x+4,yy-17,x+6,yy-11,x+8,yy-8],'#d3a451',INK);box(c,x-7,yy-8,16,2,'#f7d281');}
    if(p.label){type(c,p.label,x,y+15,'#232638',10,'center');type(c,p.label,x,y+14,'#f9dfae',10,'center');}
  }
}
function missile(c,p,tick){
  const airborne=p.kind!=='shock'&&p.kind!=='bell';
  const x=p.x,y=p.y-(p.z||0)-(airborne?11:0),r=p.r||4;
  if((p.z||0)>0)groundShadow(c,p.x,p.y,r);
  if(p.kind==='basket'||p.kind==='lob'||p.kind==='dunk'){
    const a=Math.atan2(p.vy,p.vx);if(p.kind!=='basket'){line(c,x,y,x-Math.cos(a)*10,y-Math.sin(a)*10,'#f6b66099',4);}
    c.save();c.translate(x,y);c.rotate(tick*.17);basket(c,0,0,Math.min(13,Math.max(4,r)));c.restore();return;
  }
  if(p.kind==='tray'){ellipse(c,x,y,r*1.45,r*.64,'#46687a');ellipse(c,x,y-1,r*1.35,r*.52,'#adc7ce');line(c,x-r*.8,y,x+r*.7,y-1,'#dce8dd',1);return;}
  if(p.kind==='bell'||p.kind==='shock'){const range=r*(.32+.68*(p.timer||0)/Math.max(1,p.life));ellipse(c,x,y,range,range,p.kind==='bell'?'#ffdc8e':'#d4b3f1',2);return;}
  if(p.kind==='stamp'){box(c,x-r,y-r,r*2,r*2,'#8da3ac');box(c,x-r+1,y-r+1,r*2-2,r*2-2,'#617b78');plus(c,x,y,2,'#f2d38e');return;}
  const hostile=p.team==='enemy'||p.team==='foe';
  if(p.kind==='glow'){
    const glow=hostile?'#fdb77b':'#85fde1';c.save();c.translate(x,y);c.rotate(Math.atan2(p.vy||0,p.vx||1));
    box(c,-14,-4,27,8,'#302638');box(c,-11,-3,18,6,glow);box(c,-10,-2,14,2,'#fff0d5');box(c,7,-3,5,6,'#9a839a');c.restore();return;
  }
  const color=hostile?'#ff7f89':'#8fe4f1',bright=hostile?'#ffe1b9':'#e2fff3';
  const a=Math.atan2(p.vy||0,p.vx||1);
  const len=p.kind==='beam'?23:hostile?10:8;
  c.save();c.translate(x,y);c.rotate(a);box(c,-len,-r,len+r*1.5,r*2,INK);
  box(c,-len+1,-r+1,len+r,r*2-2,color);box(c,-2,-r*.45,r*1.5,r*.9,bright);c.restore();
}
function fx(c,e){
  const z=Math.max(0,Math.min(1,e.timer/Math.max(1,e.life))),color=e.color||'#ffd99b';
  c.save();c.globalAlpha=(1-z);
  switch(e.kind){
    case 'hit':case 'spark':
      for(let i=0;i<5;i++){const a=i*1.256+.4,rr=4+z*14;line(c,e.x+Math.cos(a)*rr*.5,e.y-9+Math.sin(a)*rr*.5,e.x+Math.cos(a)*rr,e.y-9+Math.sin(a)*rr,color,2);}
      if(z<.4)plus(c,e.x,e.y-9,4,WHITE);break;
    case 'text':
      type(c,e.text||'',e.x+1,e.y-16-z*15,'#201d30',12,'center');type(c,e.text||'',e.x,e.y-17-z*15,color,12,'center');break;
    case 'heal':plus(c,e.x,e.y-13-z*14,4,color);break;
    case 'snap':case 'ring':case 'dash':{
      const radius=(e.kind==='snap'?60:17)*z+5;ellipse(c,e.x,e.y,radius,radius*.6,color,2*(1-z)+1);break;
    }
    default:plus(c,e.x,e.y-5,3,color);break;
  }
  c.restore();
}
function live(c,state) {
  const boss=state.boss, tick=state.tick||0;
  if((state.room||'')==='steel'||state.stage===2){
    if(boss?.audience===50){
      const x=boss.safeSide==='right'?481:0;
      box(c,x,33,479,25,'#272b3c');box(c,x,40,479,3,'#484859');box(c,x,51,479,3,'#494554');
      for(let sx=x+4;sx<x+470;sx+=17){box(c,sx,36,11,3,'#50434e');box(c,sx+5,47,10,3,'#4a4859');}
    }
    box(c,333,3,294,43,'#151a29');box(c,335,5,290,38,'#95505c');
    box(c,337,7,286,34,'#262937');box(c,339,9,282,30,'#313542');
    box(c,342,13,5,5,Math.floor(tick/24)%2?'#f78778':'#ffb98e');
    type(c,'LIVE',352,19,'#f3a38b',10);
    type(c,'观众  '+(boss?.audience??100),351,33,'#f3d7b7',9);
    type(c,'PK',480,29,'#f5c663',17,'center');
    if(boss?.pk){
      box(c,552,18,18,4,'#b75a4c');box(c,552,21,3,10,'#853d40');box(c,566,21,3,10,'#853d40');
      c.save();c.translate(561,22);c.scale(.44,.44);body(c,'mage',SKINS.mage);actorHead(c,'mage',0,-21,SKINS.mage);c.restore();
      type(c,'连麦',607,29,'#b2ded3',9,'right');
    } else { type(c,'钢胆侠',609,29,'#b2ded3',12,'right'); }
  }
}
export function drawScene(c,state,options={}) {
  if(!c||!state)return;
  c.save();c.setTransform(c.canvas.width/WIDTH,0,0,c.canvas.height/HEIGHT,0,0);
  c.imageSmoothingEnabled=false;c.lineCap='butt';c.lineJoin='miter';
  const tick=state.tick||0,stage=Number(state.stage)||0;
  c.drawImage(floorGraphic(stage),0,0,WIDTH,HEIGHT);
  live(c,state);
  for(const h of state.hazards||[])danger(c,h,tick);
  const low=new Set(['lace','rebound','portal','shoe','heart']);
  for(const p of state.props||[])if(low.has(p.kind))kit(c,p,tick);
  const objects=[];
  for(const p of state.props||[])if(!low.has(p.kind))objects.push({y:p.y,draw:()=>kit(c,p,tick)});
  for(const e of state.enemies||[])if(e&&e!==state.boss&&(!state.boss||e.id!==state.boss.id))objects.push({y:e.y,draw:()=>enemySprite(c,e,tick)});
  if(state.boss)objects.push({y:state.boss.y,draw:()=>enemySprite(c,state.boss,tick)});
  (state.players||[]).forEach((p,i)=>objects.push({y:p.y,draw:()=>playerSprite(c,p,i,tick)}));
  objects.sort((a,b)=>a.y-b.y);for(const item of objects)item.draw();
  for(const p of state.shots||[])missile(c,p,tick);
  for(const e of state.effects||[])fx(c,e);
  const boss=state.boss;
  if(boss&&boss.hp>0){
    const x=216,y=515,w=528,shade=boss.kind==='steel'?'#e78269':'#c891d6';
    box(c,x-3,y-3,w+6,20,'#171c29');box(c,x,y,w,14,'#30313d');
    const name=boss.kind==='steel'?'钢胆侠':'跑早操的灭霸';
    type(c,'BOSS',x+4,y+10,'#f0be80',10);
    type(c,name,x+37,y+11,'#ffe5bd',11);
    const left=x+120,span=w-140,pct=Math.max(0,Math.min(1,boss.hp/boss.maxHp));
    box(c,left,y+3,span,7,'#161c23');box(c,left+1,y+4,(span-2)*pct,5,shade);
    box(c,left+1,y+4,(span-2)*pct,1,'#fbd5ab');
    for(let j=1;j<8;j++)box(c,left+span*j/8,y+4,1,5,'#31313c');
  }
  c.restore();
}

export function drawPortrait(c,kind,x,y,size) {
  const p=SKINS[kind]||SKINS.runner;
  c.save();c.translate(x,y);c.beginPath();c.rect(0,0,size,size);c.clip();
  c.scale(size/48,size/48);box(c,0,0,48,48,p.suit[0]);
  for(let xx=-32;xx<70;xx+=7){poly(c,[xx,48,xx+29,0,xx+31,0,xx+2,48],'#ffffff14');}
  c.translate(23,80);c.scale(2.24,2.24);
  body(c,kind,p);actorHead(c,kind,0,-21,p);
  if(kind==='steel')bigGlove(c,8,-19);
  c.restore();
}
