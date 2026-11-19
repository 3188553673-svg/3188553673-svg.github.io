/** Fixed-step, serializable simulation shared by the browser and the room host. */
export const HEROES = {
  kobe:{name:'科比',color:'#ffc85c',skill:'后仰跳投',weapon:'24 号训练球',detail:'后撤抛投，跑进落点触发补篮。',skillMax:178},
  iron:{name:'钢铁侠',color:'#ff7156',skill:'推进掌心炮',weapon:'掌心脉冲',detail:'沿瞄准方向突进，发射贯穿电弧。',skillMax:185},
  jianguo:{name:'灭建国',color:'#b69aff',skill:'家长拍桌',weapon:'家长签章',detail:'架盾拍桌，震退围上来的整圈敌人。',skillMax:192}
};
export const WEAPONS = {basket:'24 号训练球',pulse:'掌心脉冲',stamp:'家长签章',tray:'回旋餐盘',bell:'下课铃'};
export const STAGES = [
  {id:'warmup',name:'器材热身',tip:'打打木桩热身，清理闯进器材室的小怪。'},
  {id:'stands',name:'看台彩排',tip:'攻击发光应援棒，将它送进传送门敲锣。清理围上来的观众。'},
  {id:'steel',name:'直播擂台',tip:'响指落下前躲开条纹半场。连麦后，击回应援棒敲响 PK 锣。'},
  {id:'supply',name:'中场补给',tip:'每人走到一个发光武器台，领取新武器与补给。'},
  {id:'track',name:'跑道集结',tip:'躲开黄线上的冲刺，击败领跑员和他的队伍。'},
  {id:'thanos',name:'最后一次早操',tip:'找到真身脚后的紫色鞋带，踩住让灭霸掉鞋。'}
];
const XMIN=35, XMAX=925, YMIN=96, YMAX=492;
const HERO_WEAPON={kobe:'basket',iron:'pulse',jianguo:'stamp'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=p=>!p.down&&!p.disconnected;
function unit(x,y){const n=Math.hypot(x,y);return n>0.001?[x/n,y/n]:[1,0];}
function moveTo(a,x,y,speed){const n=Math.hypot(x-a.x,y-a.y);if(n<0.001)return; a.dx=(x-a.x)/n;a.dy=(y-a.y)/n;a.x+=a.dx*Math.min(n,speed);a.y+=a.dy*Math.min(n,speed);}
function uid(s){return s.nextId++;}
function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function event(s,kind,x,y,more={}){s.events.push({id:uid(s),tick:s.tick,kind,x,y,...more});}
function fx(s,kind,x,y,color,life=18,words=''){
  s.effects.push({id:uid(s),kind,x,y,color,timer:0,life,text:words});
}
function caption(s,x,y,txt,color='#ffdc7c'){fx(s,'text',x,y,color,65,txt);}
function addProp(s,kind,x,y,r,more={}){
  const p={id:uid(s),kind,x,y,r,timer:0,life:-1,...more};s.props.push(p);return p;
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
  for(const b of s.props)if(b.kind==='barrier'&&insideBarrier(p,b,r)&&dx)p.x=b.x-Math.sign(dx)*(b.w/2+r);
  p.y=clamp(p.y+dy,YMIN,YMAX);
  for(const b of s.props)if(b.kind==='barrier'&&insideBarrier(p,b,r)&&dy)p.y=b.y-Math.sign(dy)*(b.h/2+r);
}
function newPlayer(pick,i){
  const spec=typeof pick==='string'?{hero:pick}:pick||{};
  const hero=Object.hasOwn(HEROES,spec.hero)?spec.hero:'kobe';
  const hp=hero==='jianguo'?124:104;
  return {id:String(spec.id??'p'+(i+1)),hero,name:String(spec.name||HEROES[hero].name),x:0,y:0,dx:1,dy:0,
    hp,maxHp:hp,down:false,disconnected:false,revive:0,skillCd:0,skillMax:HEROES[hero].skillMax,dashCd:0,dashMax:66,
    attackCd:0,invuln:0,action:'idle',actionTick:0,dashTicks:0,dashX:1,dashY:0,weapon:HERO_WEAPON[hero],
    starterWeapon:HERO_WEAPON[hero],otherWeapon:null,swapHeld:false,selected:false,attackCount:0,glove:false};
}
export function createGame(picks=['kobe'],seed){
  if(!Array.isArray(picks)||!picks.length)picks=['kobe'];
  const s={tick:0,rng:(Number.isFinite(seed)?seed:Math.floor(Math.random()*4294967296))>>>0,nextId:1,stage:0,room:'warmup',phase:'play',phaseTick:0,roomTick:0,objective:'',
    players:picks.slice(0,4).map(newPlayer),enemies:[],shots:[],hazards:[],props:[],effects:[],boss:null,events:[],kills:0,score:0,wave:0};
  enter(s,0);return s;
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
function enter(s,index){
  s.stage=index;s.room=STAGES[index].id;s.objective=STAGES[index].tip;s.roomTick=0;s.phaseTick=0;s.phase='play';s.boss=null;s.wave=0;
  s.enemies=[];s.shots=[];s.hazards=[];s.props=[];s.effects=[];
  s.players.forEach((p,i)=>{
    p.x=index===3?480+(i%2)*55-27:205+(i%2)*46;p.y=index===3?184+Math.floor(i/2)*33:260+Math.floor(i/2)*46;
    if(p.disconnected)return;
    if(p.down){p.hp=Math.ceil(p.maxHp*.45);p.down=false;}
    p.hp=Math.min(p.maxHp,p.hp+(index===3?40:index?12:0));
    p.invuln=65;p.action='idle';p.actionTick=0;p.dashTicks=0;p.revive=0;p.selected=false;p.attackCd=0;p.skillCd=0;p.dashCd=0;
    if(index===3)p.glove=true;
  });
  if(index===0){
    addProp(s,'dummy',347,284,20,{flash:0});
    const off=Math.round(rand(s)*55);
    for(const [x,y] of [[495,180+off],[665,404-off]])addProp(s,'barrier',x,y,16,{w:76,h:31});
    s.wave=-1;
  }else if(index===1){
    portals(s);
    const shift=rand(s)*55;
    for(const [x,y] of [[485,188+shift],[485,386-shift]])addProp(s,'barrier',x,y,15,{w:92,h:25});
    spawnEnemy(s,'runner',683,140);spawnEnemy(s,'chair',811,314);spawnEnemy(s,'chair',686,448);
  }else if(index===2){
    makeBoss(s,'steel',690,298);
  }else if(index===3){
    for(const [i,weapon] of ['basket','tray','bell'].entries())addProp(s,'rack',255+i*225,345,37,{weapon,label:WEAPONS[weapon]});
  }else if(index===4){
    const offset=(rand(s)-.5)*58;
    for(const [x,y] of [[420,202+offset],[620,370-offset]])addProp(s,'barrier',x,y,16,{w:50,h:40});
    spawnEnemy(s,'mop',777,272,{elite:true});spawnEnemy(s,'runner',806,413);spawnEnemy(s,'runner',646,126);
  }else{
    makeBoss(s,'thanos',780,300);
    const n=2+Math.min(2,s.players.filter(p=>!p.disconnected).length);
    for(let i=1;i<=n;i++)spawnEnemy(s,'clone',780,300,{slot:i});
    addProp(s,'lace',735,275,20);
  }
  event(s,'room',480,260,{stage:index});
}
function clearRoom(s){
  s.phase=s.stage===STAGES.length-1?'won':'clear';s.phaseTick=0;s.shots=[];s.hazards=[];
  s.objective=s.phase==='won'?'放学铃响了，合作通关！':'房间通过';
  if(s.phase==='won'&&s.players.some(p=>p.hero==='jianguo'&&!p.disconnected))
    s.objective='灭建国签完家长意见，灭霸终于穿好了两只鞋。';
  event(s,s.phase==='won'?'win':'clear',480,276);
}
function hitPlayer(s,p,damage,x,y){
  if(!active(p)||p.invuln>0||s.phase!=='play')return;
  p.hp=Math.max(0,p.hp-damage);p.invuln=54;
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
  if(e!==s.boss&&(e.elite||s.kills%3===0))addProp(s,'heart',e.x,e.y,15,{life:640});
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
  for(const q of s.shots)if(q.kind==='glow'&&q.team==='enemy'&&distance(q,p)<r)routeBaton(s,q,p.id);
}
function shootPlayer(s,p,input){
  const [dx,dy]=aim(s,p,input);p.dx=dx;p.dy=dy;p.attackCount++;
  if(p.actionTick<=3){p.action='attack';p.actionTick=10;}
  const common={owner:p.id};const x=p.x+dx*14,y=p.y+dy*14;
  switch(p.weapon){
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
  batNearby(s,p,44);event(s,'attack',p.x,p.y,{source:p.id,weapon:p.weapon});
}
function useSkill(s,p,input){
  const [dx,dy]=aim(s,p,input);p.dx=dx;p.dy=dy;p.action='skill';p.actionTick=25;p.skillCd=p.skillMax;
  if(p.hero==='kobe'){
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
  if(input.dash&&p.dashCd===0){
    p.dashCd=p.dashMax;p.dashTicks=9;p.dashX=dx;p.dashY=dy;p.invuln=Math.max(p.invuln,15);p.action='dash';p.actionTick=10;
    if(p.glove){
      const q=nearest(s.shots,p,q=>q.team==='enemy');
      if(q&&distance(q,p)<113&&!routeBaton(s,q,p.id)){
        const target=bodyTarget(s,p);const [tx,ty]=target?unit(target.x-q.x,target.y-q.y):[dx,dy];
        q.team='player';q.owner=p.id;q.damage=18;q.vx=tx*7;q.vy=ty*7;q.hit=[];
      }
    }
    event(s,'dash',p.x,p.y,{source:p.id});
  }
  if(p.dashTicks>0){walk(s,p,p.dashX*8.4,p.dashY*8.4);p.dashTicks--;if(s.tick%2===0)fx(s,'dash',p.x,p.y,HEROES[p.hero].color,9);}
  else if(mag>.08){const speed=p.hero==='jianguo'?2.48:2.9;walk(s,p,dx*speed*Math.min(1,mag),dy*speed*Math.min(1,mag));if(!p.actionTick){p.action='run';p.dx=dx;p.dy=dy;}}
  else if(!p.actionTick)p.action='idle';
  if(s.room==='supply')return;
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
  const b=s.props.find(o=>o.kind==='barrier'&&insideBarrier(probe,o,e.r));
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
  if(b.kind==='steel')steel(s,b);else thanos(s,b);
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
  if(q.visual)return true;
  if(q.kind==='lob'){
    q.x+=q.vx;q.y+=q.vy;q.z=Math.sin(Math.PI*q.timer/31)*64;
    if(q.timer>=31){
      damageRadius(s,q.landX,q.landY,57,q.damage,q.owner);fx(s,'ring',q.landX,q.landY,'#ffd766',20);
      const owner=s.players.find(p=>p.id===q.owner);
      const pt=owner||q;
      const target={x:clamp(q.landX*.53+pt.x*.47,XMIN+10,XMAX-10),y:clamp(q.landY*.53+pt.y*.47,YMIN+10,YMAX-10)};
      if(s.props.some(b=>b.kind==='barrier'&&insideBarrier(target,b,13))){target.x=pt.x;target.y=pt.y;}
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
  if(q.kind!=='tray'&&q.kind!=='dunk'&&q.kind!=='beam'){
    let hitX=q.x<XMIN-6||q.x>XMAX+6,hitY=q.y<YMIN-6||q.y>YMAX+6;
    const barrier=s.props.find(b=>b.kind==='barrier'&&insideBarrier(q,b,1));
    if(barrier){hitX=Math.abs(oldX-barrier.x)>=barrier.w/2;hitY=!hitX;}
    if(hitX||hitY){
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
      hitEnemy(s,e,q.damage,q.owner);q.hit.push(e.id);if(!q.through&&e.kind!=='clone')return false;
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
    if(item.kind==='heart'){
      const p=nearest(s.players,item,p=>active(p)&&p.hp<p.maxHp);
      if(p&&distance(item,p)<39){p.hp=Math.min(p.maxHp,p.hp+26);fx(s,'heal',p.x,p.y,'#80f0a1',22);event(s,'heal',p.x,p.y);item.life=0;}
    }else if(item.kind==='rebound'){
      const p=nearest(s.players,item,active);
      if(p&&distance(p,item)<item.r+11){
        const t=bodyTarget(s,p),[dx,dy]=t?unit(t.x-p.x,t.y-p.y):unit(p.dx,p.dy);
        projectile(s,'dunk','player',p.x,p.y,dx*11,dy*11,33,{r:14,life:78,through:true,owner:p.id});
        caption(s,p.x,p.y-19,'补篮！','#ffda78');fx(s,'ring',p.x,p.y,'#ffd15b');event(s,'rebound',p.x,p.y);item.life=0;
      }
    }else if(item.kind==='rack'){
      for(const p of s.players)if(active(p)&&!p.selected&&distance(p,item)<item.r+5){
        p.selected=true;
        // If the basketball player selects the ball again, keep the tray as a spare.
        p.otherWeapon=p.weapon===item.weapon?'tray':p.weapon;
        p.weapon=item.weapon;
        fx(s,'heal',p.x,p.y,'#89f9c7',30);caption(s,p.x,p.y-22,item.label);
        event(s,'equip',p.x,p.y,{source:p.id,weapon:p.weapon});
      }
    }
  }
  s.props=s.props.filter(o=>o.life<0||o.timer<o.life);
}
function wave(s){
  if(s.boss){
    if(s.boss.hp<=0){s.enemies=[];clearRoom(s);}return;
  }
  if(s.room==='supply'){
    if(s.players.filter(p=>!p.disconnected).every(p=>p.selected))clearRoom(s);return;
  }
  if(s.room==='stands'&&s.roomTick%131===38)tossBaton(s);
  if(s.room==='warmup'&&s.wave<0){
    if(s.roomTick===125){
      s.wave=0;
      const off=Math.round(rand(s)*60);
      spawnEnemy(s,'chair',746,240+off);spawnEnemy(s,'mop',826,394-off);
      caption(s,712,228,'器材队入场','#ffe49c');
    }
    return;
  }
  if(s.enemies.length||s.roomTick<35)return;
  if(s.wave===0){
    s.wave++;
    const n=s.players.filter(p=>!p.disconnected).length;
    const count=(s.room==='warmup'?2:3)+Math.max(0,n-1);
    for(let i=0;i<count;i++){
      const e=spawnEnemy(s,i===0?'mop':i%2?'runner':'chair',clamp(520+rand(s)*335,530,860),i%2?125+rand(s)*60:395+rand(s)*68);
      fx(s,'ring',e.x,e.y,'#e2a78d',35);
    }
  }else clearRoom(s);
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
export function stepGame(s,inputs={}){
  s.tick++;s.phaseTick++;s.events=[];
  if(s.phase==='won'||s.phase==='lost')return s;
  if(s.phase==='clear'){if(s.phaseTick>=88)enter(s,s.stage+1);return s;}
  s.roomTick++;
  for(let i=0;i<s.players.length;i++){
    const p=s.players[i],input=(Array.isArray(inputs)?inputs[i]:inputs?.[p.id])||{};
    stepPlayer(s,p,input);
  }
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
