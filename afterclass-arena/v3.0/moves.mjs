// All times are simulation frames. One contact per target per hit window.
const hit = (from,to,damage,base,reach,extra={}) => ({from,to,damage,base,reach,...extra});
const fly = (at,vx,vy) => ({at,vx,vy});
const shot = (at,kind,options={}) => ({at,kind,...options});
const move = (name,desc,frames,pose,data,cost=0) => ({name,desc,frames,pose,cost,...data});
const stamp = (at,options={}) => shot(at,'disc',{skin:'stamp',speed:7.4,radius:14,damage:11,base:5.7,...options});
const wrap = (at,options={}) => shot(at,'disc',{skin:'wrap',speed:8.5,radius:12,damage:9,base:5.3,...options});
const milk = (at,options={}) => shot(at,'bubble',{skin:'milk',speed:6.7,radius:14,damage:10,base:5.4,...options});
const launch = (from,to,damage,reach,lift=1.35) => hit(from,to,damage,5.8,reach,{lift,extraTop:36});
const low = (from,to,damage,base,reach,extra={}) => hit(from,to,damage,base,reach,{level:'low',...extra});
const shell = (at,options={}) => shot(at,'rocket',{speed:10.7,damage:12,base:6.2,blastRadius:54,...options});
const ray = (at,options={}) => shot(at,'beam',{speed:15,damage:9,base:5.2,...options});
const reply = (at,options={}) => shot(at,'bubble',options);
const voice = (at,options={}) => shot(at,'disc',{speed:10,damage:5,base:2,link:true,...options});
const ball = (at,options={}) => shot(at,'ball',options);
const shock = (at,options={}) => shot(at,'shock',options);
const mine = (at,options={}) => shot(at,'mine',options);

