/** Fixed-step, serializable simulation shared by the browser and the room host. */
import {STAGES, GATES, makeFloor, roomCover, talentOptions, seeded} from './dungeon.mjs';
import {EXTRA_HEROES, EXTRA_WEAPONS, EXTRA_COST, createCombatV2} from './arsenal.mjs';
export {STAGES};
export const HEROES = {
  ...EXTRA_HEROES,
  kobe:{name:'科比',color:'#ffc85c',skill:'后仰跳投',weapon:'24 号训练球',detail:'后撤抛投，跑进落点触发补篮。',skillMax:178},
  iron:{name:'钢铁侠',color:'#ff7156',skill:'推进掌心炮',weapon:'掌心脉冲',detail:'沿瞄准方向突进，发射贯穿电弧。',skillMax:185},
  jianguo:{name:'灭建国',color:'#b69aff',skill:'家长拍桌',weapon:'家长签章',detail:'架盾拍桌，震退围上来的整圈敌人。',skillMax:192}
};
export const WEAPONS = {basket:'24 号训练球',pulse:'掌心脉冲',stamp:'家长签章',tray:'回旋餐盘',bell:'下课铃',...EXTRA_WEAPONS};
export const WEAPON_COSTS = {basket:0,pulse:1,stamp:0,tray:2,bell:3,...EXTRA_COST};
export const WEAPON_COST=WEAPON_COSTS;
const lootWeapons=['tray','bell','wrap','chalk','rollcall','slipper','horn'];
const XMIN=35, XMAX=925, YMIN=96, YMAX=492;
const HERO_WEAPON={kobe:'basket',iron:'pulse',jianguo:'stamp',nailong:'milk'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=p=>!p.down&&!p.disconnected;
function unit(x,y){const n=Math.hypot(x,y);return n>0.001?[x/n,y/n]:[1,0];}
function moveTo(a,x,y,speed){const n=Math.hypot(x-a.x,y-a.y);if(n<0.001)return; a.dx=(x-a.x)/n;a.dy=(y-a.y)/n;a.x+=a.dx*Math.min(n,speed);a.y+=a.dy*Math.min(n,speed);}
const arsenal=createCombatV2({addProp,projectile,hazard,fx,caption,event,hitEnemy,hitPlayer,damageRadius,batNearby,walk,stun,rand,
  nearest,active,bodyTarget,moveTo,clamp,distance,aim,unit,spawnEnemy});
function solid(o){return o.kind==='barrier'||o.kind==='cart';}
function ranks(p,talent){return p.talents.filter(t=>t===talent).length;}
function uid(s){return s.nextId++;}
function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function event(s,kind,x,y,more={}){s.events.push({id:uid(s),tick:s.tick,kind,x,y,...more});}
function fx(s,kind,x,y,color,life=18,words=''){
  s.effects.push({id:uid(s),kind,x,y,color,timer:0,life,text:words});
}
function caption(s,x,y,txt,color='#ffdc7c'){fx(s,'text',x,y,color,65,txt);}
function addProp(s,kind,x,y,r,more={}){
  const p={id:uid(s),kind,x,y,r,timer:0,life:-1,...more};
  if(['coin','energy','heart','weapon','chest'].includes(kind)){
    for(const wall of s.props)if(solid(wall)&&insideBarrier(p,wall,17)){
      const xGap=wall.w/2+18-Math.abs(p.x-wall.x),yGap=wall.h/2+18-Math.abs(p.y-wall.y);
      if(xGap<yGap)p.x=wall.x+(p.x>=wall.x?1:-1)*(wall.w/2+18);
      else p.y=wall.y+(p.y>=wall.y?1:-1)*(wall.h/2+18);
    }
  }
  s.props.push(p);return p;
}
function hazard(s,kind,x,y,w,h,r,warn,live,damage,more={}){
  const item={id:uid(s),kind,x,y,w,h,r,warn,timer:0,life:warn+live,damage,hit:[],...more};s.hazards.push(item);return item;
}
function projectile(s,kind,team,x,y,vx,vy,damage,more={}){
  const p={id:uid(s),kind,team,x,y,vx,vy,r:7,damage,timer:0,life:126,hit:[],...more};s.shots.push(p);return p;
}
function nearest(items,from,cond=()=>true){
  let target=null,best=Infinity;
  for(const item of items){if(!cond(item))continue;const d=distance(from,item);if(d<best){target=item;best=d;}}
  return target;
}
function bodyTarget(s,p){
  const hostiles=s.boss?[s.boss,...s.enemies]:s.enemies;
  const target=nearest(hostiles,p,e=>e.hp>0&&e.kind!=='clone');
  return target||nearest(s.props,p,o=>o.kind==='dummy');
}
function aim(s,p,input){
  let ax=input.aimX,ay=input.aimY;
  if(Number.isFinite(ax)&&Number.isFinite(ay)&&Math.hypot(ax,ay)>.1)return unit(ax,ay);
  const target=bodyTarget(s,p);
  return target?unit(target.x-p.x,target.y-p.y):unit(p.dx,p.dy);
}
function insideBarrier(p,b,r){return Math.abs(p.x-b.x)<b.w/2+r&&Math.abs(p.y-b.y)<b.h/2+r;}
function walk(s,p,dx,dy,r=12){
  p.x=clamp(p.x+dx,XMIN,XMAX);
  for(const b of s.props)if(solid(b)&&insideBarrier(p,b,r)&&dx)p.x=b.x-Math.sign(dx)*(b.w/2+r);
  p.y=clamp(p.y+dy,YMIN,YMAX);
  for(const b of s.props)if(solid(b)&&insideBarrier(p,b,r)&&dy)p.y=b.y-Math.sign(dy)*(b.h/2+r);
}
function newPlayer(pick,i){
  const spec=typeof pick==='string'?{hero:pick}:pick||{};
  const hero=Object.hasOwn(HEROES,spec.hero)?spec.hero:'kobe';
  const hp=hero==='jianguo'?91:74;
  const shield=hero==='iron'?34:26;
  return {id:String(spec.id??'p'+(i+1)),hero,name:String(spec.name||HEROES[hero].name),x:0,y:0,dx:1,dy:0,
    hp,maxHp:hp,shield,maxShield:shield,regenWait:0,energy:76,maxEnergy:100,coins:6,talents:[],interactHint:'',interactHeld:false,down:false,disconnected:false,revive:0,skillCd:0,skillMax:HEROES[hero].skillMax,dashCd:0,dashMax:66,
    attackCd:0,invuln:0,action:'idle',actionTick:0,dashTicks:0,dashX:1,dashY:0,weapon:HERO_WEAPON[hero],
    starterWeapon:HERO_WEAPON[hero],otherWeapon:null,swapHeld:false,selected:false,attackCount:0,glove:false};
}
export function createGame(picks=['kobe'],seed){
  if(!Array.isArray(picks)||!picks.length)picks=['kobe'];
  const s={tick:0,rng:(Number.isFinite(seed)?seed:Math.floor(Math.random()*4294967296))>>>0,nextId:1,stage:0,room:'warmup',phase:'play',phaseTick:0,roomTick:0,objective:'',
    players:picks.slice(0,4).map(newPlayer),enemies:[],shots:[],hazards:[],props:[],effects:[],boss:null,events:[],kills:0,score:0,wave:0};
  s.seed=s.rng;s.floor=1;s.coins=6;s.reward=null;s.bossKills=[];s.roomCache={};
  beginFloor(s,1);return s;
}
export function disconnectPlayer(s,id){
  const p=s.players.find(p=>p.id===String(id));
  if(p){p.disconnected=true;p.down=true;p.revive=0;p.hp=0;}
  return s;
}
function spawnEnemy(s,kind,x,y,extra={}){
  const count=Math.max(1,s.players.filter(p=>!p.disconnected).length);
  const base={chair:23,mop:35,runner:27,clone:1}[kind]||28;
  const hp=Math.round(base*(1+(count-1)*.23)*(extra.elite?2.4:1));
  const e={id:uid(s),kind,x,y,r:kind==='mop'?17:14,dx:-1,dy:0,hp,maxHp:hp,flash:0,timer:32+Math.floor(rand(s)*55),action:'run',...extra};
  s.enemies.push(e);return e;
}
function makeBoss(s,kind,x,y){
  const count=Math.max(1,s.players.filter(p=>!p.disconnected).length);
  const hp=Math.round((kind==='steel'?630:725)*(1+(count-1)*.72));
  s.boss={id:uid(s),kind,x,y,r:29,dx:-1,dy:0,hp,maxHp:hp,flash:0,action:kind==='steel'?'volley':'run',timer:0,angle:.04,cycle:0,
    audience:100,pk:false,safeSide:'left',laceCd:45,trips:0,stun:0,shoeX:0,shoeY:0};
}
function portals(s){
  for(const [x,y] of [[194,195],[756,384]])addProp(s,'portal',x,y,28);
  addProp(s,'gong',694,182,21);
}
function beginFloor(s,floor){
  s.floor=floor;s.stage=floor-1;s.dungeon=makeFloor(s.seed,floor);s.roomCache={};s.reward=null;
  enterRoom(s,s.dungeon.startId);
}
function getRoom(s,id){return s.dungeon.rooms.find(r=>r.id===id);}
function gateProps(s,room){
  for(const [dir,to] of Object.entries(room.links)){
    const g=GATES[dir],target=getRoom(s,to);
    addProp(s,'door',g.x,g.y,28,{dir,to,open:room.cleared,label:target.name,destType:target.type});
  }
}
function stock(s,room){
  const r=seeded(room.seed),pick=()=>lootWeapons[Math.floor(r()*lootWeapons.length)];
  if(room.type==='start'){
    if(s.floor===1){addProp(s,'dummy',672,212,23,{flash:0});addProp(s,'chest',414,308,27,{opened:false,label:'出发宝箱',weapon:pick()});}
    else addProp(s,'energy',465,307,11,{amount:12});
  }
  if(room.type==='treasure')addProp(s,'chest',480,292,28,{opened:false,label:'装备宝箱',weapon:pick()});
  if(room.type==='shop'){
    const price=8+s.floor*2,weapon=pick();
    for(const [i,o] of [{offer:'heal',price:5,label:'红药 +32'},{offer:'weapon',weapon,price,label:WEAPONS[weapon]},{offer:'energy',price:3,label:'能量 +55'}].entries()){
      addProp(s,'shop',308+i*173,302,27,{...o,sold:false});
    }
  }
}
function startEncounter(s,room){
  if(room.type==='boss'){
    const kind=s.dungeon.bossKind;makeBoss(s,kind,kind==='thanos'?780:690,295);
    if(kind==='thanos'){
      for(let i=1;i<=2+Math.min(2,s.players.filter(p=>!p.disconnected).length);i++)spawnEnemy(s,'clone',780,300,{slot:i});
      addProp(s,'lace',735,275,20);
    }else if(kind!=='steel')arsenal.initBoss(s,s.boss);
    s.objective={steel:'响指前躲进安全半场，连麦后敲锣反击。',thanos:'踩住紫色鞋带，趁灭霸回来捡鞋时反击。',captain:'把篮球拨进风中的球筐，制造乌龙。',mirror:'诱导模仿你的奶龙撞上餐车。'}[kind];
    return;
  }
  const random=seeded(room.seed),positions=[[210,170],[741,149],[775,409],[213,418],[670,327],[278,326]];
  const startIndex=Math.floor(random()*positions.length),count=2+(room.type==='elite'?1:0)+Math.floor((s.floor-1)/2)+Math.min(2,s.players.filter(p=>!p.disconnected).length-1);
  const mob=['chair','runner','mop','spitter'];
  for(let i=0;i<count;i++){
    let [x,y]=positions[(startIndex+i)%positions.length];
    if(s.players.some(p=>distance(p,{x,y})<95))x=960-x;
    const kind=i===0&&room.type==='elite'?'mop':mob[Math.floor(random()*mob.length)];
    spawnEnemy(s,kind,x,y,{elite:i===0&&room.type==='elite'});
  }
  s.objective=room.type==='elite'?'精英守着装备，清场可得宝箱。':'清空房间，门锁会打开。';
}
function enterRoom(s,id,fromDir){
  const room=getRoom(s,id);
  s.roomId=id;s.roomInfo=room;s.room=room.type==='boss'?s.dungeon.bossKind:
    room.type==='shop'||room.type==='treasure'?'supply':s.floor===2?'track':s.floor===1?'warmup':s.floor===3?'stands':'mirror';
  s.roomTick=0;s.phaseTick=0;s.phase='play';s.boss=null;s.wave=0;s.doorGrace=28;
  s.enemies=[];s.shots=[];s.hazards=[];s.props=[];s.effects=[];
  const g=GATES[fromDir];
  s.players.forEach((p,i)=>{
    const offset=(i-(s.players.length-1)/2)*23;
    p.x=g?g.x-g.dx*73+(g.dy?offset:0):470+offset;p.y=g?g.y-g.dy*73+(g.dx?offset:0):365;
    p.invuln=Math.max(p.invuln,30);p.action=p.down?'down':'idle';p.actionTick=0;p.dashTicks=0;p.rollTicks=0;p.interactHint='';p.interactHeld=true;
  });
  const peaceful=['start','shop','treasure'].includes(room.type);
  room.visited=true;
  if(peaceful)room.cleared=true;
  for(const wall of roomCover(room))addProp(s,'barrier',wall.x,wall.y,18,{w:wall.w,h:wall.h,art:wall.art});
  gateProps(s,room);
  const saved=s.roomCache[id];
  if(saved)s.props.push(...saved);
  else stock(s,room);
  delete s.roomCache[id];
  s.objective=room.type==='shop'?'靠近商品交互购买，队伍共用金币。':room.type==='treasure'?'打开宝箱，靠近掉落的武器交互拾取。':'走向发光的门，自选探索路线。';
  if(!room.cleared)startEncounter(s,room);
  event(s,'room',480,265,{stage:s.stage,floor:s.floor,roomId:id});
}
const retained=new Set(['shop','chest','weapon','coin','energy','heart','exit','dummy']);
function travel(s,dir){
  const door=s.roomInfo.links[dir];if(!door||!s.roomInfo.cleared||s.doorGrace>0)return false;
  s.roomCache[s.roomId]=s.props.filter(p=>retained.has(p.kind)&&p.life!==0);
  enterRoom(s,door,GATES[dir].reverse);return true;
}
function clearRoom(s){
  if(s.roomInfo.cleared)return;
  s.roomInfo.cleared=true;getRoom(s,s.roomId).cleared=true;s.shots=[];s.hazards=[];s.enemies=[];s.boss=null;
  s.props=s.props.filter(o=>!['portal','gong','lace','shoe','cart','hoop','wind','basketball','hoopBall'].includes(o.kind));
  for(const o of s.props)if(o.kind==='door')o.open=true;
  s.objective='门锁打开，走向下一间，或原路回去搜刮。';
  if(s.roomInfo.type==='combat'){
    addProp(s,'coin',454,291,11,{amount:2+s.floor});
    addProp(s,'energy',500,292,11,{amount:14});
    fx(s,'ring',480,292,'#ffd267',24);caption(s,480,271,'清场补给');
    s.score+=25;
  }
  if(s.roomInfo.type==='elite'){
    const weapon=lootWeapons[Math.floor(rand(s)*lootWeapons.length)];
    addProp(s,'chest',480,290,26,{label:'精英宝箱',opened:false,weapon});
  }
  if(s.roomInfo.type==='boss'){
    s.bossKills.push(s.dungeon.bossKind);
    const final=s.floor===STAGES.length;
    const signature={steel:'horn',thanos:'slipper',captain:'basket',mirror:'milk'}[s.dungeon.bossKind];
    addProp(s,'chest',631,286,27,{opened:false,label:'首领战利品',weapon:signature});
    addProp(s,'exit',480,290,33,{label:final?'放学出口':'下一层传送门',final});
    s.objective=final?'战利品已掉落，进入中央放学出口可完成本局。':'收集战利品，进入中心传送门，选择层间天赋。';
  }
  event(s,'clear',480,290);
}
function hitPlayer(s,p,damage,x,y){
  if(!active(p)||p.invuln>0||s.phase!=='play')return;
  const absorbed=Math.min(p.shield,damage);
  p.shield-=absorbed;p.hp=Math.max(0,p.hp-(damage-absorbed));p.invuln=49;p.regenWait=Math.max(96,236-30*ranks(p,'shell'));
  if(absorbed)fx(s,'ring',p.x,p.y,'#74daf7',18);
  fx(s,'hit',p.x,p.y,'#ff7063',17);event(s,'hurt',p.x,p.y,{target:p.id,damage});
  const [dx,dy]=unit(p.x-x,p.y-y);walk(s,p,dx*7,dy*7);
  if(p.hp===0){p.down=true;p.action='down';p.revive=0;p.dashTicks=0;caption(s,p.x,p.y,'靠近救援','#ff8291');event(s,'down',p.x,p.y,{target:p.id});}
}
function hitEnemy(s,e,damage,pid){
  if(e.hp<=0)return;
  if(e.kind==='clone'){e.flash=8;return;}
  if(e===s.boss){
    if(e.stun>0||e.action==='chase')damage=Math.ceil(damage*1.65);
    else if(e.kind==='thanos'||e.pk)damage=Math.ceil(damage*.63);
  }
  e.hp=Math.max(0,e.hp-damage);e.flash=7;
  fx(s,'hit',e.x,e.y,'#ffefa9',10);event(s,'hit',e.x,e.y,{source:pid,damage,kindHit:e.kind});
  if(e.hp>0)return;
  s.kills++;s.score+=e===s.boss?500:e.elite?100:35;
  fx(s,'ring',e.x,e.y,e===s.boss?'#ffc34c':'#ff8e66',24);event(s,e===s.boss?'bossDown':'ko',e.x,e.y,{source:pid});
  const drops=e===s.boss?3:e.elite?2:1;
  for(let i=0;i<drops;i++){
    const x=clamp(e.x+(rand(s)-.5)*44,64,895),y=clamp(e.y+(rand(s)-.5)*40,122,463);
    addProp(s,'coin',x,y,10,{amount:1+(e.elite||e===s.boss?2:0)});
    addProp(s,'energy',clamp(x+18,60,900),y,9,{amount:7+Math.floor(rand(s)*4)});
  }
  if(e.elite||e===s.boss||rand(s)<.15)addProp(s,'heart',clamp(e.x,60,900),clamp(e.y+15,120,460),13,{amount:21});
}
function damageRadius(s,x,y,r,damage,source){
  for(const e of [...s.enemies,...(s.boss?[s.boss]:[])])if(distance(e,{x,y})<=r+e.r)hitEnemy(s,e,damage,source);
  for(const o of s.props)if(o.kind==='dummy'&&distance(o,{x,y})<r+o.r){o.flash=11;fx(s,'hit',o.x,o.y,'#ffe598',12);}
}
function routeBaton(s,glow,pid){
  const portal=nearest(s.props,glow,o=>o.kind==='portal');
  if(!portal)return false;
  const [dx,dy]=unit(portal.x-glow.x,portal.y-glow.y);
  glow.team='player';glow.redirect=true;glow.owner=pid;glow.target=portal.id;glow.vx=dx*9;glow.vy=dy*9;glow.life=glow.timer+180;
  fx(s,'spark',glow.x,glow.y,'#73f4ee',16);event(s,'reflect',glow.x,glow.y);return true;
}
function batNearby(s,p,r){
  arsenal.swat(s,p,r);
  for(const q of s.shots)if(q.kind==='glow'&&q.team==='enemy'&&distance(q,p)<r)routeBaton(s,q,p.id);
}
function shootPlayer(s,p,input){
  const [dx,dy]=aim(s,p,input);p.dx=dx;p.dy=dy;p.attackCount++;
  if(p.actionTick<=3){p.action='attack';p.actionTick=10;}
  const common={owner:p.id};const x=p.x+dx*14,y=p.y+dy*14;
  const cost=WEAPON_COSTS[p.weapon]||0,whole=p.energy>=cost;
  if(!whole){
    p.attackCd=22;damageRadius(s,p.x,p.y,78,13,p.id);batNearby(s,p,78);
    fx(s,'ring',p.x,p.y,'#f5e0b0',12);event(s,'attack',p.x,p.y,{source:p.id,weapon:'melee'});return;
  }
  p.energy-=cost;
  if(arsenal.shoot(s,p,dx,dy)){}else switch(p.weapon){
    case 'bell':
      p.attackCd=43;damageRadius(s,p.x,p.y,131,22,p.id);batNearby(s,p,135);
      fx(s,'ring',p.x,p.y,'#ffdf7b',26);projectile(s,'bell','player',p.x,p.y,0,0,0,{...common,r:130,life:15,visual:true});break;
    case 'tray':
      p.attackCd=32;projectile(s,'tray','player',x,y,dx*7.9,dy*7.9,15,{...common,r:13,life:99,through:true});break;
    case 'stamp':
      p.attackCd=28;projectile(s,'stamp','player',x,y,dx*7.1,dy*7.1,17,{...common,r:11,through:true,life:58});break;
    case 'pulse':
      p.attackCd=13;projectile(s,'pulse','player',x,y,dx*9.3,dy*9.3,8,{...common,r:5});break;
    default:
      p.attackCd=23;projectile(s,'basket','player',x,y,dx*8.0,dy*8.0,14,{...common,r:8,bounces:1});
  }
  const rhythm=ranks(p,'rhythm');if(rhythm)p.attackCd=Math.max(7,Math.round(p.attackCd/(1+rhythm*.23)));
  if(p.doubleReady){
    p.doubleReady=false;
    for(const sign of [-1,1])projectile(s,'basket','player',x,y,8*(dx*.96-sign*dy*.27),8*(dy*.96+sign*dx*.27),8+3*ranks(p,'double'),{owner:p.id,bounces:1,r:6,life:90});
  }
  batNearby(s,p,44);event(s,'attack',p.x,p.y,{source:p.id,weapon:p.weapon});
}
function useSkill(s,p,input){
  const [dx,dy]=aim(s,p,input);p.dx=dx;p.dy=dy;p.action='skill';p.actionTick=25;p.skillCd=p.skillMax;
  if(arsenal.skill(s,p,input,dx,dy)){}else if(p.hero==='kobe'){
    walk(s,p,-dx*39,-dy*39);p.invuln=Math.max(p.invuln,23);
    const target=bodyTarget(s,p);
    const reach=clamp(target?distance(p,target):195,65,260);
    const landX=clamp(p.x+dx*reach,XMIN,XMAX),landY=clamp(p.y+dy*reach,YMIN,YMAX);
    projectile(s,'lob','player',p.x,p.y,(landX-p.x)/31,(landY-p.y)/31,32,{owner:p.id,r:10,life:32,z:0,landX,landY});
  }else if(p.hero==='iron'){
    p.invuln=Math.max(p.invuln,22);p.dashTicks=6;p.dashX=dx;p.dashY=dy;
    for(const angle of [-.11,0,.11]){
      const c=Math.cos(angle),n=Math.sin(angle);
      projectile(s,'beam','player',p.x,p.y,11*(dx*c-dy*n),11*(dy*c+dx*n),17,{owner:p.id,r:7,through:true,life:64});
    }
  }else{
    p.invuln=Math.max(p.invuln,48);damageRadius(s,p.x,p.y,158,41,p.id);batNearby(s,p,159);
    for(const e of s.enemies)if(e.kind!=='clone'&&distance(e,p)<165){
      const [kx,ky]=unit(e.x-p.x,e.y-p.y);walk(s,e,kx*38,ky*38);
    }
    for(const q of s.shots)if(q.team==='enemy'&&distance(q,p)<157)q.life=0;
    projectile(s,'shock','player',p.x,p.y,0,0,0,{r:158,life:22,visual:true,owner:p.id});fx(s,'ring',p.x,p.y,'#dbb4ff',27);
  }
  event(s,'skill',p.x,p.y,{source:p.id,hero:p.hero});
}
function stepPlayer(s,p,input){
  if(!active(p))return;
  if(p.regenWait>0)p.regenWait--;
  else if(p.shield<p.maxShield&&s.tick%5===0)p.shield=Math.min(p.maxShield,p.shield+1);
  if(ranks(p,'rhythm')&&p.skillCd>0&&s.tick%5===0)p.skillCd--;
  for(const key of ['invuln','skillCd','dashCd','attackCd','actionTick'])if(p[key]>0)p[key]--;
  if(input.swap&&!p.swapHeld&&p.otherWeapon){
    [p.weapon,p.otherWeapon]=[p.otherWeapon,p.weapon];
    p.attackCd=Math.max(8,p.attackCd);
    caption(s,p.x,p.y-20,WEAPONS[p.weapon],'#b8f9da');
    event(s,'equip',p.x,p.y,{source:p.id,weapon:p.weapon});
  }
  p.swapHeld=!!input.swap;
  const x=Number.isFinite(input.x)?clamp(input.x,-1,1):0,y=Number.isFinite(input.y)?clamp(input.y,-1,1):0;
  const mag=Math.hypot(x,y),[dx,dy]=mag>0?unit(x,y):[p.dx,p.dy];
  if(s.phase==='play'&&arsenal.stepPlayer(s,p,input))return;
  if(input.dash&&p.dashCd===0){
    p.dashCd=p.dashMax;p.dashTicks=9;p.dashX=dx;p.dashY=dy;p.invuln=Math.max(p.invuln,15);p.action='dash';p.actionTick=10;
    if(ranks(p,'double'))p.doubleReady=true;
    if(p.glove){
      arsenal.swat(s,p,113);
      const power=ranks(p,'glove');
      for(const e of s.enemies)if(e.kind!=='clone'&&distance(e,p)<70+power*8){
        const [dx,dy]=unit(e.x-p.x,e.y-p.y);walk(s,e,dx*(23+power*5),dy*(23+power*5),e.r);
      }
      const q=nearest(s.shots,p,q=>q.team==='enemy');
      if(q&&q.kind!=='courtball'&&distance(q,p)<113&&!(q.kind==='glow'&&routeBaton(s,q,p.id))){
        const target=bodyTarget(s,p);const [tx,ty]=target?unit(target.x-q.x,target.y-q.y):[dx,dy];
        q.team='player';q.owner=p.id;q.damage=18;q.vx=tx*7;q.vy=ty*7;q.hit=[];
      }
    }
    event(s,'dash',p.x,p.y,{source:p.id});
  }
  if(p.dashTicks>0){walk(s,p,p.dashX*8.4,p.dashY*8.4);p.dashTicks--;if(s.tick%2===0)fx(s,'dash',p.x,p.y,HEROES[p.hero].color,9);}
  else if(mag>.08){const speed=p.hero==='jianguo'?2.48:2.9;walk(s,p,dx*speed*Math.min(1,mag),dy*speed*Math.min(1,mag));if(!p.actionTick){p.action='run';p.dx=dx;p.dy=dy;}}
  else if(!p.actionTick)p.action='idle';
  if(s.phase==='talent'||s.roomInfo.type==='shop'||s.roomInfo.type==='treasure')return;
  if(input.skill&&p.skillCd===0)useSkill(s,p,input);
  if(input.attack&&p.attackCd===0)shootPlayer(s,p,input);
}
function chasePlayer(s,e,p,speed){
  // Steer to the edge of a bench when the direct path hits it.
  if(e.wayFrames>0&&Math.hypot(e.wayX-e.x,e.wayY-e.y)>5){
    const [x,y]=unit(e.wayX-e.x,e.wayY-e.y);walk(s,e,x*speed,y*speed,e.r);e.wayFrames--;return;
  }
  const [dx,dy]=unit(p.x-e.x,p.y-e.y);e.dx=dx;e.dy=dy;
  const probe={x:e.x+dx*13,y:e.y+dy*13};
  const b=s.props.find(o=>solid(o)&&insideBarrier(probe,o,e.r));
  if(b){
    const horizontal=Math.abs(e.x-b.x)/(b.w/2+e.r)>Math.abs(e.y-b.y)/(b.h/2+e.r);
    e.wayX=horizontal?e.x:b.x+(p.x>=b.x?1:-1)*(b.w/2+e.r+7);
    e.wayY=horizontal?b.y+(p.y>=b.y?1:-1)*(b.h/2+e.r+7):e.y;
    e.wayFrames=110;return;
  }
  walk(s,e,dx*speed,dy*speed,e.r);
}
function stepEnemy(s,e){
  if(e.flash>0)e.flash--;
  if(e.hp<=0||e.kind==='clone')return;
  const p=nearest(s.players,e,active);if(!p)return;
  const d=distance(e,p);
  if(e.kind==='spitter'){
    if(e.timer>0)e.timer--;
    if(e.timer===26){e.action='windup';e.aimX=p.x;e.aimY=p.y;fx(s,'spark',e.x,e.y,'#fb89aa',24);}
    if(e.timer===0){hostileVolley(s,e,{x:e.aimX??p.x,y:e.aimY??p.y},e.elite?5:3,'whistle');e.timer=111;e.action='run';}
    if(e.timer>26&&d>280)chasePlayer(s,e,p,1.0);
    return;
  }
  if(e.action==='windup'){
    if(--e.timer>0)return;
    e.action='recovery';e.timer=e.kind==='mop'?55:37;
    if(e.kind==='chair'){e.x=e.targetX;e.y=e.targetY;}
    if(e.kind==='mop'||e.elite){e.action='charge';e.timer=e.elite?35:25;}
    return;
  }
  if(e.action==='charge'){
    const x=e.x,y=e.y;walk(s,e,e.dx*8,e.dy*8,e.r);
    for(const hero of s.players)if(active(hero)&&distance(hero,e)<e.r+13)hitPlayer(s,hero,12,e.x,e.y);
    if(--e.timer<=0||Math.hypot(e.x-x,e.y-y)<3){e.action='recovery';e.timer=51;fx(s,'spark',e.x,e.y,'#ffc36c',22);}
    return;
  }
  if(e.action==='recovery'){if(--e.timer<=0){e.action='run';e.timer=40;}return;}
  if(e.timer>0)e.timer--;
  if(e.kind==='chair'&&d<160&&e.timer===0){
    e.targetX=clamp(p.x,XMIN+5,XMAX-5);e.targetY=clamp(p.y,YMIN+5,YMAX-5);
    e.action='windup';e.timer=38;
    hazard(s,'stomp',e.targetX,e.targetY,0,0,35,38,10,12);
  }else if((e.kind==='mop'||e.elite)&&d<345&&e.timer===0){
    const [dx,dy]=unit(p.x-e.x,p.y-e.y);e.dx=dx;e.dy=dy;e.action='windup';e.timer=41;
    hazard(s,'charge',e.x,e.y,0,0,19,42,2,0,{dx,dy,length:e.elite?285:204});
  }else{
    chasePlayer(s,e,p,e.kind==='runner'?1.7:e.kind==='chair'?1.24:1.05);
    if(d<e.r+12)hitPlayer(s,p,8,e.x,e.y);
  }
}
function hostileVolley(s,b,p,num,kind='whistle'){
  if(!p)return;
  const angle=Math.atan2(p.y-b.y,p.x-b.x);
  for(let i=0;i<num;i++){
    const a=angle+(i-(num-1)/2)*.2;
    projectile(s,kind,'enemy',b.x,b.y,Math.cos(a)*3.0,Math.sin(a)*3.0,9,{r:7,life:230});
  }
}
function tossBaton(s){
  const portal=s.props.find(o=>o.kind==='portal');if(!portal)return;
  const target=nearest(s.players,portal,active);if(!target)return;
  const side=target.x<610?1:-1;
  const start={x:clamp(target.x+side*140,94,870),y:clamp(target.y-70,119,459)};
  const [dx,dy]=unit(target.x-start.x,target.y-start.y);
  projectile(s,'glow','enemy',start.x,start.y,dx*2.0,dy*2.0,7,{r:10,life:220});
}
function stun(s,b,frames,label){
  b.stun=frames;b.action='stunned';
  caption(s,b.x,b.y-25,label);fx(s,'ring',b.x,b.y,'#6ef6d7',35);
  event(s,'stun',b.x,b.y,{boss:b.kind});
}
function steel(s,b){
  const p=nearest(s.players,b,active);if(!p)return;
  const half=b.hp<=b.maxHp*.5;
  if(half&&!b.pk&&b.snapped&&b.action!=='snap'){
    b.pk=true;portals(s);b.action='portal';b.timer=0;
    caption(s,530,216,'奇异大专申请连麦','#d4acff');
    s.objective='攻击发光应援棒，借传送门敲锣！';event(s,'phase',b.x,b.y,{boss:b.kind});
    tossBaton(s);
  }
  if(b.stun>0){if(--b.stun===0){b.action='volley';b.timer=0;}return;}
  b.timer++;
  const t=b.timer;
  if(b.action==='volley'||b.action==='portal'){
    const targetX=655+Math.cos(s.roomTick*.013)*86,targetY=290+Math.sin(s.roomTick*.023)*102;
    moveTo(b,targetX,targetY,1.15);
    if(t===46||t===106)hostileVolley(s,b,p,b.pk?5:3);
    if(b.pk&&(t===8||t===75||t===143))tossBaton(s);
    if(t>=(b.cycle===0?34:160)){b.timer=0;b.action='snap';b.audience=100;b.cycle++;
      const dangerLeft=b.cycle%2===1;b.safeSide=dangerLeft?'right':'left';
      const xx=dangerLeft?XMIN:480;
      hazard(s,'stands',xx,YMIN,dangerLeft?480-XMIN:XMAX-480,YMAX-YMIN,0,83,53,13,{safeSide:b.safeSide});
      caption(s,b.x,b.y-35,'看我的响指！','#ffd556');event(s,'warn',b.x,b.y);
    }
  }else if(b.action==='snap'){
    if(t===83){b.audience=50;b.snapped=true;fx(s,'snap',b.x,b.y,'#ffeab8',15);event(s,'snap',b.x,b.y);}
    if(t>=143){b.action=b.pk?'portal':'volley';b.timer=0;}
  }
}
function trackPoint(angle,inside=false){
  return {x:480+Math.cos(angle)*(inside?232:306),y:295+Math.sin(angle)*(inside?94:146)};
}
function thanos(s,b){
  const p=nearest(s.players,b,active);if(!p)return;
  const second=b.hp<=b.maxHp*.5;
  // At the first bend a trailing runner can catch the loose lace. Later
  // openings require a player to step on it, so the visual teaches the counter.
  const firstBend=b.trips===0&&s.roomTick>=235;
  b.timer++;if(b.laceCd>0)b.laceCd--;
  if(b.stun>0){
    if(--b.stun===0){b.action='run';b.timer=0;b.laceCd=100;}
  }else if(b.action==='chase'){
    if(b.timer<40){const next=trackPoint(b.angle+.011,b.inner);b.angle+=.011;moveTo(b,next.x,next.y,3.1);}
    else moveTo(b,b.shoeX,b.shoeY,1.65);
    if((b.timer>42&&Math.hypot(b.x-b.shoeX,b.y-b.shoeY)<9)||b.timer>125){
      s.props=s.props.filter(o=>o.kind!=='shoe');stun(s,b,106,'系鞋带！');
    }
  }else if(b.action==='swap'){
    if(b.timer===54){b.inner=!b.inner;fx(s,'snap',b.x,b.y,'#d8b1ff',17);}
    if(b.timer>=84){b.action='run';b.timer=0;b.laceCd=40;}
  }else{
    const direction=b.inner?-1:1;
    b.angle+=direction*(second?.013:.0105);
    const pos=trackPoint(b.angle,b.inner);moveTo(b,pos.x,pos.y,4.8);
    if(b.timer%91===14)hostileVolley(s,b,p,second?4:3);
    if(!b.laceCd&&distance(p,b)<33)hitPlayer(s,p,9,b.x,b.y);
    if(second&&b.timer>=230){b.action='swap';b.timer=0;b.pk=true;caption(s,b.x,b.y-32,'换跑道！','#e3b6ff');event(s,'warn',b.x,b.y);}
  }
  const lace=s.props.find(o=>o.kind==='lace');
  if(lace){
    lace.hidden=b.laceCd>0||b.action!=='run';lace.x=b.x-b.dx*50;lace.y=b.y-b.dy*50;
    lace.endX=b.x-b.dx*15;lace.endY=b.y-b.dy*15;
    if(!lace.hidden){
      const stepper=s.players.find(hero=>active(hero)&&distance(hero,lace)<31);
      if(stepper||firstBend){
        b.trips++;b.action='chase';b.timer=0;b.laceCd=120;b.shoeX=lace.x;b.shoeY=lace.y;lace.hidden=true;
        addProp(s,'shoe',lace.x,lace.y,15);caption(s,b.x,b.y-23,'鞋呢？！','#ffdf89');
        if(!stepper){
          const runner=s.enemies.find(e=>e.kind==='clone');
          if(runner){runner.circle=b.angle-.17;fx(s,'spark',lace.x,lace.y,'#f6bcff',18);}
          caption(s,lace.x,lace.y+9,'踩鞋带可再触发','#edb2ff');
        }
        event(s,'shoe',b.x,b.y,{source:stepper?.id||'runner'});s.score+=stepper?20:0;
      }
    }
  }
  for(const e of s.enemies){
    if(e.kind!=='clone')continue;
    if(s.roomTick===1)e.circle=b.angle-e.slot*.36;
    e.circle+=b.inner?-.0105:.0105;
    const pos=trackPoint(e.circle,!!b.inner);
    const [dx,dy]=unit(pos.x-e.x,pos.y-e.y);e.dx=dx;e.dy=dy;e.x=pos.x;e.y=pos.y;
    for(const hero of s.players)if(active(hero)&&distance(hero,e)<23)hitPlayer(s,hero,7,e.x,e.y);
  }
}
function stepBoss(s){
  const b=s.boss;if(!b||b.hp<=0)return;
  if(b.flash>0)b.flash--;
  if(!arsenal.stepBoss(s,b)){if(b.kind==='steel')steel(s,b);else thanos(s,b);}
}
function activateGong(s,x,y){
  fx(s,'ring',x,y,'#68eed9',30);event(s,'gong',x,y);
  const gong=s.props.find(o=>o.kind==='gong');if(gong)gong.flash=30;
  if(s.boss?.kind==='steel'){stun(s,s.boss,111,'找错机位！');s.score+=20;}
  else{
    damageRadius(s,480,290,650,15,'gong');
    caption(s,x,y-28,'彩排成功！','#8effbf');
  }
}
function handleProjectile(s,q){
  q.timer++;if(q.timer>q.life||q.life===0)return false;
  const extra=arsenal.projectile(s,q);if(extra!==undefined&&extra!==null)return extra;
  if(q.visual)return true;
  if(q.kind==='lob'){
    q.x+=q.vx;q.y+=q.vy;q.z=Math.sin(Math.PI*q.timer/31)*64;
    if(q.timer>=31){
      damageRadius(s,q.landX,q.landY,57,q.damage,q.owner);fx(s,'ring',q.landX,q.landY,'#ffd766',20);
      const owner=s.players.find(p=>p.id===q.owner);
      const pt=owner||q;
      const target={x:clamp(q.landX*.53+pt.x*.47,XMIN+10,XMAX-10),y:clamp(q.landY*.53+pt.y*.47,YMIN+10,YMAX-10)};
      if(s.props.some(b=>solid(b)&&insideBarrier(target,b,13))){target.x=pt.x;target.y=pt.y;}
      addProp(s,'rebound',target.x,target.y,24,{life:130,owner:q.owner});
      return false;
    }
    return true;
  }
  if(q.kind==='tray'&&q.timer===29){q.returning=true;q.hit=[];}
  if(q.returning){
    const owner=s.players.find(p=>p.id===q.owner);
    if(owner){if(distance(owner,q)<17)return false;const [dx,dy]=unit(owner.x-q.x,owner.y-q.y);q.vx=dx*8.5;q.vy=dy*8.5;}
  }
  const oldX=q.x,oldY=q.y;
  q.x+=q.vx;q.y+=q.vy;
  if(q.redirect){
    const target=s.props.find(o=>o.id===q.target);
    if(!target)return false;
    if(distance(q,target)<target.r){
      if(target.kind==='gong'){activateGong(s,target.x,target.y);return false;}
      const other=s.props.find(o=>o.kind==='portal'&&o.id!==target.id),gong=s.props.find(o=>o.kind==='gong');
      if(!other||!gong)return false;
      fx(s,'ring',target.x,target.y,'#92e6ff',18);fx(s,'ring',other.x,other.y,'#ff83cf',18);
      q.x=other.x;q.y=other.y;q.target=gong.id;
      const [dx,dy]=unit(gong.x-q.x,gong.y-q.y);q.vx=dx*10;q.vy=dy*10;
    }
    return true;
  }
  if(q.kind!=='tray'&&q.kind!=='slipper'&&q.kind!=='dunk'&&q.kind!=='beam'){
    let hitX=q.x<XMIN-6||q.x>XMAX+6,hitY=q.y<YMIN-6||q.y>YMAX+6;
    const barrier=s.props.find(b=>solid(b)&&insideBarrier(q,b,1));
    if(barrier){hitX=Math.abs(oldX-barrier.x)>=barrier.w/2;hitY=!hitX;}
    if(hitX||hitY){
      if(!q.reboundApplied&&q.team==='player'){
        const owner=s.players.find(p=>p.id===q.owner);const tier=owner?ranks(owner,'rebound'):0;
        if(tier){q.bounces=(q.bounces||0)+tier;q.damage=Math.ceil(q.damage*1.22);q.reboundApplied=true;}
      }
      if(!q.bounces)return false;q.bounces--;q.x=oldX;q.y=oldY;if(hitX)q.vx=-q.vx;if(hitY)q.vy=-q.vy;
      fx(s,'spark',q.x,q.y,'#ffd051',12);
    }
  }
  if(q.x<0||q.x>960||q.y<50||q.y>545){
    if(q.kind==='tray'&&!q.returning){q.returning=true;q.hit=[];}
    else if(!q.returning)return false;
  }
  if(q.team==='player'){
    if(s.props.some(o=>o.kind==='portal')){
      const glow=s.shots.find(o=>o.team==='enemy'&&o.kind==='glow'&&distance(o,q)<o.r+q.r+8);
      if(glow){routeBaton(s,glow,q.owner);if(!q.through)return false;}
    }
    const foes=s.boss?[s.boss,...s.enemies]:s.enemies;
    for(const e of foes){
      if(e.hp<=0||q.hit.includes(e.id)||distance(q,e)>q.r+e.r)continue;
      hitEnemy(s,e,q.damage,q.owner);arsenal.onHit(s,q,e);q.hit.push(e.id);
      if(q.life===0||(!q.through&&e.kind!=='clone'))return false;
    }
    for(const o of s.props)if(o.kind==='dummy'&&!q.hit.includes(o.id)&&distance(o,q)<o.r+q.r){
      o.flash=12;fx(s,'hit',o.x,o.y,'#ffd777',12);event(s,'hit',o.x,o.y,{source:q.owner,damage:q.damage});q.hit.push(o.id);if(!q.through)return false;
    }
  }else{
    for(const p of s.players)if(active(p)&&distance(q,p)<q.r+12){
      hitPlayer(s,p,q.damage,q.x,q.y);return false;
    }
  }
  return true;
}
function stepHazards(s){
  for(const h of s.hazards){
    h.timer++;
    if(h.timer<h.warn||!h.damage)continue;
    for(const p of s.players){
      if(!active(p)||h.hit.includes(p.id))continue;
      const touch=h.w>0?p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h:distance(p,h)<h.r+9;
      if(touch){hitPlayer(s,p,h.damage,h.x+h.w/2,h.y+h.h/2);h.hit.push(p.id);}
    }
  }
  s.hazards=s.hazards.filter(h=>h.timer<h.life);
}
function stepProps(s){
  for(const item of s.props){
    item.timer++;if(item.flash>0)item.flash--;
    arsenal.prop?.(s,item);
    if(['heart','energy','coin'].includes(item.kind)){
      const eligible=p=>active(p)&&(item.kind==='heart'?p.hp<p.maxHp:item.kind==='energy'?p.energy<p.maxEnergy:true);
      const p=nearest(s.players,item,eligible);
      if(p){
        const range=58+75*ranks(p,'magnet');
        if(distance(item,p)<range)moveTo(item,p.x,p.y,4.7);
        if(distance(item,p)<22){
          const n=item.amount||1;
          if(item.kind==='heart'){p.hp=Math.min(p.maxHp,p.hp+n);fx(s,'heal',p.x,p.y,'#73de91',20);}
          if(item.kind==='energy')p.energy=Math.min(p.maxEnergy,p.energy+n);
          if(item.kind==='coin'){s.coins+=n;for(const a of s.players)a.coins=s.coins;p.energy=Math.min(p.maxEnergy,p.energy+2*ranks(p,'magnet'));}
          event(s,item.kind==='heart'?'heal':item.kind,p.x,p.y,{target:p.id,amount:n});item.life=0;
        }
      }
    }else if(item.kind==='rebound'){
      const p=nearest(s.players,item,active);
      if(p&&distance(p,item)<item.r+11){
        const t=bodyTarget(s,p),[dx,dy]=t?unit(t.x-p.x,t.y-p.y):unit(p.dx,p.dy);
        projectile(s,'dunk','player',p.x,p.y,dx*11,dy*11,33,{r:14,life:78,through:true,owner:p.id});
        caption(s,p.x,p.y-19,'补篮！','#ffda78');fx(s,'ring',p.x,p.y,'#ffd15b');event(s,'rebound',p.x,p.y);item.life=0;
      }
    }
  }
  s.props=s.props.filter(o=>o.life<0||o.timer<o.life);
}
function wave(s){
  if(s.roomInfo.cleared)return;
  if(s.roomInfo.type==='boss'){
    if(s.boss?.hp<=0)clearRoom(s);
  }else if(s.enemies.length===0)clearRoom(s);
}
function revive(s){
  for(const p of s.players){
    if(!p.down||p.disconnected)continue;
    const helper=nearest(s.players,p,active);
    if(helper&&distance(p,helper)<66){p.revive=Math.min(1,p.revive+1/74);}
    else p.revive=Math.max(0,p.revive-.002);
    if(p.revive>=1){p.down=false;p.hp=Math.ceil(p.maxHp*.5);p.invuln=115;p.revive=0;p.action='idle';
      caption(s,p.x,p.y-20,'重新上场！','#88ffd3');event(s,'revive',p.x,p.y,{source:helper?.id,target:p.id});}
  }
}
function applyWeapon(s,p,weapon,spot){
  if(p.weapon===weapon||p.otherWeapon===weapon)return false;
  const replaced=p.weapon;
  if(!p.otherWeapon)p.otherWeapon=replaced;
  else addProp(s,'weapon',clamp(spot.x+32,75,885),clamp(spot.y+24,135,451),18,{weapon:replaced,label:WEAPONS[replaced]});
  p.weapon=weapon;p.attackCd=10;caption(s,p.x,p.y-22,WEAPONS[weapon],'#8cefe1');
  event(s,'equip',p.x,p.y,{source:p.id,weapon});return true;
}
function startTalents(s){
  s.phase='talent';s.phaseTick=0;s.reward={options:talentOptions(()=>rand(s)),choices:{},left:0};
  s.props=s.props.filter(o=>o.kind!=='talent'&&o.kind!=='exit'&&o.kind!=='door');
  s.reward.options.forEach((t,index)=>addProp(s,'talent',280+index*200,282,27,{index,talentId:t.id,label:t.name}));
  s.players.forEach((p,i)=>{p.x=430+i*33;p.y=379;p.interactHeld=true;p.interactHint='选择本层天赋';});
  s.objective='每人选一项天赋，再进入下一层。';event(s,'reward',480,292);
}
function choose(s,p,index){
  const r=s.reward,t=r?.options[index];if(!t||!active(p)||Object.hasOwn(r.choices,p.id))return;
  r.choices[p.id]=t.id;
  if(r.left===0)r.left=480;
  caption(s,p.x,p.y-19,t.name,'#ffc46a');event(s,'talent',p.x,p.y,{source:p.id,talent:t.id});
}
function finishTalents(s){
  for(const p of s.players){
    if(p.disconnected)continue;
    const id=s.reward.choices[p.id]||s.reward.options[0].id;
    p.talents.push(id);
    if(id==='shell'){p.maxShield+=12;p.shield=Math.min(p.maxShield,p.shield+12);}
    if(id==='glove')p.glove=true;
  }
  beginFloor(s,s.floor+1);
}
function advanceTalents(s){
  const r=s.reward;
  if(r.left>0&&--r.left===0){finishTalents(s);return;}
  if(s.players.filter(active).every(p=>Object.hasOwn(r.choices,p.id)))finishTalents(s);
}
function offerHint(p,o,s){
  if(o.kind==='door')return o.open?'进入 '+o.label:'清场后开门';
  if(o.kind==='exit')return o.final?'进入放学出口 · 完成本局':'传送 · 选择下一层天赋';
  if(o.kind==='talent')return Object.hasOwn(s.reward.choices,p.id)?'等待队友':'选天赋 · '+o.label;
  if(o.kind==='chest')return '打开 '+o.label;
  if(o.kind==='shop')return (o.price>s.coins?'金币不足 · ':'购买 · ')+o.label+'（'+o.price+' 金币）';
  if(o.kind==='weapon')return (p.weapon===o.weapon||p.otherWeapon===o.weapon?'已持有 · ':p.otherWeapon?'替换当前武器 · ':'拾取 · ')+o.label;
  return '';
}
function interact(s,p,input){
  const tapped=!!input.interact&&!p.interactHeld;p.interactHeld=!!input.interact;p.interactHint='';
  if(!active(p))return;
  const valid=o=>o.life!==0&&(s.phase==='talent'?o.kind==='talent':
    ['door','exit','weapon'].includes(o.kind)||(o.kind==='shop'&&!o.sold)||(o.kind==='chest'&&!o.opened));
  let item=nearest(s.props,p,valid);
  if(item&&distance(item,p)>71)item=null;
  if(item)p.interactHint=offerHint(p,item,s);
  if(s.phase==='talent'&&Number.isInteger(input.choice)&&input.choice>=0&&input.choice<3){choose(s,p,input.choice);return;}
  if(!item)return;
  if(item.kind==='door'){
    const g=GATES[item.dir],out=(Number(input.x)||0)*g.dx+(Number(input.y)||0)*g.dy;
    if(tapped||out>.35&&distance(p,item)<24)travel(s,item.dir);
    return;
  }
  if(item.kind==='exit'){
    // Permit deliberate walking into the portal as well as the interaction key.
    const entering=item.timer>40&&distance(p,item)<20&&(Math.abs(input.x||0)+Math.abs(input.y||0)>.2);
    if(!tapped&&!entering)return;
    if(item.final){
      s.phase='won';s.phaseTick=0;s.objective='四层首领悉数击败，放学铃响了！';
      event(s,'win',item.x,item.y);
    }else startTalents(s);
    return;
  }
  if(!tapped)return;
  if(item.kind==='talent'){choose(s,p,item.index);return;}
  if(item.kind==='weapon'){if(applyWeapon(s,p,item.weapon,item))item.life=0;return;}
  if(item.kind==='chest'){
    item.opened=true;
    addProp(s,'weapon',item.x,item.y+28,18,{weapon:item.weapon,label:WEAPONS[item.weapon]});
    addProp(s,'energy',item.x-48,item.y,10,{amount:16});
    addProp(s,'coin',item.x+44,item.y,10,{amount:3});
    event(s,'chest',item.x,item.y);return;
  }
  if(item.kind==='shop'){
    if(s.coins<item.price){caption(s,p.x,p.y-16,'金币不足','#f5bb74');return;}
    if(item.offer==='weapon'&&!applyWeapon(s,p,item.weapon,item))return;
    if(item.offer==='heal'){if(p.hp>=p.maxHp){caption(s,p.x,p.y-16,'生命已满');return;}p.hp=Math.min(p.maxHp,p.hp+32);}
    if(item.offer==='energy'){if(p.energy>=p.maxEnergy){caption(s,p.x,p.y-16,'能量已满');return;}p.energy=Math.min(p.maxEnergy,p.energy+55);}
    s.coins-=item.price;for(const a of s.players)a.coins=s.coins;item.sold=true;
    fx(s,'heal',p.x,p.y,'#84f3b3');event(s,'purchase',p.x,p.y,{source:p.id,offer:item.offer});
  }
}
export function stepGame(s,inputs={}){
  s.tick++;s.phaseTick++;s.events=[];
  if(s.phase==='won'||s.phase==='lost')return s;
  const prev=s.roomId,phase=s.phase;
  s.roomTick++;if(s.doorGrace>0)s.doorGrace--;
  for(let i=0;i<s.players.length;i++){
    const p=s.players[i],input=(Array.isArray(inputs)?inputs[i]:inputs?.[p.id])||{};
    stepPlayer(s,p,input);interact(s,p,input);
    if(s.roomId!==prev||phase!==s.phase)return s;
  }
  if(s.phase==='talent'){advanceTalents(s);return s;}
  stepBoss(s);
  for(const e of s.enemies)stepEnemy(s,e);
  s.shots=s.shots.filter(q=>handleProjectile(s,q));
  stepHazards(s);stepProps(s);revive(s);
  s.effects=s.effects.filter(f=>++f.timer<f.life).slice(-72);
  s.enemies=s.enemies.filter(e=>e.hp>0);
  if(!s.players.some(active)){
    s.phase='lost';s.phaseTick=0;s.objective='全队倒下，再试一次。';event(s,'loss',480,276);return s;
  }
  wave(s);return s;
}
