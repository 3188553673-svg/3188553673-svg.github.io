// Training draws on its own world-space grid. All marks and the target share the
// physics floor, so the ruler stays in place when the camera pans or zooms.
const MARGIN=520, TOP=-384, BOTTOM=1072;
const ramp={ink:'#29272d',shadow:'#643f3b',dark:'#875642',mid:'#b17a51',wood:'#cb965e',light:'#e0b074',edge:'#f2cb8a'};
let roomSurface;
function rect(c,x,y,w,h,color) {
  c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function polygon(c,points,color) {
  c.fillStyle=color;c.beginPath();c.moveTo(...points[0]);
  for(const xy of points.slice(1))c.lineTo(...xy);
  c.closePath();c.fill();
}
function oval(c,x,y,rx,ry,color) {
  c.fillStyle=color;
  for(let i=-ry;i<=ry;i++){
    const span=Math.round(rx*Math.sqrt(Math.max(0,1-i*i/(ry*ry))));
    c.fillRect(Math.round(x-span),Math.round(y+i),span*2+1,1);
  }
}
function windowBay(c,x,y) {
  const w=109,h=79;
  rect(c,x-3,y-3,w+6,h+7,'#44555c');rect(c,x-1,y-1,w+2,h+2,'#283e47');
  rect(c,x+3,y+3,w-6,h-6,'#85958c');
  // Sunset and distant roofs are visible through both rows of old factory glass.
  rect(c,x+4,y+4,w-8,h-9,'#98a7a2');rect(c,x+4,y+28,w-8,19,'#beb697');
  rect(c,x+4,y+47,w-8,18,'#d0b79a');rect(c,x+4,y+64,w-8,10,'#8f9894');
  oval(c,x+76,y+38,8,8,'#e6cda1');
  for(const [dx,dy,len] of [[10,19,17],[15,17,9],[46,24,13],[66,17,20],[78,15,8],[27,31,10]]){
    rect(c,x+dx,y+dy,len,2,'#cec7ad');
  }
  const skyline=[11,16,11,9,19,24,15,12,20,26,19,11];
  for(let i=0;i<skyline.length;i++){
    const px=x+4+i*8,ht=skyline[i];
    rect(c,px,y+h-7-ht,8,ht,'#758b8e');
    if(i%3===1)rect(c,px+2,y+h-11-ht,4,4,'#758b8e');
    if(i%2===0)rect(c,px+2,y+h-4-ht,2,2,'#a8ad99');
  }
  polygon(c,[[x+7,y+4],[x+24,y+4],[x+6,y+54],[x+5,y+46]],'#e9e2cb30');
  polygon(c,[[x+67,y+4],[x+72,y+4],[x+45,y+72],[x+40,y+72]],'#f2e3bd25');
  for(let i=0;i<3;i++){rect(c,x+2+i*34,y+2,2,72,'#445b63');rect(c,x+3+i*34,y+3,1,71,'#a4aa92');}
  rect(c,x+2,y+37,w-4,3,'#465b61');rect(c,x+2,y+38,w-4,1,'#7f9088');
  rect(c,x-6,y+h-2,w+12,5,'#43575b');rect(c,x-6,y+h-2,w+12,1,'#a3a48d');
}
function matRack(c,x,floor) {
  const y=floor-60;
  rect(c,x-2,y-11,49,4,'#334149');rect(c,x+1,y-9,3,32,'#536066');rect(c,x+39,y-9,3,32,'#536066');
  ['#566e70','#747764','#6e6662'].forEach((col,i)=>{
    const bx=x+i*13;rect(c,bx,y+1,11,23,col);oval(c,bx+5,y+1,5,3,'#899187');oval(c,bx+5,y+1,3,2,'#525e5d');
    rect(c,bx+1,y+8,9,2,'#3e5157');rect(c,bx+3,y+4,1,15,'#798680');
  });
  rect(c,x-5,y+24,54,3,'#38474b');rect(c,x-5,y+24,54,1,'#869087');
}
function finishRoom(world,floor) {
  if(roomSurface)return roomSurface;
  const tile=document.createElement('canvas');tile.width=world.width+MARGIN*2;tile.height=BOTTOM-TOP;
  const c=tile.getContext('2d'),left=-MARGIN,right=world.width+MARGIN,span=right-left,back=floor.y-66;
  c.translate(MARGIN,-TOP);c.imageSmoothingEnabled=false;
  rect(c,left,TOP,span,back-TOP,'#344953');
  for(let y=TOP;y<back;y+=32){
    const base=y<back-152?'#465d66':y<back-80?'#475d64':'#425962';
    rect(c,left,y,span,31,base);rect(c,left,y,span,1,'#3c535e');
    if(y+1<back)rect(c,left,y+1,span,1,'#495f66');
  }
  // Padded panels on the lower wall and timber support posts frame a calm practice area.
  for(let x=world.centerX-59*32;x<right;x+=32){
    rect(c,x,back-238,1,238,'#3b545d');rect(c,x+1,back-238,1,238,'#51676b');
    if((x-world.centerX)%128===0){
      rect(c,x-3,back-245,6,244,'#3d525a');rect(c,x-2,back-245,1,244,'#667b79');
      rect(c,x-3,back-5,6,5,'#3b4a53');
    }
  }
  rect(c,left,back-32,span,31,'#415156');rect(c,left,back-34,span,4,'#64736c');
  for(let x=left+8;x<right;x+=79){rect(c,x,back-29,1,29,'#36494e');rect(c,x+1,back-29,1,29,'#566562');}
  for(let bay=-4;bay<=4;bay++){
    const x=world.centerX+bay*610;
    // Spliced steel trim, a ledge, and sun raking across the padded rear wall.
    polygon(c,[[x-132,back-106],[x-125,back-105],[x+7,back-1],[x-12,back-1]],'#8c99901d');
    polygon(c,[[x-132,back-83],[x-124,back-83],[x-19,back-1],[x-32,back-1]],'#b6af8c13');
    polygon(c,[[x-132,back-56],[x-124,back-56],[x-49,back-1],[x-61,back-1]],'#b6af8c15');
    windowBay(c,x-244,back-114);
    matRack(c,x+185,back+33);
    const hook=x+216, py=back-80;
    rect(c,hook-11,py-8,22,2,'#364b52');rect(c,hook,py-7,1,10,'#9d9781');
    rect(c,hook-1,py+3,3,6,'#4a4748');
    polygon(c,[[hook-5,py+8],[hook+5,py+8],[hook+8,py+15],[hook+8,py+26],[hook+4,py+32],[hook-3,py+32],[hook-8,py+26],[hook-8,py+16]],'#3b3f46');
    polygon(c,[[hook-4,py+9],[hook+4,py+9],[hook+6,py+15],[hook+6,py+26],[hook+2,py+30],[hook-3,py+30],[hook-6,py+25],[hook-6,py+16]],'#805757');
    rect(c,hook-4,py+13,3,12,'#9a7164');rect(c,hook-4,py+10,8,2,'#b09177');
    rect(c,hook-5,py+23,11,2,'#72595a');rect(c,hook,py+32,1,8,'#8a897a');
    rect(c,x-67,back-164,134,4,'#32434a');rect(c,x-64,back-163,128,3,'#b2ada0');
    rect(c,x-62,back-161,124,2,'#d2bf96');
    // Low-contrast calibration cross and four L-shaped corners guide jump and reach practice.
    const cy=back-64;
    rect(c,x-17,cy,34,1,'#67817e');rect(c,x,cy-17,1,34,'#67817e');
    for(const dx of [-1,1])for(const dy of [-1,1]){
      const xx=x+dx*38,yy=cy+dy*26;
      rect(c,dx<0?xx:xx-6,yy,7,1,'#617b78');rect(c,xx,dy<0?yy:yy-5,1,6,'#617b78');
    }
  }
  rect(c,left,back-2,span,5,'#273b44');rect(c,left,back+2,span,3,'#849083');
  // The foreground and both sides of the raised practice floor stay visible near the ends.
  rect(c,left,back+5,span,BOTTOM-back,'#303e44');
  const end=floor.x+floor.w;
  polygon(c,[[floor.x+42,back+5],[end-42,back+5],[end,floor.y],[end,BOTTOM],[floor.x,BOTTOM],[floor.x,floor.y]],'#796b5a');
  c.save();
  c.beginPath();c.moveTo(floor.x+42,back+5);c.lineTo(end-42,back+5);c.lineTo(end,floor.y);c.lineTo(end,BOTTOM);c.lineTo(floor.x,BOTTOM);c.lineTo(floor.x,floor.y);c.closePath();c.clip();
  const rows=[7,17,30,46,64,86,111,140,174,212,256,306,364,432,510,600];
  let prev=5;
  for(let row=0;row<rows.length;row++){
    const y=back+rows[row],previous=back+prev,rh=y-previous;
    rect(c,floor.x,previous,floor.w,rh,['#867764','#8d7b65','#817360','#897662'][row%4]);
    rect(c,floor.x,y-1,floor.w,1,'#625d53');rect(c,floor.x,y,floor.w,1,'#a08a6d');
    for(let x=floor.x-70+(row%3)*53;x<end;x+=107+row*4){
      rect(c,x,previous+1,1,rh-2,'#706454');
      if(row>2){rect(c,x+13,previous+Math.round(rh*.6),18+row,1,'#95816a');rect(c,x+33,previous+Math.round(rh*.6)-1,17,1,'#95816a');}
    }
    prev=rows[row];
  }
  for(let bay=-2;bay<=2;bay++){
    const x=world.centerX+bay*610-234;
    for(const offset of [0,45,90]){
      polygon(c,[[x+offset,back+6],[x+offset+29,back+6],[x+offset+115,back+37],[x+offset+76,back+37]],'#e2c59023');
      polygon(c,[[x+offset+79,back+39],[x+offset+117,back+39],[x+offset+150,back+51],[x+offset+108,back+51]],'#e2c59016');
    }
  }
  // Distance marks use the same world units as the simulation.
  rect(c,floor.x,floor.y-1,floor.w,2,'#cebd92');
  rect(c,floor.x,floor.y+2,floor.w,1,'#725f50');
  c.font='bold 8px monospace';c.textAlign='center';c.textBaseline='top';
  for(let delta=-700;delta<=700;delta+=10){
    const x=world.centerX+delta;
    if(x<floor.x||x>end)continue;
    const major=delta%100===0, middle=delta%50===0;
    rect(c,x,floor.y+1,major?2:1,major?11:middle?7:3,major?'#ebd6a1':'#bcab85');
    if(major){c.fillStyle='#d8c39a';c.fillText(delta>0?'+'+delta:String(delta),x+1,floor.y+15);}
  }
  rect(c,world.centerX-1,floor.y-15,2,13,'#cabf95');
  c.restore();
  roomSurface=tile;return tile;
}
export function drawTrainingRoom(c,world,floor) {
  c.drawImage(finishRoom(world,floor),-MARGIN,TOP);
}

function targetFront(c) {
  // A real wooden post has a solid end grain, three projecting arms and a low dummy leg.
  const r=ramp;
  polygon(c,[[-8,-7],[-11,-8],[-12,-48],[-11,-55],[-7,-58],[7,-58],[11,-54],[12,-48],[10,-9],[7,-6]],r.ink);
  polygon(c,[[-10,-52],[-7,-55],[7,-55],[10,-53],[9,-11],[5,-9],[-7,-9]],r.dark);
  rect(c,-8,-53,7,43,r.wood);rect(c,-5,-53,6,43,r.mid);rect(c,-8,-51,2,40,r.light);rect(c,5,-52,2,40,'#9d6544');
  oval(c,0,-55,10,4,r.ink);oval(c,0,-55,8,3,r.light);oval(c,0,-55,5,2,r.mid);rect(c,-2,-56,6,1,r.wood);
  for(const [x,y,n] of [[-2,-51,7],[-3,-42,9],[3,-35,9],[2,-24,6],[-6,-24,5]])rect(c,x,y,1,n,r.dark);
  oval(c,-3,-30,2,3,'#976447');rect(c,-3,-31,1,3,r.wood);
  // Dark bindings signal the actual contact zone at a glance.
  rect(c,-10,-47,20,4,'#513c3b');rect(c,-9,-47,18,1,'#ab8666');
  rect(c,-9,-18,18,3,'#5e4140');rect(c,-8,-18,16,1,'#be9069');
  polygon(c,[[4,-39],[14,-43],[19,-44],[21,-42],[19,-39],[9,-35],[4,-35]],r.ink);
  polygon(c,[[6,-39],[15,-42],[19,-43],[19,-41],[9,-37],[6,-37]],r.mid);
  rect(c,15,-43,4,1,r.light);
  polygon(c,[[-4,-39],[-13,-44],[-19,-46],[-23,-44],[-23,-41],[-15,-38],[-8,-34],[-3,-33],[0,-35]],r.ink);
  polygon(c,[[-5,-38],[-14,-43],[-19,-44],[-21,-43],[-19,-41],[-13,-39],[-6,-35],[-3,-35]],r.wood);
  rect(c,-21,-44,4,2,r.edge);rect(c,-18,-42,4,1,r.light);
  polygon(c,[[2,-28],[-5,-30],[-15,-28],[-19,-27],[-20,-24],[-17,-22],[-5,-25],[2,-24],[5,-25]],r.ink);
  polygon(c,[[1,-27],[-6,-28],[-16,-26],[-17,-24],[-7,-26],[1,-25]],r.wood);
  rect(c,-16,-26,6,1,r.edge);
  polygon(c,[[3,-18],[-2,-15],[-10,-12],[-14,-7],[-12,-4],[-9,-6],[-6,-9],[2,-10],[6,-13]],r.ink);
  polygon(c,[[2,-15],[-6,-12],[-11,-8],[-10,-7],[-7,-10],[1,-11],[4,-13]],r.mid);
}
export function drawTrainingDummy(c,p,tick,events,reduced) {
  let hit;
  for(let i=events.length-1;i>=0;i--){
    const e=events[i];
    if(e.target===p.id&&(e.kind==='hit'||e.kind==='block'||e.kind==='guardbreak')){hit=e;break;}
  }
  const age=hit?tick-hit.tick:100;
  const amp=age>=0&&age<18?(1-age/18)*(hit?.heavy ? .17 : .12):0;
  const direction=Math.sign((p.x-hit?.x)||p.vx||1);
  c.save();c.translate(Math.round(p.x),Math.round(p.y));
  // Base remains steady while the upper post pivots on the steel socket.
  polygon(c,[[-14,-4],[-9,-8],[10,-8],[15,-4],[15,-1],[-14,-1]],'#34343a');
  rect(c,-12,-4,25,2,'#606061');rect(c,-10,-5,20,1,'#a2a098');
  rect(c,-12,-2,24,1,'#48464b');rect(c,-8,-4,2,1,'#d6c7a0');rect(c,8,-4,2,1,'#d6c7a0');
  c.translate(0,-4);
  if(amp&&!reduced)c.rotate(direction*amp*Math.cos(age*.78));
  c.translate(0,4);
  targetFront(c);
  if(age>=0&&age<6){
    c.globalAlpha=(1-age/7)*.85;
    rect(c,-10,-46,2,28,'#ffe8a1');rect(c,-8,-53,2,7,'#fff1ae');
    rect(c,-21,-44,7,2,'#ffe7a2');rect(c,-16,-26,6,1,'#fff3ca');
  }
  c.restore();
}