export const ASSIST_PARTNERS={
  doubao:'iron',jianguo:'nailong',rocket:'doubao',iron:'rocket',
  liangzi:'xujingyu',xujingyu:'jianguo',nailong:'liangzi'
};
export const ASSIST_MOVES={
  doubao:move('豆包 · 在线接力','豆包接连送出两条回复，第二条推开对手。',28,'qcf',{shots:[reply(4,{damage:6,base:1.8,link:true}),reply(11,{speed:10,damage:10})]},100),
  jianguo:move('灭建国 · 公章到场','灭建国甩出一枚沉重的大红章，扼住前方路线。',29,'highCast',{shots:[stamp(6,{radius:24,damage:18,base:7.7})]},100),
  rocket:move('火箭 · 外场火力','火箭浣熊入场，平射一枚大范围爆裂弹。',29,'qcf',{shots:[shell(6,{damage:17,blastRadius:80})]},100),
  iron:move('钢铁侠 · 双掌齐射','钢铁侠在身后架起双掌，接连射出两束蓝光。',27,'qcf',{shots:[ray(4,{damage:7,base:1.8,link:true}),ray(11,{damage:12})]},100),
  liangzi:move('良子 · 路上带饭','良子从场边扔出两卷饼，一近一远。',31,'special',{shots:[wrap(5,{speed:9.6,damage:7,base:2,link:true}),wrap(14,{speed:8,damage:11})]},100),
  xujingyu:move('徐静雨 · 场边连麦','徐静雨掏出话筒，向前喊出三圈渐强的声波。',30,'qcf',{shots:[voice(3,{damage:4}),voice(9,{damage:4}),voice(15,{damage:9,base:6,link:false,radius:16})]},100),
  nailong:move('奶龙 · 奶瓶补给','奶龙拍出一枚大号奶泡，缓缓压向对手。',29,'special',{shots:[milk(6,{radius:23,speed:5.3,damage:17,base:7.2})]},100)
};
export const MOVES={
  doubao:{
    upAttack:move('上滑发送','托起浮空的对话框，把贴脸对手挑起。',22,'launcher',{hits:[launch(4,9,10,64,1.35)]}),
    downAttack:move('回车确认','蹲下横推出手，再用一条短讯封住退路。',23,'lowCast',{hits:[low(3,7,6,1.7,54,{link:true})],shots:[reply(9,{life:12,speed:8,damage:6,base:4})]}),
    special:move('弹幕回复','沿身前直线发出对话框。',20,'special',{shots:[reply(4)]}),
    upSkill:move('长句生成','生成一颗大号对话球，沿斜上方缓慢飞行。',27,'highCast',{shots:[shot(7,'orb',{speed:6,vy:-3.3,damage:14,radius:20})]}),
    downSkill:move('撤回重发','小跳后撤，连续补发两条消息。',30,'qcb',{motion:[fly(1,-6,-3)],shots:[reply(6,{damage:5,base:2,link:true}),reply(13,{speed:10,damage:7})]}),
    airSkill:move('空投回复','悬停片刻，向斜下方发送回复。',22,'airCast',{hover:[2,10],shots:[reply(4,{speed:9,vy:5,damage:11})]}),
    super:move('秒回连麦','三条回复前后衔接，末条扩大并收尾。',35,'qcf',{shots:[reply(3,{damage:6,base:2,link:true}),reply(8,{damage:6,base:2,link:true}),shot(14,'orb',{speed:9,radius:18,damage:12})]},100),
    upSuper:move('云端检索','两枚对话球沿不同仰角上行，截住空中对手。',32,'highCast',{shots:[shot(4,'orb',{speed:8,vy:-2,damage:11,base:3,link:true}),shot(10,'orb',{speed:6,vy:-5,radius:26,damage:16})]},100),
    downSuper:move('深度思考','短讯限制走位，巨型答案球压轴。',47,'overhead',{shots:[reply(4,{damage:7,base:1,link:true}),reply(9,{damage:7,base:1,link:true}),reply(14,{damage:7,base:1,link:true}),shot(21,'orb',{speed:8.3,radius:34,damage:25,base:9.5})]},300),
    airSuper:move('云端群发','悬空向前下方铺开三条不同角度的消息。',31,'airCast',{hover:[1,22],shots:[reply(4,{vy:1,damage:9}),reply(6,{vy:4,damage:10}),reply(8,{vy:8,damage:13})]},100)
  },
  jianguo:{
    upAttack:move('托肩举高','沉肩上挑，贴身时能将对手托起。',25,'launcher',{motion:[fly(3,3)],hits:[launch(5,11,13,62,1.6)]}),
    downAttack:move('家长来了','架住正面攻击后立刻反顶，无人出手则向前撞肩。',29,'special',{counter:true,motion:[fly(15,7.5)],hits:[hit(15,20,14,7.2,64)]}),
    special:move('盖章通过','平扔一枚红章，飞行较慢，判定较宽。',24,'special',{shots:[stamp(6)]}),
    upSkill:move('公章上交','扬手甩出红章，沿斜上方截击。',26,'highCast',{shots:[stamp(6,{speed:7,vy:-4,radius:18,damage:13})]}),
    downSkill:move('家长拍桌','双手锤地，落地时向两侧震出地波。',32,'qcb',{motion:[fly(1,0,-4.5),fly(8,0,11)],landing:'shock',landingPower:13,hits:[low(8,15,8,4,52,{omni:true})]}),
    airSkill:move('落款重盖','向斜下方盖章，自己稍稍后仰。',22,'airCast',{motion:[fly(2,-2,-1)],shots:[stamp(4,{speed:6.5,vy:7.5,damage:15})]}),
    super:move('护崽开道','连续两步冲肩，后一步击退正面人群。',32,'qcf',{motion:[fly(2,9),fly(11,11)],hits:[hit(3,8,9,2,68,{link:true}),hit(11,18,17,7.8,75)]},100),
    upSuper:move('举高再盖','肩上挑起对手，再把一枚斜飞的大章送上去。',31,'launcher',{hits:[launch(3,8,12,66,1.05)],shots:[stamp(9,{speed:7,vy:-4,damage:15,radius:20})]},100),
    downSuper:move('家长会开幕','重拳震地，两边扬起地波，面前再补一枚巨章。',45,'qcb',{motion:[fly(2,0,-6),fly(10,0,15)],landing:'shock',landingPower:21,hits:[low(10,18,14,3,78,{link:true,omni:true})],shots:[stamp(17,{speed:8,radius:30,damage:25,base:9})]},300),
    airSuper:move('全体坐下','空中急坠，坐实后向两边激发冲击波。',38,'overhead',{motion:[fly(2,2,15)],landing:'shock',landingPower:19,hits:[low(3,18,15,7,74,{omni:true})]},100)
  },
  rocket:{
    upAttack:move('枪托挑颚','反握枪托上撩，启动快，适合接在轻击后。',20,'launcher',{hits:[launch(3,8,9,63,1.35)]}),
    downAttack:move('贴地拆件','低姿态横敲枪托，借后坐力稍稍后滑。',20,'lowCast',{hits:[low(3,7,10,5,70)],motion:[fly(6,-2.8)]}),
    special:move('改装火箭','直射一枚命中后会溅射的火箭。',26,'qcf',{shots:[shell(5)]}),
    upSkill:move('对空试射','抬高炮口，向斜上方打出高速火箭。',24,'highCast',{shots:[shell(5,{speed:9,vy:-4.4,blastRadius:65})]}),
    downSkill:move('课间埋伏','在前方布设感应雷，敌人靠近时引爆。',22,'qcb',{shots:[mine(4,{speed:3.4})]}),
    airSkill:move('空抛零件','从空中向前掷出感应雷，封住地面落点。',23,'airCast',{shots:[mine(3,{speed:4.7,vy:3,gravity:.48})]}),
    super:move('改装三连发','短间隔齐射三枚火箭，第三枚爆风最大。',34,'qcf',{shots:[shell(3,{damage:7,base:2,link:true}),shell(8,{damage:7,base:2,link:true}),shell(13,{damage:13,blastRadius:77})]},100),
    upSuper:move('防空礼炮','一枚低角度和一枚高角度的火箭依次升空。',31,'highCast',{shots:[shell(4,{speed:10,vy:-2.5,damage:13}),shell(9,{speed:8,vy:-6,damage:16})]},100),
    downSuper:move('全场拆迁','先发低空重炮，再散布两颗不同射程的地雷。',43,'overhead',{shots:[shell(4,{damage:24,radius:16,blastRadius:98}),mine(6,{speed:4,damage:16}),mine(12,{speed:9,damage:19})]},300),
    airSuper:move('空中清仓','悬空片刻，沿三个俯角投射爆裂弹。',31,'airCast',{hover:[2,19],shots:[shell(4,{speed:11,vy:2,damage:11}),shell(7,{speed:8,vy:5,damage:12}),shell(10,{speed:5,vy:8,damage:13})]},100)
  },
  iron:{
    upAttack:move('点火上勾','推进器点火，提膝起身打出装甲上勾拳。',24,'qcb',{motion:[fly(3,2.8,-5.5)],hits:[launch(3,10,12,62,1.5)]}),
    downAttack:move('低位掌震','蹲身短冲，用手掌近距离震开敌人。',22,'lowCast',{motion:[fly(2,4.5)],hits:[low(4,10,12,5.8,68)]}),
    special:move('掌心炮','举起手掌，平射一束高速蓝光。',18,'special',{shots:[ray(3)]}),
    upSkill:move('垂直升空','推进器升空，装甲拳一路上挑。',28,'qcb',{motion:[fly(3,2.8,-12)],hits:[launch(4,15,14,56,1.55)]}),
    downSkill:move('电弧突进','水平推进撞击，再补一发短距掌心炮。',28,'qcf',{motion:[fly(3,10,-1.4)],hits:[hit(4,10,7,2,56,{link:true})],shots:[ray(11,{life:16,damage:8})]}),
    airSkill:move('悬浮掌心炮','悬空向前射出两束掌心炮。',24,'special',{hover:[1,17],shots:[ray(3,{damage:6,base:2,link:true}),ray(10,{damage:8})]}),
    super:move('胸口集束炮','反应堆将能量压成三道直线光束。',34,'qcf',{shots:[ray(4,{radius:12,damage:7,base:1.5,link:true}),ray(8,{radius:13,damage:7,base:1.5,link:true}),ray(13,{radius:17,damage:12,base:7})]},100),
    upSuper:move('升空过载','装甲拳把对手带离地面，在空中补射斜上光束。',33,'qcb',{motion:[fly(2,3,-8)],hits:[launch(3,10,12,64,1.25)],shots:[ray(9,{vy:-3,radius:14,damage:15})]},100),
    downSuper:move('方舟全功率','短距离突入后连射粗光束，最后一束覆盖最大。',44,'qcf',{motion:[fly(2,5.3)],shots:[ray(4,{radius:15,damage:8,base:1,link:true}),ray(8,{radius:17,damage:8,base:1,link:true}),ray(12,{radius:19,damage:8,base:1,link:true}),ray(17,{radius:24,damage:22,base:9.1})]},300),
    airSuper:move('俯冲轰击','悬停并向斜下方连射，角度逐次加深。',32,'airCast',{hover:[1,20],shots:[ray(3,{vy:3,damage:10}),ray(7,{vy:6,damage:12}),ray(11,{vy:9,damage:13})]},100)
  },
  liangzi:{
    upAttack:move('托饼上坡','用卷饼从侧下方挑起对手，自己向前跨步。',24,'launcher',{motion:[fly(3,3.6)],hits:[launch(4,10,11,68,1.4)]}),
    downAttack:move('摆身扫堂','下蹲横扫两侧，能捉住绕到身后的对手。',23,'lowCast',{hits:[low(4,10,11,5.8,68,{omni:true})]}),
    special:move('飞饼打包','向前扔出一卷大饼，直线飞行。',23,'special',{shots:[wrap(5)]}),
    upSkill:move('加餐抛饼','高抛卷饼越过前排，随后下落。',25,'highCast',{shots:[wrap(5,{speed:7,vy:-6,gravity:.27,life:69,damage:12})]}),
    downSkill:move('大饼卷肉','挥饼近身打击，首个命中使良子回复 6 点体力。',24,'qcb',{heal:6,hits:[hit(5,10,12,5.4,65)]}),
    airSkill:move('沿途投喂','从空中斜向下扔出一卷饼。',23,'airCast',{shots:[wrap(4,{speed:8,vy:5.5,damage:12})]}),
    super:move('徒步冲坡','连续两步向前肩撞，末段顶开对手。',32,'qcf',{motion:[fly(2,8.5),fly(10,10.5)],hits:[hit(3,7,9,2,60,{link:true}),hit(11,18,16,7.8,68)]},100),
    upSuper:move('翻山递饼','跨步上挑后，抛出一份大卷饼追击。',31,'launcher',{motion:[fly(2,3)],hits:[launch(3,8,10,69,1.12)],shots:[wrap(8,{speed:8,vy:-3,radius:21,damage:16})]},100),
    downSuper:move('胃袋大回旋','连续三次大幅转身，击打身前身后，命中回复体力。',41,'qcb',{heal:10,hits:[low(4,7,10,1.6,77,{omni:true,link:true}),hit(10,13,11,1.8,86,{omni:true,link:true}),hit(17,23,22,8.7,99,{omni:true})]},300),
    airSuper:move('山路急降','带着卷饼急速踏地，落地迸出双向地波。',36,'overhead',{motion:[fly(2,4.5,12)],landing:'shock',landingPower:17,hits:[hit(3,18,15,6.5,67,{omni:true})]},100)
  },
  xujingyu:{
    upAttack:move('麦克风挑传','伸出长麦克风，从身前下方向上挑起对手。',23,'launcher',{hits:[launch(4,9,10,79,1.4)]}),
    downAttack:move('地板流','压低话筒横敲，再放出一道贴地的低音。',22,'lowCast',{hits:[low(3,6,6,1.6,65,{link:true})],shots:[shock(8,{skin:'sound',speed:7,life:16,damage:6,base:4.6})]}),
    special:move('弧顶三分','把篮球向前投出，球落地后还能反弹。',24,'special',{shots:[ball(5,{speed:7.3,vy:-4.2,gravity:.29,bounces:2,damage:11})]}),
    upSkill:move('抛物线教学','投一记高弧线长球，封住远处落点。',26,'highCast',{shots:[ball(6,{speed:6.4,vy:-8.1,gravity:.32,damage:14})]}),
    downSkill:move('落地反弹','往地板击球，靠反弹截住空中目标。',26,'qcb',{motion:[fly(2,-3.8)],shots:[ball(5,{speed:7.5,vy:7.8,gravity:.38,bounces:3,bounceSpeed:10.5,damage:13})]}),
    airSkill:move('空接扣篮','在空中向斜下方扣球，球落地后弹起。',21,'airCast',{shots:[ball(3,{speed:5.8,vy:8,gravity:.35,bounces:2,bounceSpeed:9,damage:13})]}),
    super:move('快嘴解说','对着话筒连喊三圈声浪，末圈最重。',32,'qcf',{shots:[voice(3,{damage:6}),voice(8,{damage:6}),voice(13,{radius:19,damage:13,base:7,link:false})]},100),
    upSuper:move('压哨高抛','先用声浪上扬，再抛出一颗巨型篮球。',32,'highCast',{shots:[voice(3,{vy:-2,radius:16,damage:9}),ball(7,{speed:8,vy:-5.8,radius:20,damage:18,gravity:.3})]},100),
    downSuper:move('全场开麦','四道不断扩大的音浪平推舞台。',43,'qcf',{shots:[voice(3,{damage:8,radius:13}),voice(7,{damage:8,radius:17}),voice(11,{damage:8,radius:21}),voice(16,{damage:22,base:9,link:false,radius:29})]},300),
    airSuper:move('双球绝杀','从空中前后扣下两球，第二球弹起更高。',32,'airCast',{hover:[1,11],shots:[ball(3,{speed:7,vy:5,damage:12,bounceSpeed:7}),ball(9,{speed:5,vy:9,damage:16,radius:16,bounceSpeed:11})]},100)
  },
  nailong:{
    upAttack:move('弹肚上顶','肚皮向上鼓起，自己也弹离地面。',23,'launcher',{motion:[fly(3,3.1,-4.3)],hits:[launch(4,12,11,66,1.45)]}),
    downAttack:move('贴地滚滚','团起身体短滚一圈，贴地挤开对手。',23,'qcf',{motion:[fly(2,6.6)],hits:[low(4,12,11,5.8,64)]}),
    special:move('奶泡喷喷','吐出一团慢悠悠的大奶泡。',23,'special',{shots:[milk(5)]}),
    upSkill:move('咕嘟冒泡','奶泡向斜上方升起，封住跳跃路线。',25,'highCast',{shots:[milk(5,{speed:5.6,vy:-4.2,radius:19,damage:13})]}),
    downSkill:move('滚滚冲撞','缩成一团贴地翻滚，连续碰撞三次。',30,'qcf',{motion:[fly(2,7.5),fly(8,7.8),fly(14,8.6)],hits:[low(3,6,4,1.6,59,{link:true}),low(9,12,4,1.8,61,{link:true}),low(15,20,9,6.4,65)]}),
    airSkill:move('奶盖落地','在空中往斜下方吐出一大团奶泡。',22,'airCast',{shots:[milk(4,{speed:6,vy:6.8,damage:13,radius:18})]}),
    super:move('爆浆奶盖','先吐一颗小奶泡，再推出巨型慢速奶泡。',31,'special',{shots:[milk(3,{speed:7.4,damage:8,base:2,link:true}),milk(9,{speed:7.2,radius:26,damage:18,base:7.6})]},100),
    upSuper:move('双倍弹簧肚','肚皮连续向上顶两次，第二下跳得更高。',32,'launcher',{motion:[fly(2,4.2,-3),fly(8,2.8,-7)],hits:[hit(3,7,9,2,67,{link:true,extraTop:30}),launch(8,16,17,73,1.6)]},100),
    downSuper:move('超大杯坐墩','高高弹起，再一屁股砸地，把两边同时震开。',42,'qcb',{motion:[fly(1,2,-8.4),fly(10,0,15.8)],landing:'shock',landingPower:25,hits:[low(9,19,23,6.2,84,{omni:true})]},300),
    airSuper:move('流星奶团','从空中向前下方坠落，着地放出弹力波。',36,'qcb',{motion:[fly(2,5.6,13.4)],landing:'shock',landingPower:18,hits:[hit(3,17,15,6.8,69,{omni:true})]},100)
  }
};
for(const [fighter,partner] of Object.entries(ASSIST_PARTNERS))MOVES[fighter].assist=ASSIST_MOVES[partner];

