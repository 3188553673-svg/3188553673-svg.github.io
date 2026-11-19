export const STAGES = [
  {id:'steel',name:'体育馆下层',boss:'钢胆侠',tip:'在岔路搜装备，前往直播擂台。'},
  {id:'thanos',name:'深夜操场',boss:'跑早操的灭霸',tip:'穿过储物间，追上跑操队。'},
  {id:'captain',name:'空中球场',boss:'直升机机长',tip:'登上球场高台，寻找机长。'},
  {id:'mirror',name:'午夜食堂',boss:'冒牌奶龙',tip:'走进镜面窗口，找出冒牌奶龙。'}
];
export const TALENTS = [
  {id:'double',name:'压哨二投',detail:'闪避后的下一次普攻额外射出两颗斜向小球。'},
  {id:'rebound',name:'弹性包边',detail:'直线弹在墙面多反弹一次，反弹后伤害提高。'},
  {id:'shell',name:'备用护甲',detail:'护盾上限增加 12 点，护盾提前开始回复。'},
  {id:'magnet',name:'磁力校徽',detail:'扩大资源吸附范围，每次拾取金币额外回复能量。'},
  {id:'glove',name:'连麦手套',detail:'闪避时反弹身边的一发敌弹，并击退身边小怪。'},
  {id:'rhythm',name:'节拍器',detail:'普攻间隔缩短，角色技能更快冷却。'}
];
export const GATES={
  n:{x:480,y:107,dx:0,dy:-1,reverse:'s'},e:{x:911,y:294,dx:1,dy:0,reverse:'w'},
  s:{x:480,y:482,dx:0,dy:1,reverse:'n'},w:{x:49,y:294,dx:-1,dy:0,reverse:'e'}
};
const KEYS=Object.keys(GATES);
export function seeded(seed){
  let v=seed>>>0;return ()=>{v=(Math.imul(v,1664525)+1013904223)>>>0;return v/4294967296;};
}
function shuffled(arr,rng){
  const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
const titles={
  start:['器材营地','发车广场','临时集合点'],combat:['看台走廊','器材仓库','检票通道','喇叭工坊','折叠椅阵地'],
  elite:['精英更衣室','精英值班室','领跑训练区'],treasure:['失物招领','奖品储藏室','冠军宝箱'],shop:['地下小卖部','补给售货亭','夜班小卖部']
};
// Grow connected, non-overlapping rooms on a grid. Main combat rooms precede
// the boss; shop and treasure wings always exist, even in the smallest layout.
export function makeFloor(runSeed,floor){
  const rng=seeded((runSeed^Math.imul(floor,0x9e3779b9))>>>0),rooms=[],occupied=new Map();
  const coord=(x,y)=>x+','+y;
  const newRoom=(gx,gy,type)=>{
    const i=rooms.length,room={id:'F'+floor+'R'+i,gx,gy,type,seed:Math.floor(rng()*4294967296),links:{},visited:false,cleared:false,
      name:type==='boss'?STAGES[floor-1].boss:titles[type][Math.floor(rng()*titles[type].length)]};
    rooms.push(room);occupied.set(coord(gx,gy),room);return room;
  };
  const root=newRoom(0,0,'start');
  const link=(a,b,dir)=>{a.links[dir]=b.id;b.links[GATES[dir].reverse]=a.id;};
  const grow=(anchors,type)=>{
    for(const from of anchors){
      for(const dir of shuffled(KEYS,rng)){
        const d=GATES[dir],x=from.gx+d.dx,y=from.gy+d.dy;
        if(occupied.has(coord(x,y)))continue;
        const node=newRoom(x,y,type);link(from,node,dir);return node;
      }
    }
    throw Error('Dungeon has no free expansion edge');
  };
  const first=grow([root],'combat'),second=grow([first],'combat');
  const tail=rng()<.42?grow([second],'combat'):second;grow([tail],'boss');
  const shop=grow(shuffled([first,root,second],rng),'shop');
  grow(shuffled([root,first,second],rng),'treasure');
  grow(shuffled([second,shop,first,tail],rng),'elite');
  // Where two ordinary wings meet, add a shortcut. Keep the boss a dead end.
  for(const a of rooms){
    if(a.type==='boss')continue;
    for(const dir of ['e','s']){
      const d=GATES[dir],b=occupied.get(coord(a.gx+d.dx,a.gy+d.dy));
      if(b&&b.type!=='boss'&&b.type!=='start'&&a.type!=='start'&&!a.links[dir]&&rng()<.4)link(a,b,dir);
    }
  }
  return {floor,startId:root.id,bossKind:STAGES[floor-1].id,rooms};
}
const footprints=[
  [[339,189,100,42],[633,382,100,42]],[[352,359,58,70],[654,215,58,70]],
  [[289,230,54,44],[665,365,62,46],[505,177,90,32]],[[363,167,76,36],[567,404,78,34],[676,215,56,47]],
  [[311,398,98,33],[564,205,56,66]],[[395,219,70,49],[605,344,68,58]]
];
export function roomCover(room){
  if(!['elite','combat'].includes(room.type))return [];
  const rng=seeded(room.seed);const plan=footprints[Math.floor(rng()*footprints.length)];
  const flip=rng()<.5,style=['crate','bench','shelf'];
  return plan.map(([x,y,w,h],i)=>({x:flip?960-x:x,y:y+Math.round((rng()-.5)*25),w,h,art:style[(room.seed+i)%3]}));
}
export function talentOptions(random){
  return shuffled(TALENTS,random).slice(0,3);
}
