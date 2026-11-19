// v0.2 character, guest bosses and collectible weapons. Enemy AI and pickup
// state are plain simulation data so every LAN client sees the same action.
export const EXTRA_HEROES = {
  nailong: {
    name: '奶龙', color: '#ffd652', skill: '弹肚翻滚', weapon: '吨吨奶瓶',
    detail: '弹肚向前滚，方向键可以转弯；到点坐墩，震开围在身边的小怪。',
    skillMax: 184, starter: 'milk'
  }
};

export const EXTRA_WEAPONS = {
  milk: '吨吨奶瓶', wrap: '大饼卷肉', chalk: '考试粉笔头',
  rollcall: '班主任点名册', slipper: '宿管飞拖鞋', horn: '早八扩音器'
};

export const EXTRA_COST = { milk: 0, wrap: 3, chalk: 2, rollcall: 4, slipper: 2, horn: 3 };

export const EXTRA_WEAPON_DETAILS = {
  milk: '连发奶滴。每三轮喷出一团浓奶，命中时向周围溅开。',
  wrap: '一卷打穿整排，把沿途的小怪推到一块儿。',
  chalk: '五根粉笔扇形飞出，擦到墙面还会反弹一次。',
  rollcall: '点名页追向目标，命中后自动给附近下一个敌人点名，最多三人。',
  slipper: '拖鞋打中后弹向旁边的敌人，最后倒飞回手，返程还能再抽一下。',
  horn: '朝前方喊出一扇声浪，击退小怪，吹散迎面飞来的普通弹幕。'
};

const LIMIT = { left: 38, right: 922, top: 99, bottom: 488 };
const livePlayer = p => !p.down && !p.disconnected;
const liveEnemy = e => e.hp > 0 && e.kind !== 'clone';
function foes(s) {
  return s.boss ? [s.boss, ...s.enemies] : s.enemies;
}
function pointOnSegment(p, a, b, radius) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy) <= radius;
}
function inCone(p, dx, dy, target, reach, dot) {
  const x = target.x - p.x, y = target.y - p.y, length = Math.hypot(x,y);
  return length <= reach + (target.r || 0) && (length < 15 || x * dx + y * dy >= dot * length);
}
function distanceToCart(c,x,y,r) {
  return Math.hypot(Math.max(0, Math.abs(x-c.x)-c.w/2), Math.max(0, Math.abs(y-c.y)-c.h/2)) <= r;
}

