// Frames are counted at 60 Hz. Each active window can hit each opponent once.
// Movement and projectiles are scheduled in simulation time, including hitstop.
const hit=(from,to,damage,base,reach,extra={})=>({from,to,damage,base,reach,...extra});
const fly=(at,vx,vy)=>({at,vx,vy});
const shot=(at,kind,options={})=>({at,kind,...options});
const move=(name,desc,frames,data)=>({name,desc,frames,...data});

export const MOVES={
  doubao:{
    special:move('弹幕回复','发出直线对话框，逼对方跳起或格挡。',20,{shots:[shot(5,'bubble')]}),
    qcf:move('长句生成','蓄出巨型对话球。飞得慢，穿过的空间大，击飞更远。',32,{shots:[shot(10,'orb',{speed:5.9,radius:25,damage:17,base:8,life:100})]}),
    qcb:move('撤回重发','小跳后撤，再连续发送两条短讯。',30,{motion:[fly(1,-8.3,-4.5)],shots:[shot(7,'bubble',{speed:8.7,damage:6,base:2.8}),shot(18,'bubble',{speed:10.5,damage:8,base:5.8})]})
  },
  jianguo:{
    special:move('家长来了','正面架招。有人打就反顶，无人打则主动出肩。',30,{counter:true,motion:[fly(15,9)],hits:[hit(15,21,15,7.8,68)]}),
    qcf:move('护崽肩撞','向前冲肩，擅长抓对手收招。',28,{motion:[fly(5,12.6)],hits:[hit(6,16,17,8.8,63)]}),
    qcb:move('家长拍桌','起身拍地，震波向左右两边推开人群。',36,{motion:[fly(1,0,-5),fly(9,0,9)],landing:'shock',landingPower:16,hits:[hit(8,16,10,5.6,48,{level:'low',omni:true})]})
  },
  rocket:{
    special:move('课间埋伏','抛下感应地雷。短暂布防后，靠近就会爆炸。',20,{shots:[shot(5,'mine')]}),
    qcf:move('改装火箭','发射一枚高速火箭，命中后波及附近斗士。',30,{shots:[shot(7,'rocket',{speed:10.7,damage:14,base:8,radius:10,life:64,blastRadius:71})]}),
    qcb:move('后跳布雷','向后翻跳，在离开的位置铺下两颗不同落点的雷。',32,{motion:[fly(1,-8.8,-8)],shots:[shot(4,'mine',{speed:2}),shot(12,'mine',{speed:6.8})]})
  },
  iron:{
    special:move('悬浮掌心炮','脚底点火悬空，前后打出两道掌心炮。',26,{hover:[5,24],motion:[fly(5,1.2,-5.2)],shots:[shot(5,'beam'),shot(12,'beam')]}),
    qcf:move('电弧突进','喷射前冲并以装甲拳开路，收招补一束近距掌心炮。',30,{motion:[fly(4,12.5,-1.9)],hits:[hit(5,12,10,3.3,53)],shots:[shot(14,'beam',{speed:14,damage:10,base:7.5,life:26})]}),
    qcb:move('垂直升空','推进器垂直升空，用上勾拳挑飞对手，也能用于回场。',29,{motion:[fly(4,3,-13.2)],hits:[hit(4,14,15,6.7,52,{lift:1.45,extraTop:24})]})
  },
  liangzi:{
    special:move('大饼卷肉','挥饼近身打击。命中首名对手后，自己的击飞值减少 6%。',24,{heal:6,hits:[hit(5,11,11,5.1,64)]}),
    qcf:move('徒步冲坡','连续两步前冲，第一步顶住对手，第二步送出边线。',34,{motion:[fly(3,8.8),fly(13,11.2)],hits:[hit(4,8,6,1.9,51,{link:true}),hit(14,20,12,7.9,62)]}),
    qcb:move('胃袋摇','重心一沉，连续两次摇摆，打到身前和身后的对手。',34,{hits:[hit(7,10,6,2.1,56,{omni:true,link:true}),hit(15,20,13,7.8,75,{omni:true})]})
  },
  xujingyu:{
    special:move('弧顶三分','把篮球高高投出，越过低位防守，在平台上弹跳。',25,{shots:[shot(6,'ball',{speed:6.3,vy:-7.8,gravity:0.32,bounces:2,damage:11,base:6.2,life:125})]}),
    qcf:move('快嘴解说','连发三圈声浪，最后一圈冲击最强。',34,{shots:[shot(5,'disc',{damage:4,base:1.8}),shot(12,'disc',{damage:4,base:2.2}),shot(19,'disc',{damage:8,base:6.2,radius:16})]}),
    qcb:move('落地反弹','后撤一步向地面击出篮球，球反弹至高处拦截跳跃。',28,{motion:[fly(2,-5)],shots:[shot(5,'ball',{speed:7.4,vy:7.7,gravity:0.38,bounces:3,bounceSpeed:10.8,damage:13,base:6.7,life:155})]})
  },
  nailong:{
    special:move('肚皮弹弹','弹起圆肚向前顶，把对手挑离地面。',25,{motion:[fly(4,5.3,-5)],hits:[hit(4,14,12,6.3,65,{lift:1.15})]}),
    qcf:move('滚滚冲撞','缩成一团贴地翻滚，多段接触后将对手击飞。',34,{motion:[fly(3,9.6),fly(10,9.2),fly(17,10)],hits:[hit(4,7,4,1.8,53,{link:true}),hit(11,14,4,1.8,55,{link:true}),hit(18,22,10,7.9,60)]}),
    qcb:move('落地坐墩','跃起后重重坐下，落地激起双向弹力波。',39,{motion:[fly(1,1,-8.4),fly(10,0,14.4)],landing:'shock',landingPower:19,hits:[hit(10,22,13,7.1,52,{omni:true,level:'low'})]})
  }
};

