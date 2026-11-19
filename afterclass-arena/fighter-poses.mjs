// All pose offsets are in the native sprite's pixel grid, origin at the feet.
export function applyMovePose(p,id,move,action,frame) {
  const impact=frame>=2&&frame<=4, early=frame<2;
  if(action==='guard'||action==='block'){
    p.dx=-1;p.dy=3;p.toeB=[-10,0];p.toeF=[9,0];
    p.elbowF=[12,-20];p.fistF=[7,-34];p.elbowB=[-7,-22];p.fistB=[5,-30];return;
  }
  if(action==='crouch'){p.dy=8;p.headY=1;p.kneeF=[10,-5];p.toeF=[12,0];p.toeB=[-10,0];return;}
  if(action==='attack'){
    if(move==='heavy'||move==='finisher'){
      p.dx=early?-4:5;p.headX=impact?2:-1;p.dy=early?3:1;
      p.toeB=[-13,0];p.toeF=[13,0];p.kneeF=[11,-6];
      p.elbowF=early?[-8,-18]:[14,-25];p.fistF=early?[-6,-25]:[26,-29];
    }else if(move==='follow'){
      p.dx=impact?3:-1;p.elbowF=[3,-29];p.fistF=[8,-33];p.elbowB=impact?[8,-17]:[-8,-21];p.fistB=impact?[23,-20]:[-7,-26];
    }else if(move==='sweep'){
      p.dx=impact?3:-1;p.dy=8;p.headX=1;p.kneeF=impact?[12,-4]:[6,-6];p.toeF=impact?[24,-3]:[8,-1];p.kneeB=[-8,-5];p.toeB=[-12,0];
      p.elbowF=[8,-12];p.fistF=[12,-16];p.elbowB=[-10,-12];p.fistB=[-17,-9];
    }else if(move==='air'){
      p.dy=-2;p.headX=-1;p.kneeF=[11,-13];p.toeF=impact?[22,-13]:[12,-7];p.kneeB=[-7,-7];p.toeB=[-12,-7];
      p.elbowF=[8,-26];p.fistF=[12,-31];p.elbowB=[-10,-20];p.fistB=[-13,-26];
    }
  }
  if(action!=='skill'&&action!=='counter')return;
  if(id==='doubao'&&move==='qcf'){
    p.dy=early?3:1;p.fistB=early?[2,-26]:[13,-24];p.fistF=early?[9,-27]:[21,-26];p.elbowF=[9,-18];p.elbowB=[-6,-17];
  }else if(id==='doubao'&&move==='qcb'){
    p.dx=-3;p.fistF=[13,-26];p.elbowF=[6,-28];p.fistB=[-10,-30];p.toeF=[12,-5];
  }else if(id==='jianguo'&&move==='qcf'){
    p.dx=impact?7:0;p.dy=4;p.headX=3;p.fistF=[10,-26];p.elbowF=[15,-20];p.toeB=[-13,-4];p.toeF=[11,0];
  }else if(id==='jianguo'&&move==='qcb'){
    p.dy=early?-1:6;p.elbowB=early?[-13,-31]:[-8,-11];p.fistB=early?[-8,-39]:[-1,-5];p.elbowF=early?[13,-31]:[10,-11];p.fistF=early?[10,-39]:[15,-4];
  }else if(id==='rocket'&&move==='qcf'){
    p.dy=2;p.dx=early?1:-2;p.elbowF=[9,-19];p.fistF=[16,-23];p.fistB=[3,-21];p.toeB=[-10,0];
  }else if(id==='rocket'&&move==='qcb'){
    p.dx=-2;p.dy=-2;p.fistF=[13,-7];p.elbowF=[8,-11];p.kneeB=[-8,-8];p.toeB=[-12,-11];p.toeF=[9,-3];p.tail=-3;
  }else if(id==='iron'&&move==='qcf'){
    p.dx=impact?7:1;p.dy=2;p.headX=2;p.fistF=impact?[27,-26]:[7,-24];p.elbowF=impact?[16,-25]:[5,-18];p.toeB=[-15,-6];p.toeF=[6,-2];
  }else if(id==='iron'&&move==='qcb'){
    p.dx=1;p.elbowF=early?[10,-18]:[11,-35];p.fistF=early?[6,-25]:[11,-48];p.kneeF=[9,-13];p.toeF=[8,-8];p.toeB=[-4,-2];
  }else if(id==='liangzi'){
    if(move==='qcf'){p.dx=impact?6:1;p.dy=5;p.headX=3;p.elbowF=[13,-15];p.fistF=[13,-21];p.toeB=[-12,-6];p.toeF=[13,0];}
    else if(move==='qcb'){const lean=frame%2?4:-3;p.dx=lean;p.headX=lean;p.dy=4;p.fistF=[19+lean,-11];p.elbowF=[12,-16];p.fistB=[-16+lean,-10];p.toeF=[14,0];p.toeB=[-12,0];}
    else{p.fistF=impact?[21,-23]:[5,-25];p.elbowF=[8,-17];p.fistB=[-4,-21];p.toeF=[10,0];}
  }else if(id==='xujingyu'){
    if(move==='qcf'){p.fistF=[11,-29];p.elbowF=[8,-20];p.elbowB=[-9,-23];p.fistB=impact?[-15,-30]:[-10,-30];}
    else if(move==='qcb'){p.dx=-3;p.dy=4;p.fistF=early?[8,-14]:[18,-6];p.elbowF=[9,-13];p.toeB=[-12,0];}
    else{p.dy=early?2:-1;p.fistF=early?[13,-24]:[12,-39];p.elbowF=early?[9,-19]:[14,-30];p.fistB=early?[5,-27]:[5,-33];p.toeF=[9,-2];}
  }
}

