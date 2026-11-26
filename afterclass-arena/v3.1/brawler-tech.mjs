// Character-owned state is part of each player's round snapshot.
function enemy(target, owner) {
  return target.id !== owner.id && target.stocks > 0 && target.hp > 0;
}
function toward(p, target, INPUT) {
  return target.x < p.x ? INPUT.left : INPUT.right;
}
function contact(s, p, target, api, move, name, damage, base, extra={}) {
  const dir=Math.sign(target.x-p.x)||p.facing;
  return api.strike(s,{attacker:p,target,char:p.char,move,moveName:name,damage,base,dir,
    x:target.x,y:target.y-22,heavy:base>=6,...extra});
}
const stampJudge={
  init:()=>({seal:0,stampAt:0,stampX:0,stampY:0,stampDir:1}),
  input(s,p,key) {
    if(!p.signature.seal)return key;
    if(key==='special')return 'sealedStamp';
    return key==='super'?'sealedShoulder':key;
  },
  cancel(s,p,key) {
    return p.move==='downSkill'&&p.signature.seal>0&&(key==='sealedStamp'||key==='sealedShoulder');
  },
  counter(s,h,api) {
    const p=h.target;
    if(p.move!=='downSkill')return;
    p.signature.seal=1;p.skillCooldown=0;
    api.emit(s,'sealReady',p.x,p.y-48,p,h.attacker,1,{moveName:'立案得印'});
  },
  begin(s,p,key,api) {
    if(key!=='sealedStamp'&&key!=='sealedShoulder')return;
    const sig=p.signature;sig.seal=0;
    if(key==='sealedShoulder')return;
    const forward=s.players.filter(t=>enemy(t,p)&&(t.x-p.x)*p.facing>=0)
      .sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
    sig.stampX=api.clamp(forward[0]?.x??(p.x+140*p.facing),api.floor.x+24,api.floor.x+api.floor.w-24);
    sig.stampDir=p.facing;sig.stampY=api.floor.y;sig.stampAt=s.tick+19;
    p.skillCooldown=42;
  },
  tick(s,p,bits,api) {
    const sig=p.signature;
    if(!sig.stampAt||s.tick<sig.stampAt)return;
    sig.stampAt=0;
    api.emit(s,'verdict',sig.stampX,sig.stampY-8,p,null,40,{move:'sealedStamp',moveName:'定点宣判'});
    for(const t of s.players){
      if(!enemy(t,p)||Math.abs(t.x-sig.stampX)>40||t.y<sig.stampY-81)continue;
      contact(s,p,t,api,'sealedStamp','定点宣判',20,8,{originX:p.x,dir:sig.stampDir,lift:1.22});
    }
  },
  bot(s,p,t,{INPUT}) {
    if(p.stanceLeft||p.stun||p.knockedDown)return null;
    const dx=(t.x-p.x)*p.facing;
    if(p.signature.seal&&dx>=0&&s.tick%5===0)return dx<75&&p.rage>=100?INPUT.super:INPUT.skill;
    if(dx>0&&dx<140&&(t.action==='attack'||t.action==='skill')&&!p.skillCooldown&&s.tick%5===0)return INPUT.down|INPUT.skill;
    return null;
  }
};
const STRIDE_DISTANCE=150;
function endCarry(sig) {sig.carryTarget=null;sig.carryUntil=0;}
const hiker={
  init:()=>({stride:0,lastX:null,lastDir:0,carryTarget:null,carryUntil:0,grabTried:false}),
  begin(s,p,key) {if(key==='downSkill')p.signature.grabTried=false;},
  tick(s,p,bits,api) {
    const sig=p.signature,dir=Number(!!(bits&api.INPUT.right))-Number(!!(bits&api.INPUT.left));
    if(sig.carryTarget!==null&&(p.stun||p.knockedDown||p.move!=='downSkill'))endCarry(sig);
    if(sig.lastX!==null&&dir&&dir===sig.lastDir&&p.grounded&&!p.stun&&!p.stanceLeft&&!p.guard&&!p.knockedDown){
      const walked=(p.x-sig.lastX)*dir;
      if(walked>0&&walked<7)sig.stride=Math.min(100,sig.stride+100*walked/STRIDE_DISTANCE);
    }
    sig.lastX=p.x;sig.lastDir=dir;
  },
  motion(s,p,bits,api) {
    if(p.move!=='downSkill'||p.stun)return;
    const sig=p.signature;
    if(!sig.grabTried&&p.actionTick>=5) {
      sig.grabTried=true;
      const candidates=s.players.filter(t=>{const dx=(t.x-p.x)*p.facing;
        return enemy(t,p)&&t.grounded&&!t.invuln&&dx>=0&&dx<=55;})
        .sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
      const t=candidates[0];if(!t)return;
      const loaded=sig.stride>=100;
      const result=contact(s,p,t,api,'downSkill',loaded?'卷饼上肩':'大饼卷人',loaded?6:14,loaded?1.8:7.3,
        {ignoreGuard:true,link:loaded,dir:p.facing});
      if(result!=='hit')return;
      if(loaded){
        sig.stride=0;sig.carryTarget=t.id;sig.carryUntil=s.tick+19;
        api.emit(s,'packCarry',p.x,p.y-28,p,t,1,{moveName:'扛包赶路'});
      }else api.emit(s,'packThrow',t.x,t.y-26,p,t,1,{moveName:'大饼卷人'});
    }
    if(sig.carryTarget===null)return;
    const t=s.players.find(v=>v.id===sig.carryTarget);
    if(!t||!enemy(t,p)||t.lastHit!==p.id||t.invuln||p.knockedDown){endCarry(sig);return;}
    if(s.tick>=sig.carryUntil){
      contact(s,p,t,api,'downSkill','翻包过肩',15,9,{ignoreGuard:true,dir:p.facing,lift:1.25});
      api.emit(s,'packThrow',t.x,t.y-26,p,t,2,{moveName:'翻包过肩'});
      endCarry(sig);p.vx=0;return;
    }
    p.vx=p.facing*4.7;
    if(!t.dummy){
      t.x=api.clamp(p.x+p.vx+p.facing*31,api.floor.x+18,api.floor.x+api.floor.w-18);
      t.y=p.y-12;t.vx=0;t.vy=0;t.grounded=false;t.floor=-1;t.stun=Math.max(3,t.stun);
    }
  },
  bot(s,p,t,{INPUT}) {
    const d=Math.abs(t.x-p.x);
    if(p.stanceLeft||p.stun||!p.grounded)return null;
    if(d<52&&t.grounded&&p.facing*(t.x-p.x)>=0&&(p.signature.stride===100||t.guard)&&!p.skillCooldown)return INPUT.down|INPUT.skill;
    if(p.signature.stride<100&&d>130)return toward(p,t,INPUT);
    return null;
  }
};
function prepareRebound(s,q,p,api) {
  const sig=p.signature;
  const endX=api.clamp(q.passOriginX,api.floor.x+22,api.floor.x+api.floor.w-22);
  const endY=api.floor.y-33;
  sig.rebound={x:q.x,y:q.y,startX:q.x,startY:q.y,endX,endY,age:0,
    duration:Math.max(24,Math.min(52,Math.ceil(Math.abs(q.x-endX)/8)))};
  sig.caughtUntil=0;q.life=0;
}
const commentator={
  init:()=>({rebound:null,caughtUntil:0}),
  input(s,p,key) {
    if(s.tick>=p.signature.caughtUntil)return key;
    if(key==='special')return 'quickPass';
    return key==='upSkill'?'alleyOop':key;
  },
  begin(s,p,key) {
    const sig=p.signature;
    if(key==='quickPass'||key==='alleyOop'){
      sig.caughtUntil=0;p.skillCooldown=36;
    }else if(key==='special')sig.rebound=null;
  },
  shotTick(s,q,api) {
    if(!q.reboundPass||q.char!=='xujingyu'||q.support)return;
    const p=s.players.find(t=>t.id===q.owner);
    if(!p||p.char!=='xujingyu')return;
    if(q.passOriginX===undefined)q.passOriginX=p.x;
    if(q.bounces<2||q.age>=47||q.x<=api.floor.x+8||q.x>=api.floor.x+api.floor.w-8)prepareRebound(s,q,p,api);
  },
  shotContact(s,q,target,result,api) {
    if(!q.reboundPass||q.char!=='xujingyu'||q.support||!['hit','block','counter'].includes(result))return;
    const p=s.players.find(t=>t.id===q.owner);
    if(p?.char==='xujingyu')prepareRebound(s,q,p,api);
  },
  tick(s,p,bits,api) {
    const sig=p.signature,ball=sig.rebound;
    if(sig.caughtUntil&&s.tick>=sig.caughtUntil)sig.caughtUntil=0;
    if(!ball)return;
    ball.age++;
    const progress=Math.min(1,ball.age/ball.duration);
    ball.x=ball.startX+(ball.endX-ball.startX)*progress;
    ball.y=ball.startY+(ball.endY-ball.startY)*progress-49*Math.sin(Math.PI*progress);
    if(progress===1)ball.y+=Math.min(22,(ball.age-ball.duration)*2);
    if(progress>=.64&&!p.stun&&!p.knockedDown&&Math.abs(p.x-ball.x)<30&&Math.abs(p.y-31-ball.y)<39){
      sig.rebound=null;sig.caughtUntil=s.tick+100;p.skillCooldown=0;
      api.emit(s,'reboundCatch',p.x,p.y-38,p,null,1,{moveName:'篮板到手'});
    }else if(ball.age>ball.duration+12)sig.rebound=null;
  },
  bot(s,p,t,{INPUT}) {
    if(p.stun||p.stanceLeft||!p.grounded)return null;
    const sig=p.signature;
    if(sig.caughtUntil>s.tick&&s.tick%4===0)return INPUT.skill|(Math.abs(t.x-p.x)<100?INPUT.up:0)|toward(p,t,INPUT);
    if(sig.rebound){
      const dx=sig.rebound.endX-p.x;return Math.abs(dx)>17?(dx<0?INPUT.left:INPUT.right):0;
    }
    if(Math.abs(t.x-p.x)>92&&!p.skillCooldown&&s.tick%21===0)return INPUT.skill|toward(p,t,INPUT);
    return null;
  }
};
const springDragon={
  init:()=>({spring:false,slamming:false,slamHeight:0}),
  input(s,p,key) {return p.signature.spring&&key==='light'?'bellyDrop':key;},
  begin(s,p,key,api) {
    const sig=p.signature;
    if(key==='springJump'){
      sig.spring=true;sig.slamming=false;sig.slamHeight=0;
      p.vx=p.facing*2.8;p.vy=-14.6;p.grounded=false;p.floor=-1;p.coyote=0;p.jumps=0;
    }else if(key==='bellyDrop'){
      sig.spring=false;sig.slamming=true;sig.slamHeight=Math.max(0,Math.min(190,api.floor.y-p.y));
      p.vx*=.32;p.vy=15;
    }else{sig.spring=false;sig.slamming=false;sig.slamHeight=0;}
  },
  tick(s,p,bits,api) {
    const sig=p.signature;
    if(p.stun||p.knockedDown||p.action==='dodge'){
      sig.spring=false;sig.slamming=false;sig.slamHeight=0;return;
    }
    if(p.move==='downSkill'&&p.grounded&&p.actionTick>=3&&p.jumpBuffer>=s.tick){
      p.jumpBuffer=0;p.chainNext=null;p.skillCooldown=Math.max(18,p.skillCooldown);
      api.beginMove(s,p,'springJump');
    }
  },
  motion(s,p) {
    if(p.signature.slamming){p.vx*=.95;p.vy=Math.max(p.vy,15);}
  },
  land(s,p,api) {
    const sig=p.signature;sig.spring=false;
    if(!sig.slamming)return;
    const radius=59+Math.floor(sig.slamHeight*.50),damage=10+Math.floor(sig.slamHeight/32);
    api.emit(s,'bellySlam',p.x,api.floor.y,p,null,radius,{move:'bellyDrop',moveName:'弹力坐墩'});
    for(const t of s.players){
      if(!enemy(t,p)||Math.abs(t.x-p.x)>radius||t.y<api.floor.y-40)continue;
      contact(s,p,t,api,'bellyDrop','弹力坐墩',damage,6.6,{originX:p.x});
    }
    sig.slamming=false;sig.slamHeight=0;
  },
  bot(s,p,t,{INPUT}) {
    if(p.stun||p.knockedDown)return null;
    const d=Math.abs(t.x-p.x);
    if(p.signature.spring&&p.vy>-5&&d<130)return INPUT.attack;
    if(p.move==='downSkill'&&p.actionTick>=7&&p.actionTick<=15&&d<100)return INPUT.jump;
    if(!p.stanceLeft&&p.grounded&&d>50&&d<147&&!p.skillCooldown&&s.tick%11===0)return INPUT.down|INPUT.skill|toward(p,t,INPUT);
    return null;
  }
};
export const TECHNIQUES={jianguo:stampJudge,liangzi:hiker,xujingyu:commentator,nailong:springDragon};
