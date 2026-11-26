// Mechanic state is plain data so the host and all spectators see the same marks, fuses and flight.
function marked(s,p){
  const sig=p.signature;
  return sig.markUntil>s.tick?s.players.find(t=>t.id===sig.markTarget&&t.stocks>0):null;
}
function clearMark(sig){sig.markTarget=null;sig.markUntil=0;}
function areaHit(s,p,api,move,name,x,y,radius,damage,base){
  for(const target of s.players){
    if(target===p||target.stocks<=0)continue;
    const cx=target.x,cy=target.y-api.fighterStats(target).height*.46;
    if(Math.hypot(cx-x,(cy-y)*.90)>radius)continue;
    const dir=Math.sign(cx-x)||p.facing;
    api.strike(s,{attacker:p,target,char:p.char,move,moveName:name,originX:x,dir,x:cx,y:cy,
      damage,base,heavy:base>=6});
  }
}
function forward(p,t,input){return t.x>=p.x?input.right:input.left;}
const doubao={
  init:()=>({markTarget:null,markUntil:0,echoAt:0,echoX:0,echoY:0,echoSuper:false,blinkTarget:null}),
  hit(s,h){
    if(h.move!=='special'||h.char!=='doubao'||!h.shot||h.shot.support)return;
    const sig=h.attacker.signature;sig.markTarget=h.target.id;sig.markUntil=s.tick+180;
  },
  input(s,p,key){
    if(!marked(s,p))return;
    if(key==='downSkill')return 'bookmarkBlink';
    if(key==='upSkill')return 'bookmarkEcho';
    if(key==='super')return 'bookmarkBurst';
  },
  bypass(s,p,key){return key==='bookmarkBlink'||key==='bookmarkEcho';},
  cancel(s,p,key){return p.move==='special'&&p.confirmed&&['bookmarkBlink','bookmarkEcho','bookmarkBurst'].includes(key);},
  begin(s,p,key,api){
    if(!['bookmarkBlink','bookmarkEcho','bookmarkBurst'].includes(key))return;
    const target=marked(s,p);if(!target)return;
    const sig=p.signature;clearMark(sig);
    if(key==='bookmarkBlink'){
      sig.blinkTarget=target.id;
      api.emit(s,'bookmarkTrace',target.x,target.y-30,p,target,1,{facing:p.facing});
      return;
    }
    const boosted=key==='bookmarkBurst';
    sig.echoX=target.x;sig.echoY=target.y-api.fighterStats(target).height*.43;
    sig.echoAt=s.tick+(boosted?20:16);sig.echoSuper=boosted;
  },
  motion(s,p,bits,api){
    if(p.move!=='bookmarkBlink'||p.actionTick!==6||p.signature.blinkTarget==null)return;
    const target=s.players.find(t=>t.id===p.signature.blinkTarget&&t.stocks>0);
    p.signature.blinkTarget=null;if(!target)return;
    const fromX=p.x,fromY=p.y,side=Math.sign(target.x-p.x)||p.facing;
    const space=api.floor.x+api.floor.w;
    p.x=api.clamp(target.x+side*44,api.floor.x+19,space-19);
    if(Math.abs(p.x-target.x)<26)p.x=api.clamp(target.x-side*44,api.floor.x+19,space-19);
    p.y=target.y;p.vx=0;p.vy=0;p.grounded=target.grounded;p.floor=p.grounded?0:-1;
    p.facing=p.walkFacing=Math.sign(target.x-p.x)||-side;
    api.emit(s,'bookmarkBlink',p.x,p.y-24,p,target,2,{fromX,fromY:fromY-24,facing:p.facing});
  },
  tick(s,p,bits,api){
    const sig=p.signature;
    if(sig.markTarget&&!marked(s,p))clearMark(sig);
    if(sig.echoAt&&s.tick>=sig.echoAt){
      const power=sig.echoSuper?32:15,r=sig.echoSuper?96:56;
      const id=sig.echoSuper?'bookmarkBurst':'bookmarkEcho',name=sig.echoSuper?'整段重写':'定点续写';
      sig.echoAt=0;
      api.emit(s,'bookmarkEcho',sig.echoX,sig.echoY,p,null,power,{radius:r,move:id,moveName:name});
      areaHit(s,p,api,id,name,sig.echoX,sig.echoY,r,power,sig.echoSuper?9:5);
    }
  },
  bot(s,p,t,{INPUT:i}){
    const n=s.tick+19*p.slot;
    if(p.stun||p.stanceLeft&&!p.confirmed)return;
    const dir=forward(p,t,i),distance=Math.abs(t.x-p.x);
    if(marked(s,p)&&n%13===0){
      if(p.rage>=100&&n%3===0)return dir|i.super;
      return dir|i.skill|(distance<220?i.down:i.up);
    }
    if(!p.skillCooldown&&distance>75&&n%23===0)return dir|i.skill;
  }
};
function mines(s,p){
  return s.projectiles.filter(q=>q.owner===p.id&&q.kind==='mine'&&q.manual&&q.life>0&&!q.support);
}
function prime(s,p,q,delay,via,api){
  if(q.fuseAt)return;
  q.fuseAt=s.tick+delay;
  api.emit(s,'minePrime',q.x,q.y,p,null,2,{via,radius:q.blastRadius});
}
const rocket={
  init:()=>({mineCount:0,fuseAt:0}),
  input(s,p,key){if(key==='downSkill'&&mines(s,p).length)return 'remoteBurst';},
  bypass(s,p,key){return key==='remoteBurst';},
  cancel(s,p,key){return key==='remoteBurst'&&p.move==='downSkill'&&p.actionTick>=10;},
  begin(s,p,key,api){
    if(key==='remoteBurst'||key==='super'){
      const owned=mines(s,p);
      if(key==='super'&&owned.length)p.moveName='交叉火网';
      for(const [index,q] of owned.entries())prime(s,p,q,(key==='super'?9:14)+index*3,key==='super'?'barrage':'remote',api);
    }
  },
  tick(s,p){
    const owned=mines(s,p);
    p.signature.mineCount=owned.length;
    p.signature.fuseAt=owned.reduce((earliest,q)=>q.fuseAt&&(!earliest||q.fuseAt<earliest)?q.fuseAt:earliest,0);
  },
  shotTick(s,q,api){
    if(q.kind!=='rocket'&&!(q.manual&&q.fuseAt&&q.fuseAt<=s.tick))return;
    const p=s.players.find(p=>p.id===q.owner);
    const r=q.kind==='rocket'?48:q.blastRadius+25;
    for(const trap of mines(s,p)){
      if(trap===q||trap.fuseAt||Math.hypot(trap.x-q.x,trap.y-q.y)>r)continue;
      prime(s,p,trap,q.kind==='rocket'?7:5,'shell',api);
    }
  },
  bot(s,p,t,{INPUT:i}){
    const n=s.tick+17*p.slot;
    if(p.stun||p.stanceLeft)return;
    const active=mines(s,p),dir=forward(p,t,i),distance=Math.abs(t.x-p.x);
    if(active.some(q=>!q.fuseAt&&Math.abs(q.x-t.x)<90)&&n%7===0)return p.rage>=100?dir|i.super:dir|i.down|i.skill;
    if(!active.length&&distance<220&&p.grounded&&!p.skillCooldown&&n%19===0)return dir|i.down|i.skill;
  }
};
function inFlight(s,p){return p.signature.hoverUntil>s.tick;}
const iron={
  init:()=>({hoverUntil:0,hoverStart:0}),
  input(s,p,key,bits,{INPUT:i}){
    if(!inFlight(s,p))return;
    if(key==='airSkill')return bits&i.down?'hoverDive':'hoverVolley';
    if(key==='airSuper')return 'hoverBarrage';
  },
  bypass(s,p,key){return key==='hoverDive'||key==='hoverVolley';},
  cancel(s,p,key){
    return (p.move==='upSkill'&&p.actionTick>=6||p.move==='hoverVolley'&&p.actionTick>=9)&&
      (key==='hoverDive'||key==='hoverBarrage'||key==='hoverVolley'&&p.move!=='hoverVolley');
  },
  begin(s,p,key,api){
    if(key==='upSkill'){
      p.signature.hoverStart=s.tick;p.signature.hoverUntil=s.tick+98;
      api.emit(s,'thrusterLift',p.x,p.y-5,p,null,2);
    }else if(key==='hoverDive'){
      p.signature.hoverUntil=0;
      api.emit(s,'thrusterDive',p.x,p.y-20,p,null,2,{facing:p.facing});
    }
  },
  tick(s,p){
    if(p.stun||p.knockedDown||p.signature.hoverUntil<=s.tick)p.signature.hoverUntil=0;
  },
  motion(s,p,bits,{INPUT:i,clamp,floor}){
    if(!inFlight(s,p)||p.stun||p.knockedDown)return;
    const steer=Number(!!(bits&i.right))-Number(!!(bits&i.left));
    const pitch=Number(!!(bits&i.down))-Number(!!(bits&i.up));
    p.vx=steer*5.4+(steer?0:p.vx*.73);
    const dy=s.tick-p.signature.hoverStart<10?-5.2:pitch*2.5;
    const gravity=p.move==='airSkill'?.15:.60;
    p.vy=clamp(p.y+dy,floor.y-150,floor.y-18)-p.y-gravity;
    p.grounded=false;p.floor=-1;p.coyote=0;
    if(steer&&!p.stanceLeft)p.facing=p.walkFacing;
  },
  land(s,p,api){
    if(p.move==='hoverDive')api.emit(s,'thrusterLand',p.x,p.y-3,p,null,2,{radius:60});
  },
  bot(s,p,t,{INPUT:i}){
    const n=s.tick+13*p.slot,dir=forward(p,t,i),distance=Math.abs(t.x-p.x);
    if(p.stun)return;
    if(inFlight(s,p)&&!p.grounded){
      if(n%18===0){
        if(p.rage>=100&&distance>90)return dir|i.super;
        return distance<85?dir|i.down|i.skill:dir|i.skill;
      }
      return distance>75?dir:0;
    }
    if(p.grounded&&!p.stanceLeft&&!p.skillCooldown&&distance<240&&n%29===0)return dir|i.up|i.skill;
  }
};
export const TECHNIQUES={doubao,rocket,iron};
