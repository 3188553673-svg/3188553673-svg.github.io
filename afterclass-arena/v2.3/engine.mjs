// Shared fixed-step simulation. State, including input history, is serializable.
import { MOVES, NORMALS, SIGNATURE_NORMALS } from './moves.mjs';
export { MOVES } from './moves.mjs';
export const TICK_RATE=60;
export const WORLD={width:1536,height:600,centerX:768,left:-64,right:1600,top:-130,bottom:680};
export const PLATFORMS=[
  {x:136,y:442,w:1264,h:28,main:true},
  {x:207,y:345,w:200,h:13}, {x:1129,y:345,w:200,h:13},
  {x:464,y:319,w:182,h:13}, {x:890,y:319,w:182,h:13},
  {x:678,y:229,w:180,h:14}
];
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
const INPUT={left:1,right:2,down:4,jump:8,attack:16,skill:32,dodge:64};
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
    comboCount:0,comboTarget:null,comboTick:-200,guard:false,guardStun:0,damage:0,stocks:3,kos:0,
    invuln:0,stun:0,freeze:0,respawn:0,skillCooldown:0,dodgeCooldown:0,drop:0,downTicks:0,
    previousInput:0,dirHistory:[],walkFacing:x<=center?1:-1,jumpBuffer:0,dodgeBuffer:0,
    pending:[],chainNext:null,chainUntil:0,
    lastHit:null,lastHitAt:-1000,landingMove:null};
}
export function createGame(players){
  const roster=players.slice(0,4),training=roster.some(p=>p.dummy);
  const xs=training&&roster.length===2?[center-26,center+26]:(starts[roster.length]||[]);
  const state={tick:0,phase:training?'play':'countdown',countdown:training?0:180,winner:null,nextId:1,training,
    players:roster.map((p,i)=>body(p,i,xs[i])),projectiles:[],events:[]};
  for(const p of state.players){
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
function recordDirection(s,p,bits){
  const x=horizontal(bits),down=has(bits,INPUT.down),digit=(down?2:5)+x;
  const hist=p.dirHistory;
  while(hist.length && s.tick-hist[0].t>25)hist.shift();
  const last=hist.at(-1);
  if(digit!==last?.d){
    hist.push({d:digit,t:s.tick});
    if(hist.length>12)hist.shift();
  }
}
function readControls(s,p,bits){
  recordDirection(s,p,bits);
  const dir=horizontal(bits),pressed=bits&~p.previousInput;
  if(dir)p.walkFacing=dir;
  p.previousInput=bits;
  if(pressed&INPUT.jump)p.jumpBuffer=s.tick+12;
  if(pressed&INPUT.dodge)p.dodgeBuffer=s.tick+8;
  while(p.pending.length&&p.pending[0].until<s.tick)p.pending.shift();
  let key;
  if(pressed&INPUT.skill)key=has(bits,INPUT.down)?'qcb':dir?'qcf':'special';
  else if(pressed&INPUT.attack)key=has(bits,INPUT.down)&&p.grounded&&!has(bits,INPUT.jump)?'sweep':'light';
  if(!key||(MOVES[p.char]?.[key]&&p.skillCooldown>13))return;
  if(key==='light'&&p.skillCooldown&&MOVES[p.char]?.[p.pending[0]?.key])p.pending.shift();
  // Store separate taps through startup and hitstop. Holding a key emits only one strike.
  if(key!=='light')p.pending.length=0;
  if(p.pending.length<2)p.pending.push({key,dir:dir||p.walkFacing,until:s.tick+(key==='light'?26:13)});
}
function botControls(s,p){
  const target=targetFor(s,p),n=s.tick+p.slot*23;
  const edgeRight=floor.x+floor.w;
  if(p.x<floor.x+7||p.x>edgeRight-7||p.y>floor.y+24){
    const dir=p.x<center?INPUT.right:INPUT.left;
    let bits=dir;
    if(p.jumps && p.vy>=-1 && p.y>floor.y-52 && !has(p.previousInput,INPUT.jump))bits|=INPUT.jump;
    if(!p.jumps&&!p.grounded&&p.char==='iron'&&!p.skillCooldown)bits|=INPUT.skill;
    if((p.x<floor.x-48||p.x>edgeRight+48)&&!p.dodgeCooldown&&!p.stun)bits|=INPUT.dodge;
    return bits;
  }
  if(!target)return 0;
  const dx=target.x-p.x,dy=target.y-p.y,ax=Math.abs(dx);
  const forward=dx>=0?INPUT.right:INPUT.left;
  const melee=ax<CHARACTERS[p.char].reach+11&&Math.abs(dy)<52;
  let bits=ax>23?forward:0;
  if(dy< -44 && ax<250 && p.jumps && (p.grounded||p.vy>=0) && !has(p.previousInput,INPUT.jump))bits|=INPUT.jump;
  if(dy>40&&p.floor>0&&ax<235)bits=INPUT.down;
  const ranged=['doubao','xujingyu','rocket','iron'].includes(p.char);
  const cycle=n%102;
  if(!p.skillCooldown&&Math.abs(dy)<75&&ax<(ranged?385:115)&&cycle===5){
    const variant=Math.floor(n/102)%3;
    if(variant===2)return INPUT.down|INPUT.skill;
    if(variant===1||p.facing!==(dx>=0?1:-1))return forward|INPUT.skill;
    return INPUT.skill;
  }
  if(melee&&p.confirmed&&n%5===0)return INPUT.attack;
  if(melee&&target.action==='attack'&&target.actionTick<4&&n%8<3)
    return p.facing===(dx>=0?1:-1)?INPUT.down:forward;
  if(melee&&!target.invuln&&n%9===0)bits=forward|INPUT.attack;
  if(!p.skillCooldown&&ax<(ranged?290:75)&&Math.abs(dy)<57&&n%26===0)bits|=INPUT.skill;
  return bits;
}
function normalFor(p,key){
  const special=SIGNATURE_NORMALS[p.char];
  return special.key===key?{...NORMALS[key],...special}:NORMALS[key];
}
function beginMove(s,p,key){
  const cfg=MOVES[p.char][key]||normalFor(p,key),special=!!MOVES[p.char][key];
  const input=p.pending.shift();
  p.facing=key==='qcf'?input.dir:p.walkFacing;
  p.move=key;p.moveName=cfg.name;p.action=special?(cfg.counter?'counter':'skill'):'attack';
  p.actionTick=0;p.stanceLeft=cfg.frames;p.confirmed=false;p.struck=[];p.healed=false;p.guard=false;
  p.chainNext=cfg.next||null;p.chainUntil=s.tick+cfg.frames+13;
  p.jab=key==='follow'?1:0;
  if(special)p.skillCooldown=SKILL_COOLDOWNS[p.char];
  else if(p.grounded)p.vx+=p.facing*(cfg.lunge??(key==='heavy'?3.7:key==='finisher'?3:1.8));
  emit(s,special?'skill':'swing',p.x+p.facing*14,p.y-30,p,null,special?2:1);
}
function startAction(s,p,bits){
  const intent=p.pending[0],normal=normalFor(p,p.move);
  const jumpCancel=p.stanceLeft&&normal&&p.confirmed&&p.jumpBuffer>=s.tick&&p.jumps>0;
  if(jumpCancel){
    clearMove(p);p.chainNext=null;
  }else if(p.stanceLeft){
    if(!intent||!normal)return;
    const correctHeight=p.grounded?p.chainNext!=='airFinish':p.chainNext==='airFinish';
    const linkAt=p.confirmed?normal.start:normal.start+normal.active;
    const canFollow=intent.key==='light'&&p.chainNext&&correctHeight&&p.actionTick>=linkAt;
    const canSpecial=p.confirmed&&MOVES[p.char][intent.key]&&!p.skillCooldown;
    if(!canFollow&&!canSpecial)return;
  }
  if(p.jumpBuffer>=s.tick&&(p.grounded||p.jumps>0)){
    const ground=p.grounded||p.coyote>0;
    p.jumps=ground?1:Math.max(0,p.jumps-1);p.jumpBuffer=0;p.coyote=0;p.chainNext=null;
    p.grounded=false;p.floor=-1;p.vy=-CHARACTERS[p.char].jump*(ground?1:.91);
    emit(s,'jump',p.x,p.y,p,null,ground?1:2);
  }
  if(p.dodgeBuffer>=s.tick&&!p.dodgeCooldown){
    p.chainNext=null;p.pending.length=0;
    p.dodgeBuffer=0;p.dodgeCooldown=44;p.invuln=9;p.stanceLeft=12;p.action='dodge';p.actionTick=0;p.guard=false;
    p.vx=(horizontal(bits)||p.facing)*11;p.vy=Math.min(0,p.vy)*.45;emit(s,'dodge',p.x,p.y-20,p);return;
  }
  if(!intent)return;
  let key=intent.key;
  if(key==='light'){
    const next=s.tick<=p.chainUntil?p.chainNext:null;
    key=p.grounded?(next==='follow'||next==='finisher'?next:'jab'):(next==='airFinish'?next:'air');
  }
  if(!MOVES[p.char][key]||!p.skillCooldown)beginMove(s,p,key);
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
function projectile(s,p,spec,face=p.facing,move=p.move){
  const q={...SHOTS[spec.kind],...spec,id:s.nextId++,owner:p.id,char:p.char,move,facing:face,age:0,rest:false};
  q.x=p.x+face*(q.kind==='mine'?15:24);q.y=p.y-(q.kind==='shock'?5:q.kind==='mine'?22:CHARACTERS[p.char].height*.54);
  q.vx=face*q.speed;q.vy=q.vy||0;
  if(q.kind==='mine'){
    const active=s.projectiles.filter(o=>o.owner===p.id&&o.kind==='mine'&&o.life>0);
    if(active.length>=3)active[0].life=0;
  }
  s.projectiles.push(q);
}
function movement(s,p,bits,skill){
  if(p.stun||p.guardStun){p.vx*=p.grounded ? .90 : .99;return;}
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
  const target=dir*c.speed*(busy ? .36 : p.guard ? .76 : 1);
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
function updateBody(s,p,bits){
  readControls(s,p,bits);
  if(p.freeze>0){p.freeze--;return;}
  for(const key of ['invuln','stun','guardStun','skillCooldown','dodgeCooldown','drop'])if(p[key]>0)p[key]--;
  if(p.stanceLeft>0 && --p.stanceLeft===0)clearMove(p);
  p.actionTick++;
  if(p.grounded)p.coyote=5;
  else if(p.coyote>0 && --p.coyote===0)p.jumps=Math.min(1,p.jumps);
  // The practice post shares hitstop and hitstun, but has no movement physics.
  if(p.dummy){
    if(!p.stun)pose(p,'idle');
    return;
  }
  if(!p.stun&&!p.guardStun&&!p.stanceLeft)p.facing=p.walkFacing;
  p.guard=!p.stun&&!p.stanceLeft&&p.grounded&&has(bits,INPUT.down);
  p.downTicks=has(bits,INPUT.down)&&!horizontal(bits)?p.downTicks+1:0;
  if(p.grounded&&p.floor>0&&p.downTicks>=10&&!p.stanceLeft&&!p.stun&&!p.pending.length){
    p.floor=-1;p.grounded=false;p.y+=3;p.vy=2;p.drop=12;p.jumps=1;p.coyote=0;
  }
  if(!p.stun&&!p.guardStun)startAction(s,p,bits);
  const skill=MOVES[p.char]?.[p.move];
  movement(s,p,bits,skill);
  const hover=skill?.hover && p.actionTick>=skill.hover[0] && p.actionTick<=skill.hover[1];
  const oldY=p.y,ground=p.grounded;
  p.vy=Math.min(19,p.vy+(hover ? .15 : .60)+(has(bits,INPUT.down)&&!p.stun&&p.vy>0 ? .40 : 0));
  p.x+=p.vx;p.y+=p.vy;
  const landing=p.vy>=0?platformCrossed(p.x,oldY,p.y,p.drop,s.training):-1;
  p.grounded=landing>=0;p.floor=landing;
  if(p.grounded){
    p.y=PLATFORMS[landing].y;
    if(!ground&&p.vy>4.5)emit(s,'land',p.x,p.y,p,null,Math.round(p.vy));
    if(p.landingMove){
      const move=p.landingMove,power=MOVES[p.char][move].landingPower;
      for(const dir of [-1,1])projectile(s,p,{kind:'shock',damage:power},dir,move);
      emit(s,'blast',p.x,p.y-3,p,null,power,{move});p.landingMove=null;
    }
    p.vy=0;p.jumps=2;
  }
  if(!p.stanceLeft&&!p.stun){
    pose(p,p.grounded?(p.guard||p.guardStun?'guard':Math.abs(p.vx)>.8?'run':'idle'):(p.vy<0?'jump':'fall'));
  }
  if(p.comboCount&&s.tick-p.comboTick>35)p.comboCount=0;
}
function hitMeta(p,move=p.move){return {char:p.char,move,moveName:(MOVES[p.char][move]||normalFor(p,move))?.name||''};}
function collectMelee(s,p,contacts){
  if(!alive(p)||p.freeze||!p.move||!p.stanceLeft)return;
  const c=CHARACTERS[p.char],move=p.move,n=normalFor(p,move);
  const specs=n?[{from:n.start,to:n.start+n.active-1,damage:c.power+n.damage,base:n.base,reach:c.reach+n.reach,
    level:n.level,link:n.link,lift:n.lift,omni:n.omni,rebound:n.rebound}]:MOVES[p.char][move]?.hits||[];
  for(const [index,spec] of specs.entries()){
    if(p.actionTick<spec.from||p.actionTick>spec.to)continue;
    const y=p.y-(spec.level==='low'?10:spec.level==='air'?c.height*.39:c.height*.53);
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
  const {attacker:a,target:b,damage,base,dir,x,y}=h;
  const linked=b.lastHit===a.id&&(b.stun>0||b.freeze>0||s.tick-b.lastHitAt<=1);
  a.comboCount=linked&&a.comboTarget===b.id?a.comboCount+1:1;
  a.comboTarget=b.id;a.comboTick=s.tick;
  b.damage=clamp(b.damage+damage,0,999);
  const launch=(base+b.damage*(h.link ? .012 : .103))/fighterStats(b).mass;
  if(!b.dummy){
    b.vx=dir*(h.link?Math.min(1.9,launch*.55):launch);
    b.vy=h.link?(b.grounded?0:-1.4):-Math.min(22,(3.3+launch*.53)*(h.lift||1));
    if(!h.link){b.grounded=false;b.floor=-1;b.coyote=0;b.jumps=Math.min(1,b.jumps);}
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
  const front=shot?h.dir*b.facing<0:(a.x-b.x)*b.facing>=-5;
  if(b.action==='counter'&&b.actionTick<=14&&front){
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
  const crouch=has(b.previousInput,INPUT.down);
  if(front&&b.grounded&&!b.stun&&!b.stanceLeft&&(b.guard||b.guardStun)&&
    (h.level==='low'?crouch:h.level==='air'?!crouch:true)){
    b.guard=true;b.guardStun=h.heavy?10:6;b.action='guard';b.vx=h.dir*(h.heavy?3.7:1.6);
    b.freeze=h.heavy?4:2;
    if(!shot)a.freeze=Math.max(a.freeze,h.heavy?3:2);
    emit(s,'block',h.x,h.y,a,b,h.damage,{...hitMeta(a,h.move),heavy:h.heavy});return 'block';
  }
  hurt(s,h);
  if(!shot){
    a.confirmed=true;a.freeze=Math.max(a.freeze,h.heavy?6:3);
    if(h.rebound){a.vy=-h.rebound;a.grounded=false;a.floor=-1;}
    const heal=MOVES[a.char][h.move]?.heal;
    if(heal&&!a.healed){a.damage=Math.max(0,a.damage-heal);a.healed=true;}
  }
  return 'hit';
}
function updateShots(s){
  for(const q of s.projectiles){
    if(q.life<=0)continue;
    q.age++;q.life--;
    const oldY=q.y;q.x+=q.vx;
    if(q.gravity&&!q.rest){
      q.vy+=q.gravity;q.y+=q.vy;
      const crossed=q.vy>=0?platformCrossed(q.x,oldY+q.radius*.4,q.y+q.radius*.4,0,s.training):-1;
      if(crossed>=0){
        q.y=PLATFORMS[crossed].y-q.radius*.4;
        if(q.kind==='mine'){q.vx=0;q.vy=0;q.rest=true;}
        else if(q.bounces>0){q.bounces--;q.vy=-(q.bounceSpeed||Math.max(5.1,Math.abs(q.vy)*.76));}
        else {q.life=0;continue;}
      }
    }
    const a=s.players.find(p=>p.id===q.owner);
    if(!a)continue;
    const targets=s.players.filter(p=>p!==a&&alive(p)&&!p.invuln);
    const h=t=>({attacker:a,target:t,shot:q,...hitMeta(a,q.move),char:q.char,x:q.x,y:q.y,dir:q.facing,
      damage:q.damage,base:q.base,heavy:q.base>=6,level:q.kind==='shock'?'low':null,link:q.kind==='disc'&&q.damage<=4});
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
function takeStock(s,p){
  if(!s.training)p.stocks--;
  const a=s.players.find(a=>a.id===p.lastHit);
  if(!s.training&&a&&s.tick-p.lastHitAt<450)a.kos++;
  emit(s,s.training?'training-return':'ko',clamp(p.x,10,WORLD.width-10),clamp(p.y,15,WORLD.height-12),a,p);
  p.vx=0;p.vy=0;p.freeze=0;p.stun=0;p.invuln=0;p.grounded=false;p.landingMove=null;
  clearMove(p);p.action='ko';p.actionTick=0;p.respawn=s.training?12:p.stocks?49:0;
}
function respawn(s,p){
  const {stocks,kos}=p;
  const x=s.training?center+(p.dummy?26:-26):center+[-45,45,-115,115][p.slot];
  Object.assign(p,body(p,p.slot,x),{stocks,kos});
  if(!s.training)Object.assign(p,{y:168,grounded:false,floor:-1,invuln:97});
  emit(s,'respawn',p.x,p.y,p);
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
  if(s.phase==='countdown'){
    if(--s.countdown<=0){s.phase='play';emit(s,'start',center,270);}
    return s;
  }
  for(const p of s.players){
    if(p.action==='ko'){if(p.respawn>0&&--p.respawn===0)respawn(s,p);continue;}
    updateBody(s,p,p.dummy?0:p.bot?botControls(s,p):inputBits(inputs[p.id]));
  }
  separateGroundedPlayers(s);
  const contacts=[];for(const p of s.players)collectMelee(s,p,contacts);
  const countered=new Set();
  for(const h of contacts){
    if(countered.has(h.attacker))continue;
    const result=strike(s,h);
    if(result!=='miss')h.attacker.struck.push(h.token);
    if(result==='counter')countered.add(h.attacker);
  }
  updateShots(s);
  for(const p of s.players)if(alive(p)&&(p.x<WORLD.left||p.x>WORLD.right||p.y<WORLD.top||p.y>WORLD.bottom))takeStock(s,p);
  const active=s.players.filter(p=>p.stocks>0);
  if(!s.training&&active.length<=1){s.phase='over';s.winner=active[0]?.id??null;emit(s,'win',center,260,active[0]);}
  return s;
}
