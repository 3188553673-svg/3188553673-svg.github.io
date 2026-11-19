import {box, line, ellipse, poly, type, rng, plus} from './pixel-tools.mjs';

const palette={
  basement:{beds:['#414e56','#43505a','#44515b','#414e58'],grout:'#39434b',wear:'#556369',wall:'#25323d',edge:'#687b80',accent:'#dda260'},
  studio:{beds:['#605253','#635456','#665758','#605154'],grout:'#55494d',wear:'#766360',wall:'#382e41',edge:'#716273',accent:'#e194a1'},
  track:{beds:['#775747','#795b4a','#7d5c4a','#785849'],grout:'#735445',wear:'#a0785c',wall:'#343b3e',edge:'#7d8272',accent:'#e8b87a'},
  hangar:{beds:['#526570','#546670','#546570','#50616a'],grout:'#42535e',wear:'#65747a',wall:'#2e3b4a',edge:'#8295a0',accent:'#f8c779'},
  canteen:{beds:['#658079','#678179','#627d78','#68817a'],grout:'#576e69',wear:'#7d9288',wall:'#344b4b',edge:'#91a89b',accent:'#eac694'}
};
const floorCache=new Map();
function theme(s){
  if(s.room==='steel')return 'studio';
  if(s.room==='captain')return 'hangar';
  if(s.room==='mirror')return 'canteen';
  return ['basement','track','hangar','canteen'][Math.min(3,Math.max(0,(s.floor||1)-1))];
}
function hashId(s){
  let n=123;
  for(const ch of String(s.roomId||s.room||''))n=(n*31+ch.charCodeAt(0))>>>0;
  return n;
}
function hazardTape(c,x,y,w,accent='#c1935b'){
  box(c,x,y,w,3,'#393d3c');
  for(let xx=x+2;xx<x+w-3;xx+=7)poly(c,[xx,y,xx+4,y,xx+1,y+3,xx-2,y+3],accent);
}
function light(c,x,y,w,warm=true){
  box(c,x-1,y-1,w+2,4,'#242d32');box(c,x,y,w,2,warm?'#e4d2a3':'#9fcac6');
  box(c,x+2,y,w-4,1,warm?'#fff1c9':'#d2e7d4');
}
function shelfBackdrop(c,x,y,mode){
  box(c,x-1,y-1,40,20,'#232e39');box(c,x+1,y+1,36,16,'#37404a');
  for(const yy of [y+7,y+15]){
    for(let i=0;i<4;i++){
      const xx=x+3+i*8;
      if(mode===0){
        box(c,xx,yy-4,6,4,i%2?'#8b7563':'#9e8365');box(c,xx+2,yy-4,1,4,'#bf9a72');
      }else{
        ellipse(c,xx+2,yy-2,3.5,3.3,'#a56c4f');line(c,xx-1,yy-2,xx+5,yy-2,'#7d5147');
      }
    }box(c,x,yy,38,1,'#75807c');
  }
  for(const xx of [x,x+36])box(c,xx,y,2,18,'#728082');
}
function gymFloor(c,kind,rand,p){
  let n=0;
  for(let y=40;y<256;y+=13)for(let x=-((n++%2)*13);x<480;x+=26){
    box(c,x,y,25,12,p.beds[Math.floor(rand()*4)]);if(rand()<.11){box(c,x+4,y+8,5,1,'#ffffff08');}
  }
  for(let xx=40;xx<450;xx+=85){
    box(c,xx,63,2,1,p.wear);box(c,xx+17,213,4,1,p.wear);box(c,xx,72,1,3,p.wear);
  }
  c.strokeStyle='#718375';c.lineWidth=1;c.setLineDash([4,6]);c.strokeRect(45,64,389,164);c.setLineDash([]);
  const v=kind==='elite'?'02':kind==='combat'?'01':'00';
  type(c,'B'+v,240,153,'#657269',22,'center');
  type(c,'EQUIPMENT   STORE',240,160,'#657269',5,'center');
  for(const x of [29,431]){box(c,x,98,13,6,'#34414b');for(let i=0;i<5;i++)box(c,x+1+i*2,99,1,4,'#696e69');}
}
function foodFloor(c,rand,p){
  for(let y=40;y<255;y+=11){
    for(let x=0;x<480;x+=11){
      const odd=(Math.floor(y/11)+Math.floor(x/11))%2;
      box(c,x,y,10,10,odd?p.beds[Math.floor(rand()*4)]:'#70877d');
    }
  }
  // Worn table-zone lines, a quick visual contrast to the factory rooms.
  for(const x of [28,422]){box(c,x,61,2,171,'#a3a58a');box(c,x+19,61,1,171,'#8f9d86');}
  for(const y of [71,220]){
    for(let x=55;x<424;x+=12){box(c,x,y,6,1,'#899d8d');}
  }
  ellipse(c,240,146,17,13,'#82998a',1);ellipse(c,240,146,12,9,'#82998a',1);
  for(let j=0;j<3;j++){line(c,217+j*2,136,217+j*2,142,'#91a38f');}
  line(c,219,141,219,154,'#91a38f');line(c,260,136,260,154,'#91a38f');
}
function rooftopFloor(c,rand,p){
  for(let y=40;y<259;y+=27)for(let x=0;x<480;x+=44){
    box(c,x+1,y+1,43,26,p.beds[Math.floor(rand()*4)]);
    box(c,x+3,y+3,1,1,'#839293');box(c,x+40,y+24,1,1,'#394f5b');
  }
  // Heliport marking. Corner sectors remain open for projectile warnings.
  c.save();c.setLineDash([17,6]);ellipse(c,240,148,66,61,'#a5a79a',2);c.setLineDash([]);c.restore();
  line(c,225,129,225,168,'#b0afa1',5);line(c,255,129,255,168,'#b0afa1',5);line(c,225,148,255,148,'#b0afa1',5);
  for(const x of [35,427])for(const y of [65,211]){hazardTape(c,x,y,20,'#af9f76');box(c,x,y-5,20,1,'#8e9994');}
  for(let t=0;t<13;t++){
    const x=26+rand()*424,y=56+rand()*176;
    box(c,x,y,3,1,'#293b4819');
  }
}
function trackFloor(c,rand,p,boss){
  box(c,0,40,480,220,'#82705a');
  for(let row=0;row<6;row++){
    const y=41+row*36;box(c,0,y,480,36,row%2?'#955f50':'#90604e');
    box(c,0,y+34,480,1,'#ca9981');
  }
  if(boss){
    ellipse(c,240,147,174,91,'#865846');ellipse(c,240,147,167,84,'#a87159');
    for(const [rx,ry] of [[157,78],[150,70],[119,53],[111,46]]){
      ellipse(c,240,147,rx,ry,'#d0a77e',1);
    }
    ellipse(c,240,147,105,40,'#75825c');
    c.save();c.beginPath();c.ellipse(240,147,101,36,0,0,Math.PI*2);c.clip();
    for(let x=128;x<359;x+=24)box(c,x,111,12,74,'#6e805a');c.restore();
    for(let y=110;y<188;y+=3){box(c,400,y,2,2,'#d3c3a0');}
  }else{
    for(let i=0;i<5;i++)type(c,'0'+(i+1),34,59+i*36,'#bf9579',7);
    for(let y=45;y<250;y+=7){box(c,402,y,2,5,'#d0ab8d');}
  }
  type(c,boss?'MORNING ATHLETICS':'TRACK CLUB',240,150,boss?'#a8b58d':'#b78f74',8,'center');
  for(let i=0;i<600;i++)box(c,11+rand()*458,44+rand()*209,1,1,'#583f3614');
}
function studioFloor(c,rand){
  for(let y=40,i=0;y<260;y+=6,i++)for(let x=-((i*19)%43);x<480;x+=43){
    box(c,x,y,42,5,['#745c50','#725b51','#705951','#775c50'][Math.floor(rand()*4)]);
    box(c,x+3+rand()*13,y+3,5,1,'#d9aa8520');
  }
  c.strokeStyle='#a98c73';c.lineWidth=1;c.strokeRect(19.5,48.5,440,195);
  line(c,240,49,240,243,'#ab8e76');ellipse(c,240,146,35,35,'#aa8c75',1);
  for(const x of [20,402]){c.strokeRect(x,115,57,60);}
  poly(c,[232,132,249,132,243,143,250,143,233,164,236,150,229,150],'#c19672');
  for(let i=0;i<4;i++){
    const x=21+i*118;poly(c,[x,43,x+32,43,x+114,165,x+67,144],'#ffcc8a08');
  }
}
function skyline(c){
  box(c,0,0,480,25,'#526371');box(c,0,4,480,12,'#9c8581');box(c,0,15,480,5,'#c39886');
  for(let i=0;i<39;i++){
    const x=i*13,h=5+((i*29)%16);box(c,x,26-h,12,h,i%3?'#566171':'#655f6c');
    for(let q=0;q<3;q++)box(c,x+2+q*3,28-h,1,1,'#c3a994');
  }
}
function makePoster(c,x,y,w,h,accent,mark){
  box(c,x,y,w,h,'#1e2832');box(c,x+1,y+1,w-2,h-2,accent);
  box(c,x+3,y+4,w-7,1,'#ffedd1');type(c,mark,x+4,y+10,'#fff1ce',5);
  box(c,x+3,y+h-3,w-8,1,'#ffe3bd');
}
function scenery(c,t,p,rand){
  if(t==='hangar')skyline(c);
  else {box(c,0,0,480,28,p.wall);box(c,0,3,480,2,'#151f2a');}
  if(t==='basement'){
    for(let x=0;x<480;x+=22){box(c,x,6,1,18,'#42505b');}
    box(c,0,5,480,2,'#7e7567');box(c,0,8,480,1,'#4f5c63');
    for(const x of [5,174,294,434])shelfBackdrop(c,x,14,(x>200)?1:0);
    for(const x of [65,332]){box(c,x,11,43,18,'#34454d');for(let i=0;i<4;i++){box(c,x+2+i*10,12,8,15,'#576971');box(c,x+6+i*10,16,2,1,'#91a39c');}}
    makePoster(c,133,11,15,17,'#997254','GYM');light(c,206,5,30,false);
  }else if(t==='hangar'){
    for(let x=0;x<480;x+=20){line(c,x,28,x+10,18,'#374c55');line(c,x+10,18,x+20,28,'#374c55');}
    box(c,0,17,480,1,'#abb7ad');box(c,0,28,480,2,'#354655');
    for(const x of [30,408]){box(c,x,13,5,16,'#616d74');box(c,x-1,10,7,4,'#ca855a');box(c,x+1,9,3,2,'#facc90');}
  }else if(t==='canteen'){
    box(c,0,4,480,6,'#a9b5a5');
    for(let i=0;i<48;i++)box(c,i*10,4,5,5,'#ad695e');
    for(const x of [12,298]){
      box(c,x,11,164,17,'#273739');box(c,x+2,12,160,9,'#6b8985');box(c,x+3,13,158,2,'#a6b3a0');
      for(let j=0;j<10;j++){box(c,x+5+j*16,23,12,4,'#bd9d72');box(c,x+7+j*16,21,8,3,j%2?'#a87953':'#a6b681');}
      box(c,x,27,164,2,'#abb195');
    }
    makePoster(c,188,8,33,19,'#566b5b','MENU');makePoster(c,256,8,24,19,'#97766b','OPEN');
    for(const x of [58,143,322,422]){line(c,x,0,x,6,'#252f36');poly(c,[x-6,10,x-3,6,x+3,6,x+6,10],'#d2baa0');}
  }else if(t==='track'){
    box(c,0,0,480,12,'#81908d');
    for(let i=0;i<45;i++){
      const x=i*11+rand()*6,y=5+rand()*8;box(c,x,19,2,8,'#5d544c');box(c,x-5,y,12,13,'#50695b');box(c,x-2,y-2,8,5,'#6d8270');
    }
    for(let x=0;x<480;x+=8){line(c,x,27,x+6,16,'#7f9383');line(c,x,16,x+6,27,'#7f9383');}
    box(c,0,15,480,2,'#adad8f');box(c,0,27,480,2,'#616e67');
  }else{
    for(let x=6;x<480;x+=21){line(c,x,1,x+10,15,'#5c4f59',1);line(c,x+20,1,x+10,15,'#5c4f59',1);}
    for(let row=0;row<2;row++)for(let x=2;x<480;x+=7){
      let y=16+row*6+rand()*2;box(c,x+1,y-3,3,3,['#9c827c','#ac8470','#d5a081'][Math.floor(rand()*3)]);
      box(c,x,y,6,3,['#6e617e','#7c7162','#537b86','#ae746d'][Math.floor(rand()*4)]);
    }
    for(const x of [25,150,298,435])light(c,x,6,20);
  }
  box(c,0,30,480,10,p.wall);box(c,0,30,480,1,p.edge);box(c,0,38,480,2,'#252c38');
  for(const x of [0,472]){
    box(c,x,40,8,214,'#29333d');box(c,x+(x?0:6),40,2,214,p.edge);
    for(let y=53;y<249;y+=22)box(c,x+2,y,3,4,p.wall);
  }
  box(c,0,253,480,17,'#252c38');box(c,0,253,480,2,p.edge);box(c,0,257,480,1,p.wall);
  for(let x=13;x<470;x+=26){box(c,x,262,15,2,'#4a5255');}
  for(const x of [11,444]){hazardTape(c,x,40,26,p.accent);hazardTape(c,x,250,26,p.accent);}
}
function frameRoom(c,t,p,rng){
  // Raised wall faces and contact shadows keep the room footprint readable when
  // several players stand near an exit. The scenery stays outside collision.
  box(c,7,40,465,2,'#1f28375c');box(c,8,42,464,2,'#1f283734');box(c,8,44,464,2,'#1f28371c');
  box(c,8,46,3,204,'#23303e2b');box(c,469,46,3,204,'#23303e35');box(c,9,249,461,2,'#2d354222');
  for(const xx of [1,471]){
    box(c,xx,47,8,19,p.wall);box(c,xx+1,47,6,2,p.edge);box(c,xx+1,64,6,1,'#1d2530');
    box(c,xx,222,8,24,p.wall);box(c,xx+1,223,6,2,p.edge);
  }
  if(t==='basement'){
    // Overhead cable chain and piping, with the striped pump box in the corner.
    for(const x of [13,467]){
      line(c,x,65,x,120,'#2c3a42',3);line(c,x-1,65,x-1,120,'#6b7167');
      for(const y of [67,89,114])box(c,x-3,y,5,2,'#899280');
      box(c,x-4,119,8,10,'#36434a');box(c,x-3,120,6,3,'#c29c62');
    }
    for(const x of [19,443]){box(c,x,46,18,5,'#3b4b50');for(let j=0;j<5;j++)box(c,x+2+j*3,47,1,2,'#73857c');}
    for(const x of [38,378]){
      box(c,x,30,63,8,'#34434a');for(let j=0;j<3;j++){box(c,x+1+j*20,32,17,4,'#52635f');box(c,x+3+j*20,33,11,1,'#849181');}
    }
  }else if(t==='studio'){
    for(const x of [18,441]){
      box(c,x,30,20,8,'#242c3a');type(c,'LIVE',x+2,36,'#d99092',5);
      for(const y of [66,193]){box(c,x,y,3,17,'#82686e');box(c,x,y,3,2,'#db9a84');}
    }
  }else if(t==='hangar'){
    for(const [x,y] of [[19,54],[458,54],[19,240],[458,240]]){
      ellipse(c,x,y,5,3,'#45545d');box(c,x-2,y-4,4,4,'#e29d61');box(c,x-1,y-5,2,2,'#ffe6a7');
    }
    type(c,'ROOFTOP  03',31,169,'#91a097',5);
    for(const x of [150,285]){poly(c,[x,250,x+8,246,x+16,250,x+13,250,x+8,248,x+3,250],'#a4a181');}
  }else if(t==='canteen'){
    for(const x of [57,157,337,405]){
      ellipse(c,x,34,8,3,'#526462');ellipse(c,x,32,8,3,'#c0bca4');ellipse(c,x,31,6,2,'#bd936a');
      box(c,x-4,29,3,2,'#c9a369');box(c,x+1,30,4,1,'#7d8d64');box(c,x+5,28,1,4,'#b4b1a0');
    }
    for(const x of [30,432]){
      box(c,x,211,10,6,'#596f6c');for(let j=0;j<4;j++)box(c,x+1+j*2,212,1,4,'#8d9d8c');
    }
  }else{
    for(let x=12;x<476;x+=26){const y=8+Math.sin(x*.045)*2;line(c,x-12,y-1,x+14,y+1,'#676a66');poly(c,[x,y,x+6,y,x+3,y+6],['#c88a72','#bdad83','#84a29a'][Math.floor(rng()*3)]);}
  }
}
function makeFloor(t,s){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(480,270):Object.assign(document.createElement('canvas'),{width:480,height:270});
  const c=canvas.getContext('2d'),p=palette[t],rand=rng((s.roomInfo?.seed||0)^hashId(s));
  box(c,0,0,480,270,p.grout);
  if(t==='basement')gymFloor(c,s.roomInfo?.type,rand,p);
  else if(t==='studio')studioFloor(c,rand);
  else if(t==='track')trackFloor(c,rand,p,s.room==='thanos');
  else if(t==='hangar')rooftopFloor(c,rand,p);
  else foodFloor(c,rand,p);
  scenery(c,t,p,rand);frameRoom(c,t,p,rand);
  if(s.roomInfo?.type==='shop'){
    for(const x of [114,326]){makePoster(c,x,12,32,17,'#65857d','SHOP');}
  }else if(s.roomInfo?.type==='treasure'){
    for(const x of [111,324]){makePoster(c,x,12,34,17,'#a77f4c','LOOT');}
  }
  return canvas;
}
export function drawDungeonFloor(c,s){
  const t=theme(s),key=t+'/'+(s.roomId||s.room)+'/'+(s.roomInfo?.type||'')+'/'+(s.roomInfo?.seed||0);
  if(!floorCache.has(key)){
    if(floorCache.size>=32)floorCache.delete(floorCache.keys().next().value);
    floorCache.set(key,makeFloor(t,s));
  }
  c.drawImage(floorCache.get(key),0,0,960,540);
}
const signNames={start:'起点',combat:'战斗',elite:'精英',treasure:'宝箱',shop:'商店',boss:'首领'};
export function door(c,p,s,tick){
  const dir=p.dir||'n',open=p.open,bright=open?'#a1edbf':'#eb8e78',dark=open?'#375954':'#5c4247';
  const angle={n:0,e:Math.PI/2,s:Math.PI,w:-Math.PI/2}[dir];
  c.save();c.translate(p.x,p.y);c.rotate(angle);
  box(c,-33,-29,66,31,'#171f29');box(c,-29,-26,58,27,open?'#20312f':'#47505a');
  if(!open){
    for(let j=0;j<4;j++){box(c,-27,-25+j*6,54,3,'#626b70');box(c,-26,-22+j*6,52,1,'#363e49');}
    hazardTape(c,-27,-9,54,'#b08567');
    box(c,-4,-17,8,6,'#e2b17c');box(c,-3,-20,6,3,'#c89c72');box(c,-1,-19,2,2,'#46505a');
  }else{
    box(c,-25,-22,50,15,'#142227');box(c,-24,-6,48,5,'#4f7066');
    for(const j of [0,1]){let y=-2-j*9+(tick%34)/17;poly(c,[-7,y+4,0,y-2,7,y+4,4,y+4,0,y+1,-4,y+4],j?'#74b49c':bright);}
  }
  for(const x of [-34,27]){
    box(c,x,-28,7,32,'#24313b');box(c,x+1,-28,5,30,'#859189');box(c,x+2,-22,3,9,bright);
    box(c,x+1,0,6,3,dark);
  }
  box(c,-31,2,62,2,bright);
  c.restore();
  const node=s.dungeon?.rooms?.find(n=>n.id===p.to), name=(node&&signNames[node.type])||p.label;
  if(name){
    const x=p.x+(dir==='w'?30:dir==='e'?-30:0),y=p.y+(dir==='n'?17:dir==='s'?-12:0);
    const tw=Math.max(24,Math.min(70,String(name).length*10+6));box(c,x-tw/2,y-8,tw,12,'#1d2933df');type(c,name,x,y+1,bright,9,'center');
  }
}
function tag(c,text,x,y,color){
  if(!text)return;
  const w=Math.max(28,Math.min(130,Array.from(String(text)).length*10+10));
  box(c,x-w/2,y-10,w,14,'#192333e6');box(c,x-w/2,y+3,w,1,color);type(c,text,x,y, color,10,'center');
}
function coin(c,x,y,phase=0,s=1){
  const w=(3+Math.abs(Math.sin(phase))*2)*s;
  ellipse(c,x,y,w,6*s,'#794f37');ellipse(c,x-.5,y-1,w*.83,5*s,'#ecb451');box(c,x-1,y-3*s,2,5*s,'#ffdf89');
}
function gem(c,x,y){
  poly(c,[x,y-7,x+5,y-1,x+3,y+5,x-3,y+5,x-5,y-1],'#9cdcf1','#3b667d');poly(c,[x,y-5,x+1,y-1,x-2,y+3,x-3,y-1],'#e7f2da');
}
function crate(c,p){
  const x=p.x-(p.w||44)/2,y=p.y-(p.h||30)/2,w=p.w||44,h=p.h||30;
  box(c,x+3,y+3,w,h,'#20232e5c');
  const art=p.art||'crate';
  if(art==='bench'||art==='table'){
    box(c,x+4,y+h-8,5,8,'#333a43');box(c,x+w-9,y+h-8,5,8,'#333a43');
    box(c,x,y-7,w,h-1,'#493d3c');box(c,x+2,y-5,w-4,h-7,'#af8963');box(c,x+3,y-4,w-6,2,'#d1af7a');
    for(let yy=y+3;yy<y+h-10;yy+=6)box(c,x+3,yy,w-6,1,'#8e6f53');
  }else if(art==='shelf'||art==='locker'){
    box(c,x,y-9,w,h+9,'#283841');box(c,x+1,y-8,w-2,h-5,'#708780');
    box(c,x+2,y-7,w-4,3,'#a4af98');box(c,x+2,y+h-15,w-4,13,'#50665e');
    for(let xx=x+6;xx<x+w-7;xx+=15){box(c,xx,y+h-14,11,8,'#344c49');box(c,xx+1,y+h-12,7,5,'#b29466');}
    box(c,x+1,y+h-3,w-2,2,'#8b9888');
  }else{
    box(c,x,y-7,w,h+7,'#383335');box(c,x+1,y-6,w-2,h+2,'#85694c');
    box(c,x+2,y-5,w-4,h-8,'#9c8159');box(c,x+2,y-4,w-4,2,'#c4ad79');
    box(c,x+3,y+h-10,w-6,8,'#705842');
    for(const xx of [x+3,x+w-8]){box(c,xx,y-5,5,h+2,'#b8a37d');box(c,xx+1,y+1,2,2,'#6a5f50');}
    line(c,x+9,y-2,x+w-11,y+h-13,'#ac966d',2);line(c,x+9,y+h-12,x+w-11,y,'#ac966d',2);
  }
}
export function dungeonProp(c,p,s,t,drawWeapon){
  const x=p.x,y=p.y,float=Math.sin(t*.075+(Number(p.id)||0)) * 2;
  if(p.kind==='door'){door(c,p,s,t);return true;}
  if(p.kind==='barrier'&&p.art){crate(c,p);return true;}
  if(p.kind==='coin'){ellipse(c,x,y+1,7,2,'#58412e55');coin(c,x,y-6+float,t*.14);return true;}
  if(p.kind==='energy'){
    ellipse(c,x,y+1,6,2,'#2c425353');gem(c,x,y-8+float);return true;
  }
  if(p.kind==='chest'){
    const open=p.opened;ellipse(c,x,y+2,20,5,'#242a324e');
    box(c,x-16,y-16,32,18,'#403739');box(c,x-14,y-13,28,13,open?'#786343':'#a77647');
    box(c,x-15,y-15,30,3,'#caa761');box(c,x-12,y-3,25,2,'#92724b');
    for(const xx of [x-12,x+7])box(c,xx,y-15,4,15,'#d3af65');
    if(open){
      poly(c,[x-16,y-24,x-13,y-28,x+14,y-28,x+16,y-24,x+16,y-16,x-16,y-16],'#8e6d49','#4c423e');
      box(c,x-12,y-23,24,6,'#463f3c');box(c,x-14,y-15,28,4,'#453c38');
    }else{
      poly(c,[x-16,y-16,x-14,y-23,x-9,y-25,x+9,y-25,x+14,y-23,x+16,y-16],'#c49c5e','#4c423e');
      box(c,x-14,y-18,28,3,'#e5c47f');box(c,x-3,y-17,7,8,'#f3d385');box(c,x,y-14,2,3,'#70503a');
      if(Math.sin(t*.075)>.45)plus(c,x+11,y-25,3,'#fff3c4');
    }
    return true;
  }
  if(p.kind==='exit'){
    const r=18,glow=(Math.sin(t*.13)+1)*.5;ellipse(c,x,y,r*1.35,r*.52,'#35364a',2);
    ellipse(c,x,y-4,r,r*.48,'#a9e5bc',2);
    for(let i=0;i<4;i++){const yy=y-4-i*4;box(c,x-12+i*2,yy,24-i*4,3,['#719e89','#96bea1','#b4d3ac','#d7dfb1'][i]);}
    tag(c,p.label||'下一层',x,y-22-glow*2,'#a7efc2');return true;
  }
  if(p.kind==='shop'||p.kind==='weapon'||p.kind==='talent'){
    const shop=p.kind==='shop',talent=p.kind==='talent',color=p.sold?'#81918b':talent?'#d2afe8':shop?'#f5d484':'#9addb7';
    ellipse(c,x,y+3,19,6,'#24333565');
    box(c,x-13,y-8,26,10,'#293c43');box(c,x-11,y-7,22,4,p.sold?'#596966':talent?'#8b71a1':'#728c81');box(c,x-9,y-1,18,1,color);
    if(!p.sold){
      const fy=y-18+float;
      if(talent){poly(c,[x-8,fy-5,x+4,fy-8,x+9,fy-4,x+10,fy+7,x-5,fy+9,x-9,fy+5],'#a585bd','#534664');starIcon(c,x,fy,4,'#f5de9c');}
      else if(p.offer==='heal'){box(c,x-8,fy-3,16,10,'#d5d8b9');plus(c,x,fy+1,4,'#cc735b');}
      else if(p.offer==='energy'){gem(c,x,fy);}
      else if(!drawWeapon(c,p.weapon,x,fy,1,0,1.35)){
        if(p.weapon==='basket'){ellipse(c,x,fy,7,7,'#d8934d');line(c,x-6,fy,x+6,fy,'#8d563d');line(c,x-2,fy-6,x+1,fy+6,'#8d563d');}
        else {box(c,x-6,fy-4,12,8,p.weapon==='pulse'?'#c07862':'#ad9896');plus(c,x,fy,2,'#e0c889');}
      }
    }
    const label=p.sold?'已售':p.label||'领取';
    tag(c,label,x,y+14,color);
    if(shop&&!p.sold){coin(c,x-5,y-35,1,.59);type(c,String(p.price??0),x+2,y-33,'#ffe2a3',9);}
    return true;
  }
  return false;
}
function starIcon(c,x,y,r,color){poly(c,[x,y-r,x+1,y-1,x+r,y,x+1,y+1,x,y+r,x-1,y+1,x-r,y,x-1,y-1],color);}
export function windSock(c,s,t){
  if(s.boss?.kind!=='captain')return;
  const b=s.boss,dir=b.windDir<0?-1:1;
  for(const x of [94,865]){
    const y=116;line(c,x,y-4,x,y-35,'#384957',2);line(c,x+1,y-3,x+1,y-35,'#a3aca0',1);
    const stopped=!b.windDir;const yy=y-(stopped?28:34)+Math.round(Math.sin(t*.14)*1.7),xx=x+dir*(stopped?13:22);
    poly(c,[x,y-36,x+dir*12,y-35,xx,yy+1,x+dir*12,y-30,x,y-29],'#e58d63');
    box(c,x+dir*7-1,y-35,3,5,'#e6d5b4');plus(c,x,y-36,1,'#edce8f');
  }
}
