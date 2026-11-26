// Fight-space indicators use simulation coordinates. They stay anchored to
// their target on both the LAN host and a client receiving a later snapshot.
const ink='#282233',cyan='#66efef',white='#fff5ce',blue='#3185a8',red='#f47162';
function box(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function poly(c,points,col){
  c.fillStyle=col;c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));
  c.closePath();c.fill();
}
function line(c,x1,y1,x2,y2,col,width=2){
  c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(Math.round(x1),Math.round(y1));c.lineTo(Math.round(x2),Math.round(y2));c.stroke();
}
function ellipse(c,x,y,rx,ry,col,width=2){
  c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);c.stroke();
}
function bookmark(c,x,y){
  poly(c,[[x-5,y-6],[x+5,y-6],[x+5,y+7],[x,y+3],[x-5,y+7]],ink);
  poly(c,[[x-3,y-4],[x+3,y-4],[x+3,y+3],[x,y],[x-3,y+3]],cyan);
  box(c,x-2,y-3,4,2,'#dbffff');
}
function brackets(c,x,y,r,col){
  for(const sign of [-1,1]){
    box(c,x+sign*r-(sign>0?5:0),y,6,3,ink);box(c,x+sign*r-1,y-6,3,8,ink);
    box(c,x+sign*r-(sign>0?4:0),y,5,1,col);box(c,x+sign*r,y-5,1,6,col);
  }
}
function stamp(c,x,y,scale=1){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
  box(c,-6,-14,12,7,ink);box(c,-4,-13,8,4,'#e49168');box(c,-3,-8,6,6,'#773b46');
  poly(c,[[-4,-5],[4,-5],[11,-1],[11,5],[-11,5],[-11,-1]],ink);
  box(c,-9,0,18,3,red);box(c,-8,3,16,1,'#ffbd88');c.restore();
}
function ball(c,x,y,age,reduce){
  c.save();c.translate(Math.round(x),Math.round(y));c.fillStyle=ink;
  c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();
  c.fillStyle='#ffae55';c.beginPath();c.arc(0,0,7.4,0,Math.PI*2);c.fill();
  c.rotate(reduce?0:age*.11);line(c,-7,0,7,0,'#79433b',1.5);
  c.strokeStyle='#79433b';c.lineWidth=1.4;c.beginPath();c.arc(-9,0,9,-.84,.84);c.stroke();
  c.beginPath();c.arc(9,0,9,Math.PI-.84,Math.PI+.84);c.stroke();c.restore();
}
function sprintStep(c,x,y,face,phase){
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(face,1);
  const span=phase?5:0;
  poly(c,[[-13-span,-3],[-9-span,-3],[-6-span,-1],[-6-span,1],[-14-span,1]],'#b47a4c');
  box(c,-19-span,-1,3,2,'#e7b781');c.restore();
}

