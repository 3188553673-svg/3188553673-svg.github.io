// Shared fixed-step simulation. State, including input history, is serializable.
import { MOVES, NORMALS, FIGHTER_NORMALS, ASSIST_PARTNERS, ASSIST_MOVES } from './moves.mjs';
export { MOVES } from './moves.mjs';
export const TICK_RATE=60;
export const WORLD={width:1536,height:600,centerX:768,left:-64,right:1600,top:-130,bottom:680};
export const PLATFORMS=[{x:136,y:442,w:1264,h:28,main:true}];
export const MAX_HP=120, MAX_RAGE=300, ROUND_FRAMES=60*TICK_RATE;
const ROUND_BREAK=100, READY_FRAMES=90;
const floor=PLATFORMS[0], center=WORLD.centerX;
const fighter=(name,color,speed,jump,mass,power,reach,height,width)=>({name,color,speed,jump,mass,power,reach,height,width});
export const CHARACTERS={
  doubao:fighter('豆包','#43d9df',5.3,12.6,.96,8,49,57,33),
  jianguo:fighter('灭建国','#b69afd',4.3,12.6,1.23,12,60,67,45),
  rocket:fighter('火箭浣熊','#ffb44c',6.0,12.2,.86,7,47,44,34),
  iron:fighter('钢铁侠','#ff716a',5.2,12.5,1.06,9,53,61,37),
  liangzi:fighter('良子','#e9b776',4.7,12.1,1.18,10,55,65,43),
  xujingyu:fighter('徐静雨','#77dbbd',5.4,12.5,.99,8,52,62,37),
  nailong:fighter('奶龙','#fbd259',5.1,13.5,1.13,9,53,56,43)
};
for(const [id,c] of Object.entries(CHARACTERS)) c.skillName=MOVES[id].special.name;
const DUMMY_ID='training-dummy';
const DUMMY_STATS=fighter('训练木桩','#ceb387',0,0,1,0,0,60,38);
export function fighterStats(p){return p.dummy?DUMMY_STATS:CHARACTERS[p.char];}
export const SKILL_COOLDOWNS={doubao:43,jianguo:55,rocket:54,iron:50,liangzi:46,xujingyu:43,nailong:47};
const INPUT={left:1,right:2,down:4,jump:8,attack:16,skill:32,dodge:64,up:128,super:256,assist:512};
const starts={1:[768],2:[641,895],3:[538,998,768],4:[513,1023,663,873]};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const approach=(v,to,step)=>v+clamp(to-v,-step,step);
const has=(bits,mask)=>!!(bits&mask);
const horizontal=bits=>Number(has(bits,INPUT.right))-Number(has(bits,INPUT.left));
const alive=p=>p.stocks>0 && p.action!=='ko' && !p.respawn;
function body(config,slot,x){
  const dummy=!!config.dummy;
  const char=dummy?DUMMY_ID:Object.hasOwn(CHARACTERS,config.char)?config.char:'doubao';
  const name=dummy?DUMMY_STATS.name:config.name||CHARACTERS[char].name;
  return {id:config.id,name,char,slot,bot:dummy||!!config.bot,dummy,
    x,y:floor.y,vx:0,vy:0,facing:x<=center?1:-1,grounded:true,floor:0,jumps:2,coyote:5,
    action:'idle',actionTick:0,stanceLeft:0,move:null,moveName:'',jab:0,struck:[],confirmed:false,healed:false,
    comboCount:0,comboTarget:null,comboTick:-200,guard:false,guardStun:0,damage:0,stocks:1,kos:0,
    hp:MAX_HP,maxHp:MAX_HP,rage:0,maxRage:MAX_RAGE,roundWins:0,awakened:0,guardFlash:0,
    assistChar:dummy?null:Object.hasOwn(CHARACTERS,config.assistChar)?config.assistChar:ASSIST_PARTNERS[char],
    assistCooldown:0,knockedDown:false,riseWindow:0,dashVariant:0,
    invuln:0,stun:0,freeze:0,respawn:0,skillCooldown:0,dodgeCooldown:0,drop:0,downTicks:0,
    previousInput:0,lastAttackPress:-1000,walkFacing:x<=center?1:-1,jumpBuffer:0,dodgeBuffer:0,
    pending:[],chainNext:null,chainUntil:0,
    lastHit:null,lastHitAt:-1000,landingMove:null};
}
export function createGame(players){
  const roster=players.slice(0,4),training=roster.some(p=>p.dummy);
  const xs=training&&roster.length===2?[center-26,center+26]:(starts[roster.length]||[]);
  const state={tick:0,phase:training?'play':'countdown',countdown:training?0:READY_FRAMES,winner:null,nextId:1,training,
    round:1,timeLeft:training?null:ROUND_FRAMES,roundWinner:null,roundReason:null,roundPause:0,
    players:roster.map((p,i)=>body(p,i,xs[i])),projectiles:[],assists:[],events:[]};
  for(const p of state.players){
    if(training&&!p.dummy)p.rage=MAX_RAGE;
    const target=targetFor(state,p);
    if(target)p.walkFacing=p.facing=Math.sign(target.x-p.x)||p.facing;
  }
  return state;
}
function emit(s,kind,x,y,a=null,b=null,power=1,meta={}){
  const e={id:s.nextId++,tick:s.tick,kind,x,y,source:a?.id??null,target:b?.id??null,power,
    char:a?.char,move:a?.move,moveName:a?.moveName,...meta};
  s.events.push(e);return e;
}
function pose(p,action){
  if(p.action!==action) p.actionTick=0;
  p.action=action;
}
function clearMove(p){
  p.stanceLeft=0;p.move=null;p.moveName='';p.confirmed=false;
}
function inputBits(row){
  let bits=0;
  for(const [key,mask] of Object.entries(INPUT)) if(row?.[key]) bits|=mask;
  return bits;
}
function targetFor(s,p){
  let target=null,best=Infinity;
  for(const q of s.players){
    if(q===p||!alive(q))continue;
    const distance=Math.abs(q.x-p.x)+Math.abs(q.y-p.y)*.60+(q.invuln?95:0);
    if(distance<best){best=distance;target=q;}
  }
  return target;
}
const THROW={name:'近身摔',frames:22, ignoreGuard:true, hits:[{from:2,to:5,damage:14,base:9,reach:40,lift:1.12,ignoreGuard:true}]};
const DIRECTIONAL_NORMALS=new Set(['upAttack','downAttack']);
const PROJECTILE_MOVES=new Set(['special','upSkill','downSkill','airSkill']);
function normalFor(p,key){return NORMALS[key]?{...NORMALS[key],...FIGHTER_NORMALS[p.char]?.[key]}:null;}
function technique(p,key){return key==='throw'?THROW:key==='assist'?ASSIST_MOVES[p.assistChar]:MOVES[p.char]?.[key];}
function spend(s,p,cost){
  if(p.rage<cost)return false;
  if(!s.training)p.rage-=cost;
  return true;
}
function readControls(s,p,bits){
  const dir=horizontal(bits),pressed=bits&~p.previousInput,down=has(bits,INPUT.down),up=has(bits,INPUT.up);
  p.previousInput=bits;
  if(dir)p.walkFacing=dir;
  if(pressed&INPUT.dodge){p.dodgeBuffer=s.tick+8;p.dashVariant=down?-1:up?1:0;}
  if(pressed&INPUT.attack)p.lastAttackPress=s.tick;
  const awaken=(p.char==='iron'||p.char==='nailong')&&p.grounded&&!p.awakened&&p.rage===MAX_RAGE&&
    has(pressed,INPUT.jump)&&has(bits,INPUT.attack)&&s.tick-p.lastAttackPress<=3;
  if(!awaken&&pressed&INPUT.jump)p.jumpBuffer=s.tick+12;
  while(p.pending.length&&p.pending[0].until<s.tick)p.pending.shift();
  const airborne=!p.grounded||has(pressed,INPUT.jump);
  let key;
  if(awaken)key='awaken';
  else if(pressed&INPUT.assist)key='assist';
  else if(pressed&INPUT.super)key=airborne?'airSuper':down?'downSuper':up?'upSuper':'super';
  else if(pressed&INPUT.skill)key=airborne?'airSkill':down?'downSkill':up?'upSkill':'special';
  else if(pressed&INPUT.attack)key=airborne?'light':down?'downAttack':up?'upAttack':'light';
  if(!key)return;
  if(key==='awaken'||key==='assist')p.pending.length=0;
  if(p.pending.length<3)p.pending.push({key,until:s.tick+30});
}
function botControls(s,p){
  const t=targetFor(s,p);if(!t)return 0;
  const n=s.tick+23*p.slot,dx=t.x-p.x,dy=t.y-p.y,d=Math.abs(dx);
  const forward=dx>=0?INPUT.right:INPUT.left, horizontalInput=d>28||p.facing!==(dx>=0?1:-1)?forward:0;
  if(p.stun&&p.rage>=100&&n%30===0)return INPUT.assist;
  if(p.knockedDown&&p.y>floor.y-23&&n%4===0)return INPUT.dodge;
  if(Math.abs(dy)>55&&dy<0&&p.grounded&&d<275&&n%13===0)return horizontalInput|INPUT.jump;
  if(d>250){
    if(n%75===10)return forward|INPUT.dodge;
    if(n%47===2&&!p.skillCooldown)return forward|INPUT.skill;
    return forward;
  }
  if(d<110&&p.facing===(dx>=0?1:-1)&&['attack','skill'].includes(t.action)&&n%35<10)return INPUT.down;
  if(p.rage>=100&&n%85===0)return horizontalInput|INPUT.super|(p.rage===MAX_RAGE?INPUT.down:0);
  if(p.rage>=100&&n%141===0&&!p.assistCooldown)return horizontalInput|INPUT.assist;
  if(!p.skillCooldown&&n%43===0)return horizontalInput|INPUT.skill|(Math.floor(n/43)%2?0:INPUT.up);
  if(d<CHARACTERS[p.char].reach+15&&Math.abs(dy)<59&&n%8===0)
    return horizontalInput|INPUT.attack|(Math.floor(n/8)%9===4?INPUT.up:Math.floor(n/8)%9===7?INPUT.down:0);
  return horizontalInput;
}
function beginMove(s,p,key){
  const special=technique(p,key),cfg=special||normalFor(p,key);
  if(!cfg)return;
  p.facing=p.walkFacing;p.move=key;p.moveName=cfg.name;p.action=special?(cfg.counter?'counter':'skill'):'attack';
  p.actionTick=0;p.stanceLeft=cfg.frames;p.confirmed=false;p.struck=[];p.healed=false;p.guard=false;p.guardStun=0;
  p.chainNext=cfg.next||null;p.chainUntil=s.tick+cfg.frames+13;p.jab=key==='follow'?1:0;
  if(PROJECTILE_MOVES.has(key))p.skillCooldown=SKILL_COOLDOWNS[p.char];
  // A jump-in briefly arrests the initial rise. Both kicks stay in range of a grounded opponent.
  if(key==='air'&&p.vy<0)p.vy=Math.max(-4.8,p.vy*.55);
  if(key==='airFinish')p.vy=Math.max(1,p.vy);
  if(!special&&p.grounded)p.vx+=p.facing*(cfg.lunge??(key==='finisher'?3:1.8));
  emit(s,special?'skill':'swing',p.x+p.facing*14,p.y-30,p,null,special?2:1);
}
function canThrow(s,p){
  return p.grounded&&s.players.some(t=>alive(t)&&t!==p&&t.grounded&&(t.guard||t.guardStun)&&
    Math.abs(t.y-p.y)<15&&(t.x-p.x)*p.walkFacing>=0&&Math.abs(t.x-p.x)<=
    (fighterStats(p).width+fighterStats(t).width)*.36+6);
}
function startAction(s,p,bits){
  const intent=p.pending[0],normal=normalFor(p,p.move);
  const jumpCancel=p.stanceLeft&&p.confirmed&&(normal||p.move==='upAttack')&&p.jumpBuffer>=s.tick&&p.jumps>0;
  if(jumpCancel){clearMove(p);p.chainNext=null;}
  else if(p.stanceLeft){
    if(!intent||!p.move)return;
    if(intent.key==='awaken'&&p.move==='jab'&&p.actionTick<=4){clearMove(p);}
    const linkAt=normal?(p.confirmed?normal.start:normal.start+normal.active):Infinity;
    const correctHeight=p.grounded?p.chainNext!=='airFinish':p.chainNext==='airFinish';
    const canFollow=intent.key==='light'&&p.chainNext&&correctHeight&&p.actionTick>=linkAt;
    const paidCancel=PROJECTILE_MOVES.has(p.move)&&technique(p,intent.key)?.cost>0;
    const canSpecial=p.confirmed&&technique(p,intent.key)&&(normal||DIRECTIONAL_NORMALS.has(p.move)||paidCancel);
    if(p.stanceLeft&&!canFollow&&!canSpecial)return;
  }
  if(p.jumpBuffer>=s.tick&&(p.grounded||p.jumps>0)){
    const ground=p.grounded||p.coyote>0;
    p.jumps=ground?1:Math.max(0,p.jumps-1);p.jumpBuffer=0;p.coyote=0;p.chainNext=null;
    p.grounded=false;p.floor=-1;p.vy=-CHARACTERS[p.char].jump*(ground?1:.91);
    emit(s,'jump',p.x,p.y,p,null,ground?1:2);
  }
  if(p.dodgeBuffer>=s.tick&&!p.dodgeCooldown){
    const ghost=!!p.dashVariant&&spend(s,p,100);
    clearMove(p);p.chainNext=null;p.pending.length=0;p.dodgeBuffer=0;p.dodgeCooldown=ghost?36:26;
    p.invuln=ghost?18:6;p.stanceLeft=ghost?18:11;p.action='dodge';p.actionTick=0;p.guard=false;
    const dir=horizontal(bits)||p.walkFacing;
    p.vx=dir*(ghost?16:11);if(ghost&&p.dashVariant===1){p.vy=-7;p.grounded=false;p.floor=-1;}else p.vy=Math.min(0,p.vy)*.45;
    emit(s,'dodge',p.x,p.y-20,p,null,ghost?3:1,{moveName:ghost?'幽步':'冲刺'});return;
  }
  if(!intent)return;
  let key=intent.key;
  if((key==='light'||key==='special')&&!p.stanceLeft&&canThrow(s,p))key='throw';
  if(key==='light'){
    const next=s.tick<=p.chainUntil?p.chainNext:null;
    key=p.grounded?(next==='follow'||next==='finisher'?next:'jab'):(next==='airFinish'?next:'air');
  }
  if(key==='assist'){p.pending.shift();summonAssist(s,p);return;}
  if(key==='awaken'){
    p.pending.shift();
    if(p.grounded&&spend(s,p,MAX_RAGE)){
      clearMove(p);p.awakened=600;p.invuln=22;p.stanceLeft=18;p.action='skill';p.actionTick=0;
      p.moveName=p.char==='iron'?'反应堆过载':'爆奶觉醒';p.guard=false;
      emit(s,'awaken',p.x,p.y-25,p,null,3,{moveName:p.moveName});
    }
    return;
  }
  if(PROJECTILE_MOVES.has(key)&&p.skillCooldown)return;
  p.pending.shift();
  const cost=technique(p,key)?.cost||0;
  if(spend(s,p,cost))beginMove(s,p,key);
}
const SHOTS={
  bubble:{speed:8.2,radius:12,damage:10,base:5.1,life:74},
  orb:{speed:5.9,radius:25,damage:17,base:8,life:100},
  beam:{speed:14,radius:7,damage:5,base:3.5,life:42},
  mine:{speed:4.3,vy:-4.4,gravity:.43,radius:10,damage:15,base:8,life:285,blastRadius:86},
  rocket:{speed:11,radius:10,damage:14,base:8,life:65,blastRadius:71},
  ball:{speed:7,vy:-6,gravity:.32,bounces:2,radius:10,damage:11,base:6.2,life:130},
  disc:{speed:9,radius:11,damage:4,base:2,life:47},
  shock:{speed:9,radius:15,damage:13,base:7.8,life:31}
};
function projectile(s,p,spec,face=p.facing,move=p.move,origin=p){
  const support=origin!==p;
  const q={...SHOTS[spec.kind],...spec,id:s.nextId++,owner:p.id,char:origin.char,move,facing:face,
    moveName:support?ASSIST_MOVES[origin.char].name:hitMeta(p,move).moveName,support,empowered:!support&&p.awakened>0,age:0,rest:false};
  q.x=origin.x+face*(spec.offsetX??(q.kind==='mine'?15:24));
  q.y=origin.y-(spec.height??(q.kind==='shock'?5:q.kind==='mine'?22:CHARACTERS[origin.char].height*.54))+(spec.offsetY||0);
  q.vx=face*q.speed;q.vy=q.vy||0;
  if(q.kind==='mine'){
    const active=s.projectiles.filter(o=>o.owner===p.id&&o.kind==='mine'&&o.life>0);
    if(active.length>=3)active[0].life=0;
  }
  s.projectiles.push(q);
}
function movement(s,p,bits,skill){
  if(p.stun||p.guardStun||p.knockedDown){p.vx*=p.grounded ? .90 : .99;return;}
  if(p.action==='dodge'&&p.stanceLeft){p.vx*=.966;return;}
  if(skill&&p.stanceLeft){
    const impulse=skill.motion?.find(m=>m.at===p.actionTick);
    if(impulse){
      if(impulse.vx!==undefined)p.vx=p.facing*impulse.vx;
      if(impulse.vy!==undefined){p.vy=impulse.vy;p.grounded=false;p.floor=-1;}
      if(skill.landing)p.landingMove=p.move;
    }else p.vx*=skill.motion?.length ? .954 : .85;
    for(const spec of skill.shots||[])if(spec.at===p.actionTick)projectile(s,p,spec);
    return;
  }
  const dir=horizontal(bits),c=fighterStats(p),busy=p.stanceLeft>0;
  const target=p.guard?0:dir*c.speed*(p.awakened?1.15:1)*(busy ? .36 : 1);
  p.vx=approach(p.vx,target,(p.grounded?1.15:.50)*(busy ? .56 : 1));
}
function platformCrossed(x,oldY,y,drop,training){
  let idx=-1;
  const count=training?1:PLATFORMS.length;
  for(let i=0;i<count;i++){
    const f=PLATFORMS[i];
    if((drop&&!f.main)||x<f.x-4||x>f.x+f.w+4)continue;
    if(oldY<=f.y+.15&&y>=f.y&&(idx<0||PLATFORMS[idx].y>f.y))idx=i;
  }
  return idx;
}
function summonAssist(s,p,escape=false){
  const char=p.assistChar,cfg=ASSIST_MOVES[char];
  if(!cfg||p.assistCooldown||!spend(s,p,cfg.cost??100))return false;
  const facing=p.walkFacing, support={id:s.nextId++,owner:p.id,char,move:'assist',facing,
    x:clamp(p.x-34*facing,floor.x+18,floor.x+floor.w-18),y:p.y,age:0,struck:[]};
  s.assists.push(support);p.assistCooldown=150;p.facing=facing;p.chainNext=null;
  clearMove(p);p.guard=false;
  if(escape){
    p.stun=0;p.freeze=0;p.guardStun=0;p.knockedDown=false;p.riseWindow=0;p.invuln=24;
    p.vx=-facing*5;p.vy=-4;p.grounded=false;p.floor=-1;p.stanceLeft=12;p.action='dodge';p.actionTick=0;
  }else{
    p.move='assist';p.moveName=cfg.name;p.stanceLeft=14;p.action='skill';p.actionTick=0;
  }
  emit(s,escape?'escape':'assist',support.x,support.y-20,p,null,2,{partner:char,facing,move:'assist',moveName:cfg.name});
  return true;
}
function updateAssists(s){
  for(const q of s.assists){
    const owner=s.players.find(p=>p.id===q.owner),cfg=ASSIST_MOVES[q.char];q.age++;
    if(!alive(owner))continue;
    for(const m of cfg.motion||[])if(m.at===q.age){q.vx=q.facing*(m.vx||0);q.vy=m.vy||0;}
    if(q.vx||q.vy){q.x=clamp(q.x+(q.vx||0),floor.x+16,floor.x+floor.w-16);
      q.y=Math.min(floor.y,q.y+(q.vy||0));q.vx*=.91;q.vy=q.y>=floor.y?0:(q.vy||0)+.6;}
    for(const shot of cfg.shots||[])if(shot.at===q.age)projectile(s,owner,shot,q.facing,'assist',q);
    for(const [index,h] of (cfg.hits||[]).entries()){
      if(q.age<h.from||q.age>h.to)continue;
      for(const t of s.players){
        const token=index+'/'+t.id,dx=(t.x-q.x)*q.facing,dy=q.y-t.y;
        if(t===owner||!alive(t)||q.struck.includes(token)||dx< -12||dx>h.reach+fighterStats(t).width*.42||
          dy< -fighterStats(t).height||dy>CHARACTERS[q.char].height+(h.extraTop||0))continue;
        const result=strike(s,{...h,attacker:owner,target:t,char:q.char,move:'assist',moveName:cfg.name,
          x:q.x+dx*q.facing*.5,y:t.y-24,dir:q.facing,originX:q.x,heavy:h.base>=6,support:true});
        if(result!=='miss')q.struck.push(token);
      }
    }
  }
  s.assists=s.assists.filter(q=>q.age<Math.max(24,ASSIST_MOVES[q.char].frames)&&s.players.some(p=>p.id===q.owner&&alive(p)));
}
function stayOnStage(p){const half=fighterStats(p).width*.4;p.x=clamp(p.x,floor.x+half,floor.x+floor.w-half);}
function recover(s,p){
  p.dodgeBuffer=0;p.knockedDown=false;p.riseWindow=0;p.stun=0;p.freeze=0;p.invuln=14;p.dodgeCooldown=16;
  p.stanceLeft=7;p.action='dodge';p.actionTick=0;p.vx=p.walkFacing*4;p.vy=0;
  emit(s,'tech',p.x,p.y-5,p,null,2,{moveName:'落地受身'});
}
function updateBody(s,p,bits){
  readControls(s,p,bits);
  if((p.stun||p.knockedDown)&&p.pending[0]?.key==='assist'){
    p.pending.shift();summonAssist(s,p,true);
  }
  if(p.freeze>0){p.freeze--;return;}
  for(const key of ['invuln','stun','guardStun','guardFlash','skillCooldown','dodgeCooldown','assistCooldown','awakened','riseWindow'])if(p[key]>0)p[key]--;
  if(p.stanceLeft>0&&--p.stanceLeft===0)clearMove(p);
  p.actionTick++;
  if(p.dummy){
    if(!p.stun)pose(p,'idle');
    return;
  }
  if(p.knockedDown&&p.grounded&&p.riseWindow&&p.dodgeBuffer>=s.tick)recover(s,p);
  if(p.knockedDown&&p.grounded&&!p.riseWindow)p.knockedDown=false;
  if(!p.stun&&!p.guardStun&&!p.stanceLeft)p.facing=p.walkFacing;
  p.guard=!p.stun&&!p.stanceLeft&&p.grounded&&has(bits,INPUT.down);
  if(!p.stun&&!p.guardStun&&!p.knockedDown)startAction(s,p,bits);
  const skill=p.move==='assist'?null:technique(p,p.move);
  movement(s,p,bits,skill);
  const hover=skill?.hover&&p.actionTick>=skill.hover[0]&&p.actionTick<=skill.hover[1];
  const ground=p.grounded;
  p.vy=Math.min(19,p.vy+(hover ? .15 : .60));
  p.x+=p.vx;stayOnStage(p);p.y+=p.vy;
  p.grounded=p.y>=floor.y&&p.vy>=0;p.floor=p.grounded?0:-1;
  if(p.grounded){
    p.y=floor.y;p.coyote=5;
    if(!ground&&p.vy>4.5)emit(s,'land',p.x,p.y,p,null,Math.round(p.vy));
    if(!ground&&p.knockedDown){
      p.riseWindow=8;p.stun=Math.max(p.stun,12);
      if(p.dodgeBuffer>=s.tick)recover(s,p);
    }
    if(p.landingMove){
      const move=p.landingMove,power=MOVES[p.char][move].landingPower;
      for(const dir of [-1,1])projectile(s,p,{kind:'shock',damage:power},dir,move);
      emit(s,'blast',p.x,p.y-3,p,null,power,{move});p.landingMove=null;
    }
    p.vy=0;p.jumps=2;
  }else if(p.coyote>0&&--p.coyote===0)p.jumps=Math.min(1,p.jumps);
  if(!p.stanceLeft&&!p.stun&&!p.knockedDown){
    pose(p,p.grounded?(p.guard||p.guardStun?'guard':Math.abs(p.vx)>.8?'run':'idle'):(p.vy<0?'jump':'fall'));
  }
  if(p.comboCount&&s.tick-p.comboTick>35)p.comboCount=0;
}
function hitMeta(p,move=p.move){return {char:p.char,move,moveName:(technique(p,move)||normalFor(p,move))?.name||''};}
function collectMelee(s,p,contacts){
  if(!alive(p)||p.freeze||!p.move||p.move==='assist'||!p.stanceLeft)return;
  const c=CHARACTERS[p.char],move=p.move,n=normalFor(p,move);
  const specs=n?[{from:n.start,to:n.start+n.active-1,damage:c.power+n.damage,base:n.base,reach:c.reach+n.reach,
    level:n.level,link:n.link,lift:n.lift,omni:n.omni,rebound:n.rebound}]:technique(p,move)?.hits||[];
  for(const [index,spec] of specs.entries()){
    if(p.actionTick<spec.from||p.actionTick>spec.to)continue;
    const y=p.y-(spec.level==='low'?10:spec.level==='air'?3:c.height*.53);
    for(const target of s.players){
      const token=index+'/'+target.id;
      if(p===target||!alive(target)||p.struck.includes(token))continue;
      const dx=(target.x-p.x)*p.facing,shape=fighterStats(target);
      if((spec.omni?Math.abs(dx):dx)>spec.reach+shape.width*.42||!spec.omni&&dx< -12)continue;
      if(y<target.y-shape.height-10||y>target.y+13+(spec.extraTop||0))continue;
      contacts.push({...spec,...hitMeta(p),attacker:p,target,token,x:(p.x+target.x)/2,y,
        dir:spec.omni?(Math.sign(target.x-p.x)||p.facing):p.facing,heavy:spec.base>=6});
    }
  }
}
function hurt(s,h){
  const {attacker:a,target:b,base,dir,x,y}=h;
  const boosted=h.shot?h.shot.empowered:!h.support&&a.awakened>0;
  const damage=Math.max(1,Math.round(h.damage*(boosted?1.25:1)));
  const linked=b.lastHit===a.id&&(b.stun>0||b.freeze>0||s.tick-b.lastHitAt<=1);
  a.comboCount=linked&&a.comboTarget===b.id?a.comboCount+1:1;
  a.comboTarget=b.id;a.comboTick=s.tick;
  if(s.training)b.damage=clamp(b.damage+damage,0,9999);
  else{
    b.hp=Math.max(0,b.hp-damage);
    const paid=h.move==='assist'||technique(a,h.move)?.cost>0;
    if(!paid)a.rage=Math.min(MAX_RAGE,a.rage+Math.ceil(damage*1.6));
    b.rage=Math.min(MAX_RAGE,b.rage+Math.ceil(damage*1.3));
  }
  const launch=base/fighterStats(b).mass;
  if(!b.dummy){
    b.vx=dir*(h.link?Math.min(1.9,launch*.55):launch);
    b.vy=h.link?(b.grounded?0:-1.4):-Math.min(22,(3.3+launch*.53)*(h.lift||1));
    if(!h.link){b.knockedDown=!!h.heavy;b.riseWindow=0;b.grounded=false;b.floor=-1;b.coyote=0;b.jumps=Math.min(1,b.jumps);}
    if(h.move==='air'&&h.link){
      b.vy=clamp(a.vy-1.4,-11,-4);b.grounded=false;b.floor=-1;b.coyote=0;b.jumps=Math.min(1,b.jumps);
    }
  }
  b.stun=h.link?20:Math.min(53,Math.round(8+launch*1.22));
  b.lastHit=a.id;b.lastHitAt=s.tick;b.freeze=h.heavy?7:h.link?4:5;
  b.guard=false;b.guardStun=0;b.landingMove=null;b.pending.length=0;b.chainNext=null;b.jumpBuffer=0;b.dodgeBuffer=0;
  clearMove(b);b.action='hurt';b.actionTick=0;
  const meta={char:h.char,move:h.move,moveName:h.moveName,heavy:!!h.heavy,launch:Math.round(launch*10)/10,combo:a.comboCount};
  emit(s,'hit',x,y,a,b,damage,meta);
}
function strike(s,h){
  const {attacker:a,target:b,shot}=h;
  if(!alive(b)||b.invuln)return 'miss';
  // A projectile's direction stays meaningful when its caster has crossed over.
  const front=shot?h.dir*b.facing<0:((h.originX??a.x)-b.x)*b.facing>=-5;
  if(b.action==='counter'&&b.actionTick<=14&&front&&!h.ignoreGuard){
    b.actionTick=14;b.stanceLeft=16;b.invuln=9;
    emit(s,'counter',b.x,b.y-34,b,a,18,{heavy:true});
    if(shot && !['mine','shock'].includes(shot.kind)){
      shot.owner=b.id;shot.facing=b.facing;shot.vx=Math.abs(shot.vx)*b.facing;
      shot.x=b.x+b.facing*(fighterStats(b).width*.55+shot.radius+5);shot.age=0;return 'reflect';
    }
    if(Math.abs(a.x-b.x)<112&&alive(a)&&!a.invuln){
      hurt(s,{...hitMeta(b),attacker:b,target:a,dir:b.facing,x:a.x,y:a.y-28,damage:18,base:9,heavy:true});
      b.struck.push('0/'+a.id);
    }
    return 'counter';
  }
  if(!h.ignoreGuard&&front&&b.grounded&&!b.stun&&!b.stanceLeft&&(b.guard||b.guardStun)){
    b.guard=true;b.guardStun=h.heavy?10:6;b.guardFlash=9;b.action='guard';b.vx=h.dir*(h.heavy?3.7:1.6);
    b.freeze=h.heavy?4:2;
    if(!s.training){
      b.hp=Math.max(Math.min(b.hp,1),b.hp-Math.ceil(h.damage*.05));b.rage=Math.min(MAX_RAGE,b.rage+5);
      if(!h.support&&!technique(a,h.move)?.cost)a.rage=Math.min(MAX_RAGE,a.rage+3);
    }
    if(!shot&&!h.support)a.freeze=Math.max(a.freeze,h.heavy?3:2);
    emit(s,'block',h.x,h.y,a,b,h.damage,{char:h.char,move:h.move,moveName:h.moveName,heavy:h.heavy});return 'block';
  }
  hurt(s,h);
  if(!h.support&&!shot?.support){
    if(a.move===h.move)a.confirmed=true;
    if(!shot){
      a.freeze=Math.max(a.freeze,h.heavy?6:3);
      if(h.rebound){a.vy=-h.rebound;a.grounded=false;a.floor=-1;}
    }
    const heal=technique(a,h.move)?.heal;
    if(heal&&!a.healed){a.hp=Math.min(a.maxHp,a.hp+heal);a.healed=true;}
  }
  return 'hit';
}
function updateShots(s){
  for(const q of s.projectiles){
    if(q.life<=0)continue;
    q.age++;q.life--;
    const oldY=q.y;q.x+=q.vx;
    if(!q.rest){q.vy+=q.gravity||0;q.y+=q.vy;}
    if(q.gravity&&!q.rest){
      const crossed=q.vy>=0?platformCrossed(q.x,oldY+q.radius*.4,q.y+q.radius*.4,0,s.training):-1;
      if(crossed>=0){
        q.y=PLATFORMS[crossed].y-q.radius*.4;
        if(q.kind==='mine'){q.vx=0;q.vy=0;q.rest=true;}
        else if(q.bounces>0){q.bounces--;q.vy=-(q.bounceSpeed||Math.max(5.1,Math.abs(q.vy)*.76));}
        else {q.life=0;continue;}
      }
    }
    const a=s.players.find(p=>p.id===q.owner);
    if(!a||!alive(a)){q.life=0;continue;}
    const targets=s.players.filter(p=>p!==a&&alive(p)&&!p.invuln);
    const h=t=>({attacker:a,target:t,shot:q,move:q.move,moveName:q.moveName,char:q.char,support:q.support,ignoreGuard:q.ignoreGuard,x:q.x,y:q.y,dir:q.facing,
      damage:q.damage,base:q.base,heavy:q.base>=6,level:q.kind==='shock'?'low':null,link:q.link??(q.kind==='disc'&&q.damage<=4),lift:q.lift});
    const dist=t=>Math.hypot(t.x-q.x,(t.y-fighterStats(t).height*.34-q.y)*.82);
    const overlap=t=>Math.abs(t.x-q.x)<q.radius+fighterStats(t).width*.48&&
      q.y>=t.y-fighterStats(t).height-q.radius&&q.y<=t.y+q.radius;
    if(q.kind==='mine'||q.kind==='rocket'){
      const contact=q.kind==='mine'?(q.age>=14&&targets.some(t=>dist(t)<47)):targets.some(overlap);
      if(!contact)continue;
      const first=targets.find(overlap);
      if(q.kind==='rocket' && first?.action==='counter' && first.actionTick<=14 && q.facing*first.facing<0){
        if(strike(s,h(first))==='reflect')continue;
      }
      emit(s,'blast',q.x,q.y,a,null,q.damage,{char:q.char,move:q.move,heavy:true});
      for(const t of targets)if(dist(t)<q.blastRadius){
        const hit=h(t);if(q.kind==='mine')hit.dir=Math.sign(t.x-q.x)||q.facing;
        strike(s,hit);
      }
      q.life=0;
    }else{
      const t=targets.find(overlap);if(!t)continue;
      if(strike(s,h(t))!=='reflect')q.life=0;
    }
  }
  s.projectiles=s.projectiles.filter(q=>q.life>0&&q.x>WORLD.left-45&&q.x<WORLD.right+45&&q.y<WORLD.bottom);
}
function knockOut(s,p){
  p.stocks=0;p.hp=0;
  const scorer=s.players.find(other=>other.id===p.lastHit);
  if(scorer&&s.tick-p.lastHitAt<450)scorer.kos++;
  emit(s,'ko',p.x,p.y-26,scorer,p);
  clearMove(p);p.vx=0;p.vy=0;p.stun=0;p.freeze=0;p.guard=false;p.invuln=0;p.action='ko';p.actionTick=0;
}
function finishRound(s,contenders,reason){
  const best=Math.max(...contenders.map(p=>p.hp));
  const winners=contenders.filter(p=>p.hp===best);
  for(const p of winners)p.roundWins++;
  const champion=winners.filter(p=>p.roundWins>=2);
  s.roundWinner=winners.length===1?winners[0].id:null;
  s.roundReason=winners.length===1?reason:'draw';
  s.projectiles=[];s.assists=[];
  emit(s,'round',center,270,winners.length===1?winners[0]:null,null,1,{reason:s.roundReason});
  if(champion.length){
    s.phase='over';s.winner=champion.length===1?champion[0].id:null;
    emit(s,'win',center,260,champion.length===1?champion[0]:null);
  }else{s.phase='roundEnd';s.roundPause=ROUND_BREAK;}
}
function nextRound(s){
  const xs=starts[s.players.length];
  s.players=s.players.map((old,i)=>({...body(old,i,xs[i]),roundWins:old.roundWins,rage:old.rage,kos:old.kos}));
  for(const p of s.players){
    const other=targetFor(s,p);
    if(other)p.walkFacing=p.facing=Math.sign(other.x-p.x)||p.facing;
  }
  s.round++;s.phase='countdown';s.countdown=READY_FRAMES;s.timeLeft=ROUND_FRAMES;s.roundWinner=null;s.roundReason=null;
}
function separateGroundedPlayers(s){
  // Grounded pushes preserve left/right ordering during multi-hit strings.
  // Jumping and dodging still allow a cross-up.
  const standing=s.players.filter(p=>alive(p)&&p.grounded&&p.action!=='dodge').sort((a,b)=>a.x-b.x||a.slot-b.slot);
  for(let i=1;i<standing.length;i++){
    const left=standing[i-1],right=standing[i];
    if(left.floor!==right.floor)continue;
    const overlap=(fighterStats(left).width+fighterStats(right).width)*.36-(right.x-left.x);
    if(overlap<=0)continue;
    if(!left.dummy)left.x-=right.dummy?overlap:overlap*.5;
    if(!right.dummy)right.x+=left.dummy?overlap:overlap*.5;
  }
}
export function stepGame(s,inputs={}){
  if(s.phase==='over')return s;
  s.tick++;s.events=s.events.filter(e=>s.tick-e.tick<=24);
  if(s.phase==='roundEnd'){if(--s.roundPause<=0)nextRound(s);return s;}
  if(s.phase==='countdown'){
    if(--s.countdown<=0){s.phase='play';emit(s,'start',center,270);}
    return s;
  }
  const playing=s.players.filter(alive);
  for(const p of playing){
    updateBody(s,p,p.dummy?0:p.bot?botControls(s,p):inputBits(inputs[p.id]));
  }
  separateGroundedPlayers(s);
  for(const p of playing)stayOnStage(p);
  const contacts=[];for(const p of s.players)collectMelee(s,p,contacts);
  const countered=new Set();
  for(const h of contacts){
    if(countered.has(h.attacker))continue;
    const result=strike(s,h);
    if(result!=='miss')h.attacker.struck.push(h.token);
    if(result==='counter')countered.add(h.attacker);
  }
  updateAssists(s);updateShots(s);
  if(!s.training){
    s.timeLeft=Math.max(0,s.timeLeft-1);
    for(const p of playing)if(p.hp<=0)knockOut(s,p);
    const active=s.players.filter(alive);
    if(active.length<=1)finishRound(s,active.length?active:playing,'ko');
    else if(s.timeLeft===0)finishRound(s,active,'timeout');
  }
  return s;
}