export function createCombatV2(api) {
  const { addProp, projectile, hazard, fx, caption, event, hitEnemy, hitPlayer,
    damageRadius, walk, stun, clamp, distance, unit, nearest, moveTo } = api;

  function shoot(s, p, dx, dy) {
    const x = p.x + dx * 16, y = p.y + dy * 16;
    const launch = (kind, angle, speed, damage, options = {}) => {
      const a = Math.atan2(dy, dx) + angle;
      return projectile(s,kind,'player',x,y,Math.cos(a)*speed,Math.sin(a)*speed,damage,{owner:p.id,...options});
    };
    switch (p.weapon) {
      case 'milk': {
        p.attackCd = 18;
        p.milkShots = (p.milkShots || 0) + 1;
        if (p.milkShots % 3 === 0) {
          launch('milk',0,7.0,11,{r:9,life:60,creamy:true});
        } else {
          launch('milk',-.052,8,6,{r:5,life:56});
          launch('milk', .052,8,6,{r:5,life:56});
        }
        break;
      }
      case 'wrap':
        p.attackCd = 36;
        launch('wrap',0,7.8,26,{r:13,life:79,through:true});
        break;
      case 'chalk':
        p.attackCd = 32;
        for (let i=-2;i<=2;i++) launch('chalk',i*.122,8.7-Math.abs(i)*.12,7,{r:4,life:52,bounces:1});
        break;
      case 'rollcall':
        p.attackCd = 48;
        launch('rollcall',0,8.0,23,{r:8,life:133,through:true,visits:0});
        break;
      case 'slipper':
        p.attackCd = 35;
        launch('slipper',0,9.1,22,{r:10,life:116,through:true,skips:0});
        break;
      case 'horn': {
        p.attackCd = 41;
        for (const e of foes(s)) {
          if (!liveEnemy(e) || !inCone(p,dx,dy,e,182,.57)) continue;
          hitEnemy(s,e,30,p.id);
          if (e !== s.boss && e.hp>0) {
            const [kx,ky]=unit(e.x-p.x,e.y-p.y);
            walk(s,e,kx*39,ky*39,e.r);
            if(!e.elite){e.action='recovery';e.timer=20;}
          }
        }
        for(const q of s.shots) {
          if(q.team!=='enemy'||!inCone(p,dx,dy,q,170,.48))continue;
          if(q.kind==='courtball') returnBall(s,q,p.id);
          else if(q.kind!=='glow') q.life=0;
        }
        for(const o of s.props)if(o.kind==='dummy'&&inCone(p,dx,dy,o,182,.57))o.flash=12;
        launch('hornWave',0,0,0,{x:p.x,y:p.y,r:160,life:17,visual:true,dx,dy});
        break;
      }
      default: return false;
    }
    return true;
  }

  function skill(s,p,input,dx,dy) {
    if(p.hero!=='nailong')return false;
    if(Math.hypot(input.x || 0,input.y || 0)>.1)[dx,dy]=unit(input.x,input.y);
    p.dx=dx;p.dy=dy;p.rollX=dx;p.rollY=dy;p.rollTicks=36;p.rollHits=[];
    p.action='bellyRoll';p.actionTick=36;p.invuln=Math.max(p.invuln,38);
    fx(s,'ring',p.x,p.y,'#ffdc55',18);
    return true;
  }

  function stepPlayer(s,p,input) {
    if(!p.rollTicks)return false;
    const x=input?.x || 0,y=input?.y || 0;
    if(Math.hypot(x,y)>.12) {
      const [ax,ay]=unit(x,y);
      [p.rollX,p.rollY]=unit(p.rollX+ax*.28,p.rollY+ay*.28);
    }
    const ox=p.x,oy=p.y;
    walk(s,p,p.rollX*6.4,p.rollY*6.4);
    if(Math.abs((p.x-ox)-p.rollX*6.4)>1)p.rollX*=-1;
    if(Math.abs((p.y-oy)-p.rollY*6.4)>1)p.rollY*=-1;
    p.dx=p.rollX;p.dy=p.rollY;p.action='bellyRoll';p.actionTick=p.rollTicks;
    for(const e of foes(s)){
      if(!liveEnemy(e)||p.rollHits.includes(e.id)||distance(p,e)>21+e.r)continue;
      hitEnemy(s,e,23,p.id);p.rollHits.push(e.id);
    }
    swat(s,p,51);
    if(s.tick%5===0)fx(s,'dash',p.x,p.y,'#ffe48a',10);
    if(--p.rollTicks===0){
      p.action='bellyDrop';p.actionTick=19;
      damageRadius(s,p.x,p.y,87,34,p.id);
      fx(s,'ring',p.x,p.y,'#ffce46',24);
      projectile(s,'bellyRing','player',p.x,p.y,0,0,0,{visual:true,r:87,life:17,owner:p.id});
      event(s,'bellyDrop',p.x,p.y,{source:p.id});
    }
    return true;
  }

  function onHit(s,q,e) {
    if(e.kind==='clone')return;
    if(q.kind==='milk'&&q.creamy){
      q.creamy=false;
      fx(s,'ring',q.x,q.y,'#fff0ae',17);
      for(const other of foes(s)){
        if(other!==e&&liveEnemy(other)&&distance(q,other)<47+other.r)hitEnemy(s,other,10,q.owner);
      }
    }else if(q.kind==='wrap'&&e!==s.boss&&e.hp>0){
      const [dx,dy]=unit(q.vx,q.vy);
      walk(s,e,dx*32,dy*32,e.r);fx(s,'spark',e.x,e.y,'#e6ae55',12);
    }else if(q.kind==='rollcall'){
      q.visits++;
      caption(s,e.x,e.y-23,'到！','#dfbeff');
      const next=nearest(foes(s),q,other=>other!==e&&liveEnemy(other)&&!q.hit.includes(other.id));
      if(q.visits>=3||!next||distance(next,q)>265)q.life=0;
      else q.lockId=next.id;
    }else if(q.kind==='slipper'&&!q.returning){
      q.skips++;
      const next=nearest(foes(s),q,other=>other!==e&&liveEnemy(other)&&!q.hit.includes(other.id));
      if(q.skips<3&&next&&distance(next,q)<=205){
        const [dx,dy]=unit(next.x-q.x,next.y-q.y);q.vx=dx*10;q.vy=dy*10;
        fx(s,'spark',q.x,q.y,'#fe9468',12);
      }else{q.returning=true;q.turnTick=q.timer;}
    }
  }

  function returnBall(s,q,owner) {
    if(s.boss?.kind!=='captain'||q.deflected||q.life===0||s.boss.hp<=0)return false;
    q.deflected=true;q.team='player';q.owner=owner;q.hit=[];q.life=q.timer+146;
    fx(s,'ring',q.x,q.y,'#ffdb63',13);event(s,'batBall',q.x,q.y,{source:owner});
    return true;
  }

  function swat(s,p,range) {
    if(s.boss?.kind!=='captain')return;
    for(const q of s.shots)if(q.kind==='courtball'&&!q.deflected&&distance(q,p)<=range+q.r)returnBall(s,q,p.id);
  }

  function stepBall(s,q) {
    const b=s.boss;
    if(b?.kind!=='captain'||b.hp<=0)return false;
    if(q.deflected){
      const hoop={x:b.hoopX,y:b.hoopY};
      const [dx,dy]=unit(hoop.x-q.x,hoop.y-q.y);q.vx=dx*9.6;q.vy=dy*9.6;
      q.z=Math.min(25,Math.sin(Math.min(1,distance(hoop,q)/170)*Math.PI*.47)*25);
      if(distance(hoop,q)<18){
        if(!b.stun){
          b.goals++;b.windDir=0;
          s.hazards=s.hazards.filter(h=>h.kind!=='crosswind');
          stun(s,b,90,'乌龙！暂停！');hitEnemy(s,b,31,q.owner);
          event(s,'ownGoal',b.hoopX,b.hoopY,{source:q.owner});
          fx(s,'ring',b.hoopX,b.hoopY,'#ffdc62',28);s.score+=22;
        }
        return false;
      }
    }else{
      q.z=3+Math.abs(Math.sin(q.timer*.088))*10;
      if(b.action==='gust')q.vx=clamp(q.vx+b.windDir*.1,-4.8,4.8);
      for(const p of s.players)if(livePlayer(p)&&distance(p,q)<19&&!q.hit.includes(p.id)){
        hitPlayer(s,p,7,q.x,q.y);q.hit.push(p.id);
        const [dx,dy]=unit(q.x-p.x,q.y-p.y);q.vx=dx*2.8;q.vy=dy*2.8;
      }
    }
    q.x+=q.vx;q.y+=q.vy;
    if(!q.deflected){
      if(q.x<LIMIT.left+10||q.x>LIMIT.right-10){q.x=clamp(q.x,LIMIT.left+10,LIMIT.right-10);q.vx*=-.9;}
      if(q.y<LIMIT.top+9||q.y>LIMIT.bottom-9){q.y=clamp(q.y,LIMIT.top+9,LIMIT.bottom-9);q.vy*=-.9;}
    }
    return true;
  }

  function stepProjectile(s,q) {
    if(q.kind==='courtball')return stepBall(s,q);
    if(q.kind==='rollcall'){
      const living=foes(s);
      const target=living.find(e=>e.id===q.lockId&&liveEnemy(e))||nearest(living,q,e=>liveEnemy(e)&&!q.hit.includes(e.id));
      if(target){
        const [dx,dy]=unit(target.x-q.x,target.y-q.y);q.lockId=target.id;
        const [vx,vy]=q.visits? [dx,dy]:unit(q.vx*.72+dx*3.5,q.vy*.72+dy*3.5);
        q.vx=vx*8.4;q.vy=vy*8.4;
      }
    }
    if(q.kind==='slipper'){
      if(q.timer>=34&&!q.returning&&!q.skips){q.returning=true;q.turnTick=q.timer;}
      if(q.returning&&q.timer===q.turnTick+5)q.hit=[];
    }
    if(s.boss?.kind==='captain'&&q.team==='player'&&!q.visual&&q.kind!=='lob'){
      const next={x:q.x+q.vx,y:q.y+q.vy};
      for(const ball of s.shots){
        if(ball.kind!=='courtball'||ball.deflected||ball.life===0)continue;
        if(pointOnSegment(ball,q,next,ball.r+q.r+7)&&returnBall(s,ball,q.owner)){
          if(!q.through)return false;
          break;
        }
      }
    }
    return undefined;
  }

  function ballServe(s,b,p) {
    const existing=s.shots.filter(q=>q.kind==='courtball'&&!q.deflected&&q.life>q.timer);
    if(existing.length>=3)return;
    const [dx,dy]=unit(b.x-p.x,b.y-p.y);
    const x=clamp(p.x+dx*90,LIMIT.left+20,LIMIT.right-20),y=clamp(p.y+dy*90,LIMIT.top+16,LIMIT.bottom-16);
    projectile(s,'courtball','enemy',x,y,-dx*1.22,-dy*1.22,7,{r:11,life:370,deflected:false});
    fx(s,'ring',x,y,'#ffb75c',22);
  }

  function fireFan(s,b,p,count,kind='ticket',speed=3.3) {
    const a=Math.atan2(p.y-b.y,p.x-b.x);
    for(let i=0;i<count;i++){
      const angle=a+(i-(count-1)/2)*.20;
      projectile(s,kind,'enemy',b.x,b.y,Math.cos(angle)*speed,Math.sin(angle)*speed,9,{r:6,life:207,copyWeapon:b.copyWeapon||null});
    }
  }

  function captain(s,b) {
    const p=nearest(s.players,b,livePlayer);if(!p)return;
    if(b.stun>0){
      if(--b.stun===0){b.action='hover';b.timer=0;}
    }else{
      b.timer++;
      const hard=b.hp<b.maxHp*.5;
      if(b.action==='hover'){
        moveTo(b,610+Math.cos(s.roomTick*.014)*150,246+Math.sin(s.roomTick*.018)*69,1.4);
        if(b.round>0&&b.timer===11)ballServe(s,b,p);
        if(b.timer===35)fireFan(s,b,p,hard?5:3);
        if(b.timer>=70){
          b.action='windup';b.timer=0;b.windDir=b.round%2? -1:1;b.round++;
          hazard(s,'crosswind',LIMIT.left,LIMIT.top+24,LIMIT.right-LIMIT.left,LIMIT.bottom-LIMIT.top-52,0,49,84,0,{dx:b.windDir,dy:0});
          caption(s,b.x,b.y-38,b.windDir>0?'顺风球 →':'← 逆风球','#9ff7fe');
          event(s,'windWarn',b.x,b.y,{dir:b.windDir});
        }
      }else if(b.action==='windup'){
        if(b.round>1&&b.timer===16)ballServe(s,b,p);
        if(b.timer>=49){b.action='gust';b.timer=0;}
      }else if(b.action==='gust'){
        if(b.timer===1)ballServe(s,b,p);
        for(const actor of s.players)if(livePlayer(actor)&&actor.y>=LIMIT.top+24&&actor.y<=LIMIT.bottom-28)
          walk(s,actor,b.windDir*(hard?.98:.75),0);
        if(b.timer===29)fireFan(s,b,p,hard?5:3, 'ticket',3.6);
        if(b.timer>=84){b.windDir=0;b.action='hover';b.timer=0;}
      }
    }
    b.hoopX=b.x;b.hoopY=b.y+38;
    const hoop=s.props.find(o=>o.kind==='hoop');
    if(hoop){hoop.x=b.hoopX;hoop.y=b.hoopY;}
  }

  function markTarget(s,b) {
    const party=s.players.filter(livePlayer);if(!party.length)return null;
    const p=party[b.round%party.length];
    b.markId=p.id;b.observeX=p.x;b.observeY=p.y;b.readShot=false;b.readDash=false;b.readSkill=false;
    return p;
  }

  function warnCopy(s,b,p) {
    b.copyHero=p.hero;b.copyWeapon=p.weapon;
    const walked=Math.hypot(p.x-b.observeX,p.y-b.observeY)>22;
    b.copyMove=b.readSkill?'skill':b.readDash?'roll':!b.readShot||(walked&&b.round%2===1)?'roll':'shot';
    b.targetX=p.x;b.targetY=p.y;
    [b.dx,b.dy]=unit(p.x-b.x,p.y-b.y);
    b.action='copyTell';b.timer=0;b.round++;
    const words=b.copyMove==='skill'?'你的技能，我也会！':b.copyMove==='shot'?'我也有这把！':'看我学你冲！';
    caption(s,b.x,b.y-32,words,'#f5caff');
    event(s,'copyWarn',b.x,b.y,{target:p.id,copy:b.copyMove,hero:b.copyHero,weapon:b.copyWeapon});
  }

  function mirror(s,b) {
    let p=s.players.find(actor=>actor.id===b.markId&&livePlayer(actor));
    if(!p)p=markTarget(s,b);
    if(!p)return;
    if(b.stun>0){
      if(--b.stun===0){b.action='observe';b.timer=0;markTarget(s,b);}
      return;
    }
    b.timer++;
    const frenzy=b.hp<b.maxHp*.5;
    if(b.action==='observe'){
      if(b.timer===1)markTarget(s,b);
      const marked=s.players.find(actor=>actor.id===b.markId&&livePlayer(actor))||p;
      const activeEvents=s.events.filter(e=>e.source===marked.id);
      if(activeEvents.some(e=>e.kind==='skill')||marked.action==='bellyRoll')b.readSkill=true;
      if(activeEvents.some(e=>e.kind==='dash')||marked.action==='dash')b.readDash=true;
      if(activeEvents.some(e=>e.kind==='attack')||marked.action==='attack')b.readShot=true;
      // Sidestep slowly while studying the player's last move. Its next line
      // locks before the rush; moving behind a cart creates the opening.
      if(b.timer<30){
        const dir=b.round%2?1:-1;
        moveTo(b,clamp(b.x+dir*24,125,835),clamp(b.y+Math.sin(s.roomTick*.035)*12,143,435),.66);
      }
      if(b.timer>=(frenzy?43:57))warnCopy(s,b,marked);
    }else if(b.action==='copyTell'){
      if(b.timer<(frenzy?35:44))return;
      b.timer=0;b.rushHits=[];
      const rush=b.copyMove==='roll'||(b.copyMove==='skill'&&['iron','nailong'].includes(b.copyHero));
      b.action=rush?'copyRush':'copyVolley';
      if(b.copyMove==='skill'&&b.copyHero==='iron')fireFan(s,b,{x:b.targetX,y:b.targetY},3,'copyShot',4.5);
    }else if(b.action==='copyRush'){
      const speed=frenzy?7.8:7.1;
      const x=clamp(b.x+b.dx*speed,LIMIT.left+19,LIMIT.right-19);
      const y=clamp(b.y+b.dy*speed,LIMIT.top+15,LIMIT.bottom-15);
      const cart=s.props.find(o=>o.kind==='cart'&&distanceToCart(o,x,y,19));
      if(cart){
        cart.flash=42;b.crashes++;
        stun(s,b,110,'撞进餐车！');hitEnemy(s,b,27,p.id);
        fx(s,'ring',b.x,b.y,'#ffda75',32);event(s,'cartCrash',cart.x,cart.y,{target:b.id,source:p.id});s.score+=20;
        return;
      }
      const wall=Math.hypot(x-b.x,y-b.y)<2;
      b.x=x;b.y=y;
      if(s.tick%5===0)fx(s,'dash',b.x,b.y,'#e6a551',10);
      for(const actor of s.players)if(livePlayer(actor)&&!b.rushHits.includes(actor.id)&&distance(b,actor)<33){
        hitPlayer(s,actor,14,b.x,b.y);b.rushHits.push(actor.id);
      }
      if(wall||b.timer>=56){b.action='observe';b.timer=0;}
    }else if(b.action==='copyVolley'){
      if(b.timer===1){
        if(b.copyMove==='skill'){
          const self=b.copyHero==='jianguo';
          hazard(s,'stomp',self?b.x:b.targetX,self?b.y:b.targetY,0,0,self?111:64,25,13,14);
          fx(s,'ring',self?b.x:b.targetX,self?b.y:b.targetY,'#d48fe4',18);
        }else{
          const n=b.copyWeapon==='chalk'?5:b.copyWeapon==='milk'?2:b.copyWeapon==='horn'?5:3;
          fireFan(s,b,{x:b.targetX,y:b.targetY},n,'copyShot',b.copyWeapon==='pulse'?4.5:3.5);
        }
      }
      if(frenzy&&b.timer===25&&b.copyMove==='shot')fireFan(s,b,p,3,'copyShot',3);
      if(b.timer>=46){b.action='observe';b.timer=0;}
    }
  }

  function initBoss(s,b){
    if(b.kind==='captain'){
      Object.assign(b,{action:'hover',timer:0,stun:0,round:0,goals:0,windDir:0,hoopX:b.x,hoopY:b.y+38});
      addProp(s,'hoop',b.hoopX,b.hoopY,19);
      return true;
    }
    if(b.kind==='mirror'){
      Object.assign(b,{action:'observe',timer:0,stun:0,round:0,crashes:0,markId:null,copyMove:'roll',
        targetX:b.x-90,targetY:b.y,rushHits:[]});
      for(const [x,y] of [[412,195],[558,383]])addProp(s,'cart',x,y,20,{w:83,h:31,flash:0});
      markTarget(s,b);
      return true;
    }
    return false;
  }

  function stepBoss(s,b){
    if(b.kind==='captain'){captain(s,b);return true;}
    if(b.kind==='mirror'){mirror(s,b);return true;}
    return false;
  }

  return {shoot,skill,stepPlayer,onHit,projectile:stepProjectile,swat,initBoss,stepBoss};
}