export function drawSignatureField(c,p,players,tick,ground,reduce){
  const sig=p.signature;if(!sig)return;
  c.save();
  if(p.char==='doubao'){
    const target=sig.markUntil>tick && players.find(q=>q.id===sig.markTarget && q.action!=='ko');
    if(target){
      bookmark(c,target.x-15,target.y-20);
      brackets(c,target.x,target.y+1,14,cyan);
    }
    if(sig.echoAt>tick){
      const x=sig.echoX,y=sig.echoY,r=sig.echoSuper?96:56;
      const inset=reduce?0:Math.min(10,(sig.echoAt-tick)*.45);
      c.globalAlpha=.34;ellipse(c,x,y,r,r/.90,'#57bbca',1);c.globalAlpha=1;
      brackets(c,x,y,r,cyan);
      for(let i=0;i<3;i++)box(c,x-14+i*10,y-5-inset,7,3,'#aefffb');
      bookmark(c,x,y+8);
    }
  }else if(p.char==='jianguo' && sig.stampAt>tick){
    const x=sig.stampX,y=sig.stampY,t=sig.stampAt-tick;
    c.globalAlpha=.22;box(c,x-40,y-4,80,6,red);c.globalAlpha=1;
    brackets(c,x,y-1,40,'#ffab89');
    const gap=reduce?45:22+Math.min(t,16)*2.8;
    for(let n=0;n<3;n++)box(c,x-1,y-gap+10+n*9,2,4,'#e58874');
    stamp(c,x,y-gap,1.14);
  }else if(p.char==='xujingyu' && sig.rebound){
    const b=sig.rebound;
    if(!reduce){
      for(let i=1;i<=3;i++){
        const t=Math.min(1,Math.max(0,(b.age-i*2)/b.duration));
        const x=b.startX+(b.endX-b.startX)*t,y=b.startY+(b.endY-b.startY)*t-49*Math.sin(Math.PI*t);
        box(c,x-2,y-1,4,2,i===1?'#bcfff2':'#5fa597');
      }
    }
    brackets(c,b.endX,ground,15,'#85ebbb');
    ball(c,b.x,b.y,tick,reduce);
    line(c,b.x-13,b.y-6,b.x-10,b.y-10,'#b9ffdf');
    line(c,b.x+10,b.y-10,b.x+13,b.y-6,'#b9ffdf');
  }else if(p.char==='liangzi' && p.grounded && (sig.stride>=100 || sig.carryTarget)){
    sprintStep(c,p.x-4*p.facing,ground,p.facing,0);
    if(!reduce && Math.abs(p.vx)>2)sprintStep(c,p.x-23*p.facing,ground-1,p.facing,1);
  }else if(p.char==='nailong' && sig.slamming){
    const radius=59+Math.floor((sig.slamHeight||0)*.5);
    brackets(c,p.x,ground,radius,'#ffe480');
    ellipse(c,p.x,ground,radius,4,'#a77953',1.5);
  }
  c.restore();
}

export function drawSignatureFighter(c,p,tick,reduce){
  const sig=p.signature;if(!sig)return;
  c.save();c.translate(Math.round(p.x),Math.round(p.y));c.scale(p.facing||1,1);
  if(p.char==='jianguo' && sig.seal){
    box(c,-25,-39,12,13,ink);box(c,-24,-38,10,11,'#ffe6ad');box(c,-22,-36,6,7,'#af4c52');
    box(c,-21,-35,4,1,'#ffde9f');box(c,-21,-32,4,1,'#ffde9f');box(c,-20,-35,1,5,'#ffde9f');
  }else if(p.char==='iron' && sig.hoverUntil>tick){
    for(const [x,y] of [[-12,-7],[8,-10]]){
      const len=reduce?13:11+((tick+x+24)%6);
      poly(c,[[x-4,y],[x+4,y],[x+3,y+6],[x,y+len+5],[x-2,y+9]],'#308cbe');
      poly(c,[[x-2,y],[x+2,y],[x,y+len]],'#c6fffb');
    }
    const remaining=Math.max(0,sig.hoverUntil-tick), total=Math.max(1,sig.hoverUntil-sig.hoverStart);
    const segments=Math.ceil(Math.min(1,remaining/total)*4);
    for(let i=0;i<4;i++)box(c,-23,-25+i*5,3,3,i<segments?'#b0f7ff':'#426177');
  }else if(p.char==='xujingyu' && sig.caughtUntil>tick){
    box(c,14,-21,5,2,'#b4ffe2');
    box(c,16,-24,2,2,'#86e6c2');
  }else if(p.char==='liangzi' && sig.stride>=100){
    for(const x of [-11,9]){
      box(c,x-4,-4,9,2,'#bd7244');box(c,x-2,-5,5,1,'#fff2b6');
    }
  }else if(p.char==='nailong' && sig.spring && !reduce){
    for(let i=0;i<3;i++)box(c,-10+i*9,2+((tick+i*4)%11),3,4,i%2?'#ffa451':'#ffe48c');
  }
  c.restore();
}