export const NORMALS={
  jab:{name:'轻击',frames:15,start:3,active:4,damage:-1,base:2.4,reach:0,link:true},
  follow:{name:'追打',frames:16,start:3,active:4,damage:0,base:3,reach:5,link:true},
  finisher:{name:'连段终结',frames:25,start:5,active:5,damage:4,base:8.1,reach:13},
  heavy:{name:'踏步重击',frames:28,start:7,active:5,damage:5,base:8.6,reach:15},
  sweep:{name:'下段扫击',frames:23,start:5,active:4,damage:1,base:6.6,reach:12,level:'low'},
  air:{name:'跳入飞击',frames:22,start:4,active:6,damage:2,base:6.5,reach:10,level:'air'}
};

// Each fighter has a signature normal in addition to their three specials.
export const SIGNATURE_NORMALS={
  doubao:{key:'jab',name:'快问',desc:'轻击第 2 帧出手，适合抢先点中对手。',start:2,reach:4},
  jianguo:{key:'heavy',name:'托肩挑飞',desc:'前重击上挑力度更大，适合把对手打离平台。',lift:1.45},
  rocket:{key:'follow',name:'枪托快敲',desc:'第二下轻击启动快，枪托向前探一段。',start:2,reach:13},
  iron:{key:'heavy',name:'推进踏拳',desc:'前重击靠推进器多滑一步，能打到更远的位置。',lunge:7.2,reach:9},
  liangzi:{key:'sweep',name:'摆身扫堂',desc:'下普攻横扫两侧，能捉身后绕过来的对手。',omni:true,reach:13},
  xujingyu:{key:'jab',name:'递麦点刺',desc:'递麦轻击的判定更长，能从拳头外沿试探。',reach:17},
  nailong:{key:'air',name:'弹肚扑击',desc:'空中普攻命中后自己向上弹起，可调整落点。',rebound:7.5}
};