export const NORMALS={
  jab:{name:'轻击',frames:15,start:3,active:4,damage:-1,base:2.4,reach:0,link:true,next:'follow'},
  follow:{name:'追打',frames:16,start:3,active:4,damage:0,base:3,reach:7,link:true,next:'finisher'},
  finisher:{name:'三连收尾',frames:22,start:4,active:5,damage:4,base:7.6,lift:1.3,reach:16,lunge:4.8},
  heavy:{name:'踏步重击',frames:28,start:7,active:5,damage:5,base:8.6,reach:15},
  sweep:{name:'下段扫击',frames:23,start:5,active:4,damage:1,base:6.6,reach:12,level:'low'},
  air:{name:'跳入飞击',frames:16,start:2,active:6,damage:0,base:3.4,reach:14,level:'air',link:true,next:'airFinish'},
  airFinish:{name:'凌空飞踢',frames:22,start:3,active:6,damage:3,base:7.1,reach:19,level:'air'}
};
function normals(jab,follow,finisher,air,airFinish){
  const result={jab,follow,finisher,air,airFinish};
  for(const [key,[name,changes]] of Object.entries(result))result[key]={...NORMALS[key],name,...changes};
  return result;
}
export const FIGHTER_NORMALS={
  doubao:normals(['快问',{start:2,reach:4}],['续写',{start:2,reach:10}],['回车踢',{reach:19,lunge:5.2}],['跳读轻点',{start:2,reach:13}],['翻页飞踢',{reach:22,lift:1.18}]),
  jianguo:normals(['沉肩',{start:4,reach:4,damage:0}],['推掌',{damage:1,reach:10}],['托肩挑飞',{start:5,damage:5,lift:1.45,lunge:3.9}],['压肩',{active:7,damage:1}],['凌空盖印',{start:4,damage:5,base:7.9}]),
  rocket:normals(['快拆',{start:2,reach:3}],['枪托快敲',{start:2,reach:13}],['反手砸枪',{start:3,lunge:4,reach:18}],['飞身踹',{active:7,reach:16}],['甩尾横扫',{omni:true,reach:17}]),
  iron:normals(['钢拳',{reach:6}],['腕甲直击',{damage:1,reach:12}],['推进踏拳',{lunge:7.2,reach:20,lift:1.08}],['空中膝击',{reach:13,damage:1}],['推进飞踢',{reach:24,base:7.6}]),
  liangzi:normals(['起步摆拳',{lunge:2.2,reach:6}],['卷饼横挥',{reach:16}],['翻身送客',{omni:true,reach:19,lunge:4.1}],['越坎踢',{active:7,reach:18}],['下山踏步',{reach:17,damage:4}]),
  xujingyu:normals(['递麦点刺',{reach:17}],['换手连麦',{reach:20}],['撤步挥麦',{reach:27,lunge:1.9}],['空中递麦',{reach:23}],['压哨踢',{reach:24,base:7.4}]),
  nailong:normals(['拍拍爪',{start:3,reach:5}],['摆尾顶肚',{reach:13,damage:1}],['大肚弹射',{start:4,reach:20,lunge:5.7,lift:1.4}],['弹肚扑击',{rebound:6,reach:16}],['双脚蹬蹬',{damage:4,reach:20}])
};
export const SIGNATURE_NORMALS=Object.fromEntries(Object.entries({
  doubao:['jab','轻击第 2 帧出手。'],jianguo:['finisher','第三击用肩把对手挑高。'],rocket:['follow','第二下快速送出枪托。'],
  iron:['finisher','推进拳带一段额外前移。'],liangzi:['finisher','转身卷饼能扫到两边。'],xujingyu:['jab','话筒点刺比拳头摸得远。'],nailong:['air','空中普攻命中后自己弹起。']
}).map(([char,[key,desc]])=>[char,{...FIGHTER_NORMALS[char][key],key,desc}]));