function ellipse(ctx,cx,cy,rx,ry,color) {
  ctx.fillStyle=color;
  for(let y=-ry;y<=ry;y++){
    const extent=Math.round(rx*Math.sqrt(Math.max(0,1-y*y/(ry*ry))));
    ctx.fillRect(Math.round(cx-extent),Math.round(cy+y),extent*2+1,1);
  }
}
const outline='#49344b',deep='#b85c32',orange='#e58e36',gold='#f6b73d',sun='#ffda59',light='#ffea88';
function paw(ctx,x,y,rx,ry){
  ellipse(ctx,x,y,rx,ry,outline);ellipse(ctx,x,y-1,rx-1,ry-1,orange);ellipse(ctx,x,y-2,Math.max(1,rx-2),Math.max(1,ry-2),sun);
  ctx.fillStyle='#896348';ctx.fillRect(x+rx-3,y-2,2,2);
}
function eye(ctx,x,y){
  ellipse(ctx,x,y,3,4,outline);ellipse(ctx,x,y-1,3,3,'#fff8d9');ellipse(ctx,x+1,y,2,3,'#779f37');ellipse(ctx,x+1,y,1,2,'#222330');ctx.fillStyle='#ffffff';ctx.fillRect(x+1,y-2,1,1);
}

export function drawNailong(ctx,action,move,frame) {
  const guard=action==='guard'||action==='block',run=action==='run',air=action==='jump'||action==='fall',skill=action==='skill';
  const rolling=skill&&move==='qcf',pound=skill&&move==='qcb',belly=skill&&!rolling&&!pound;
  const stretch=action==='sweep'||guard||action==='crouch'||action==='dodge'||move==='sweep';
  const active=frame>=2&&frame<=4, swing=(run?[-2,-3,-2,-1,2,3,2,1][frame%8]:0);
  ctx.save();
  if(rolling){
    const angle=(frame%6)*Math.PI/3;
    ctx.translate(0,-15);ctx.rotate(angle);ctx.translate(0,15);
  }
  const squat=rolling?7:stretch?4:pound&&active?5:0;
  if(pound&&!active)ctx.translate(0,-2);
  const y=run?swing<0?-1:0:action==='idle'&&frame===2?-1:0;
  ctx.translate(0,y);
  const forward=belly&&active?4:action==='attack'&&active?2:0;
  // Tail and feet precede the pear-shaped belly. Both feet always share the stage anchor.
  ellipse(ctx,-11,-11+squat/2,8,5,outline);ellipse(ctx,-13,-12+squat/2,7,3,orange);ellipse(ctx,-17,-13+squat/2,4,2,gold);
  paw(ctx,-6-swing,air?-4:-2,5,3);paw(ctx,5+swing+(move==='sweep'&&active?9:0),air?-6:-2,5,3);
  const by=-17+Math.round(squat*.45),bx=forward;
  ellipse(ctx,bx,by,13+(rolling?2:0),14-Math.round(squat*.45),outline);
  ellipse(ctx,bx,by-1,12+(rolling?2:0),13-Math.round(squat*.45),orange);
  ellipse(ctx,bx+1,by-2,11+(rolling?2:0),11-Math.round(squat*.4),gold);
  ellipse(ctx,bx+3,by+1,8,8-Math.round(squat*.25),'#ffe8a5');
  ellipse(ctx,bx+3,by,6,6-Math.round(squat*.2),'#fff3c5');
  const hx=forward+(action==='hurt'?-3:0),hy=-32+squat;
  ellipse(ctx,hx,hy,13,13,outline);ellipse(ctx,hx,hy,12,12,orange);
  ellipse(ctx,hx,hy-1,12,11,gold);ellipse(ctx,hx-1,hy-3,10,9,sun);
  ellipse(ctx,hx-4,hy-8,5,3,light);
  eye(ctx,hx-2,hy-2); eye(ctx,hx+8,hy-3);
  ellipse(ctx,hx+4,hy+4,1,2,'#4c2e38');ctx.fillStyle='#e98c69';ctx.fillRect(hx-8,hy+4,3,1);
  const frontX=guard?9:action==='attack'&&active?20:belly&&active?15:12;
  const frontY=guard?-27:pound&&!active?-32:action==='attack'&&active?-18:-17;
  paw(ctx,frontX,frontY+squat/2,4,5);
  paw(ctx,-10,-17+squat/2+(run?swing:guard?-4:0),3,4);
  ctx.restore();
}

export function drawEquipment(ctx,id,action,move,frame,x,y) {
  const paint=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
  if(id==='liangzi'&&(action==='idle'||action==='skill'&&move==='special')){
    ellipse(ctx,x+2,y-3,4,7,'#583a37');ellipse(ctx,x+2,y-3,3,6,'#c1854c');ellipse(ctx,x+1,y-4,2,5,'#f2c77f');
    paint(x,y-8,4,2,'#9b4a38');paint(x+1,y-9,3,1,'#699258');paint(x,y-2,3,1,'#ae744a');
  }
  if(id==='xujingyu'){
    if(action==='skill'&&move!=='qcf'&&frame<2){
      ellipse(ctx,x+1,y-5,5,5,'#3c2835');ellipse(ctx,x+1,y-5,4,4,'#e39048');
      paint(x-3,y-5,9,1,'#7d4e3b');paint(x+1,y-9,1,8,'#724b3f');paint(x-1,y-8,2,1,'#ffe099');
    }else if(action==='idle'||action==='skill'&&move==='qcf'){
      paint(x-1,y-6,3,6,'#31313b');paint(x,y-5,1,4,'#8a98a2');ellipse(ctx,x+1,y-7,3,3,'#302e38');ellipse(ctx,x+1,y-8,2,2,'#79878f');paint(x,y-9,2,1,'#d2d7cf');
    }
  }
}