export function drawMineCommand(c,q,tick,reduce){
  if(!q.manual)return;
  const due=q.fuseAt>0,remaining=q.fuseAt-tick;
  c.save();c.translate(Math.round(q.x),Math.round(q.y));
  line(c,6,-5,10,-15,ink,3);box(c,9,-16,3,3,due?red:'#8bd9bc');
  if(due){
    const radius=q.blastRadius||64;
    c.globalAlpha=.70;ellipse(c,0,2,radius,5,'#ffac64',1.5);c.globalAlpha=1;
    brackets(c,0,2,radius,red);
    const f=reduce?0:Math.max(0,Math.min(4,Math.floor(remaining/2)));
    line(c,-8,-14,-12-f,-20-f,red);line(c,13,-16,18+f,-20-f,'#ffefaa');
  }
  c.restore();
}

const signatureEvents=new Set(['bookmarkTrace','sealReady','bookmarkBlink','bookmarkEcho','verdict','minePrime','thrusterDive','thrusterLift','packThrow','reboundCatch','bellySlam','thrusterLand']);
export function drawSignatureEvent(c,e,age,reduce){
  if(age<0||age>18||!signatureEvents.has(e.kind))return;
  c.save();c.translate(Math.round(e.x),Math.round(e.y));
  const progress=age/19, travel=reduce?.35:progress;
  c.globalAlpha=1-progress;
  switch(e.kind){
    case 'bookmarkTrace':
      if(age<=6){
        const x=44*(e.facing||1);
        brackets(c,x,23,13,cyan);bookmark(c,x,-5);
      }
      break;
    case 'sealReady':
      if(age<12){
        stamp(c,-13,-3-travel*8,.59);
        box(c,-3,-9,5,2,white);
      }
      break;
    case 'bookmarkBlink':{
      const dx=e.fromX-e.x,dy=e.fromY-e.y;
      if(Number.isFinite(dx)&&Number.isFinite(dy)){
        for(const [cx,cy,side] of [[dx,dy,-1],[0,0,1]]){
          for(let n=0;n<4;n++){
            const offset=(n%2?1:-1)*travel*12;
            box(c,cx+offset-8,cy-23+n*8,16-n*2,2,n%2?cyan:'#beffff');
          }
          brackets(c,cx,cy+4,13+travel*7,side===1?white:blue);
        }
      }
      break;
    }
    case 'bookmarkEcho':
      for(const dir of [-1,1]){
        const x=dir*(12+travel*(e.radius||36));
        box(c,x,-27,3,24,cyan);box(c,x-3,-27,7,3,white);
      }
      break;
    case 'minePrime':
      for(const dx of [-1,1]){
        const offset=dx*(12+travel*9);
        line(c,offset,-7,offset+dx*3,-12,white);
        line(c,offset+dx*3,-12,offset+dx*6,-12,red);
      }
      break;
    case 'thrusterDive':case 'thrusterLift':{
      const down=e.kind==='thrusterDive'?1:-1;
      for(let j=0;j<3;j++){
        const x=(j-1)*9, y=down*(3-travel*16);
        box(c,x-1,y,2,5,'#acf9ff');box(c,x-2,y+5,4,2,'#5dbbdc');
      }
      break;
    }
    case 'verdict':
      brackets(c,0,0,12+travel*24,'#ff936f');
      for(let i=0;i<3;i++)box(c,-9+i*7,-7+travel*4,4,3,'#f18562');
      break;
    case 'packThrow':
      for(let i=0;i<5;i++){const dx=(i-2)*(4+12*travel);box(c,dx,-2-(2-i%3)*6*travel,5,3,i%2?'#efc188':'#9a6d50');}
      break;
    case 'reboundCatch':
      for(const sign of [-1,1]){
        line(c,sign*13,-4,sign*(18+travel*9),-8-travel*3,'#a5ffdd');
        box(c,sign*(13+travel*7),4,4,2,'#f9cc81');
      }
      break;
    case 'bellySlam':case 'thrusterLand':{
      const milk=e.kind==='bellySlam',r=milk?e.power||59:e.radius||60;
      for(const dir of [-1,1]){
        const x=dir*(8+travel*r);
        poly(c,[[x-dir*7,0],[x,-3],[x+dir*4,-11*(1-progress)],[x+dir*7,-7],[x+dir*6,0]],milk?'#ffe08c':'#71dbf4');
      }
      break;
    }
  }
  c.restore();
}