const combo=(name,inputs,detail)=>({name,inputs,detail});
function routes(id,branch){
  const n=FIGHTER_NORMALS[id];
  return [combo(n.finisher.name,['J','J','J'],[n.jab.name,n.follow.name,n.finisher.name].join(' → ')+'。贴身后连续点三下。'),
    branch,combo(n.airFinish.name,['K','J','J'],'贴身起跳，离地立刻点两下攻击。先用'+n.air.name+'命中，再接'+n.airFinish.name+'。')];
}
export const BASIC_COMBOS={
  doubao:routes('doubao',combo('短讯追答',['J','J','S+J'],'快问、续写命中后按住 S 点 J，低位回车接上短讯。')),
  jianguo:routes('jianguo',combo('沉肩抛高',['J','J','W+J'],'前两掌留住对手，再按住 W 点 J，用肩把人抬起。')),
  rocket:routes('rocket',combo('拆件发射',['J','J','U'],'枪托第二下打中就点 U，近距离用改装火箭收尾。')),
  iron:routes('iron',combo('钢拳点火',['J','J','W+J'],'腕甲击中后接 W 加 J，点火上勾带自己和对手一起升空。')),
  liangzi:routes('liangzi',combo('走步扫堂',['J','J','S+J'],'沿地面跨步接两次横挥，最后蹲下扫身前身后。')),
  xujingyu:routes('xujingyu',combo('连麦低音',['J','J','S+J'],'递麦、换手后打地板流，低音贴地追出一段。')),
  nailong:routes('nailong',combo('奶团三滚',['J','J','S+U'],'两次拍击命中就按住 S 点 U，缩成球向前连续碰撞。'))
};
