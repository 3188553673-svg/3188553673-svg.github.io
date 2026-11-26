// Each route describes a decision the fighter can make with the six already-mapped buttons.
export const PLAYBOOKS = {
  doubao: {
    style:'书签换位', name:'标记绕背', route:['U','S+U'],
    plan:'先用短讯命中，给对手挂上书签。再按防御加远攻，跳到对手背后补一击。',
    choice:'想守住距离，可以用上加远攻在标记处留下延迟回声，或用必杀引爆书签。',
    counter:'短讯被格挡时挂不上书签。看到标记后要留意背后。'
  },
  jianguo: {
    style:'架招落印', name:'接招盖章', route:['S+U','U'],
    plan:'等对手出手，按防御加远攻架住正面攻击。拿到印章后点远攻，在对手脚下盖印。',
    choice:'对手还在身前时，可以把印章留给必杀，近身追打。训练时先打开「木桩还手」。',
    counter:'等架招动作结束再打，或绕到背面。地面的落印预告出现后还能走开。'
  },
  rocket: {
    style:'遥控布雷', name:'埋雷引爆', route:['S+U','S+U'],
    plan:'第一次按防御加远攻埋雷，等对手走近再按一次引爆。空中远攻可以往前补雷。',
    choice:'想封住一片地面，可以用火箭穿过雷区点火，也可以用必杀引爆已布下的雷。',
    counter:'看见雷开始闪就离开爆炸范围。'
  },
  iron: {
    style:'悬停突击', name:'升空俯冲', route:['W+U','S+U'],
    plan:'按上加远攻升空悬停。调整位置，再按防御加远攻收起推进器向下突击。',
    choice:'悬停时左右平移，上下调整高度。点远攻从空中射击，或花一格怒气用必杀扫地。',
    counter:'往他身下走可以躲开斜射；他开始俯冲时，闪开落点。'
  },
  liangzi: {
    style:'徒步抓投', name:'攒劲扛人', route:['A/D','S+U'],
    plan:'在地面走动积攒脚程。贴身按防御加远攻抓人；攒够脚程后能把对手扛走再摔。',
    choice:'普通抓投也能破防。可以提前出手，或先走位再把对手运到墙边。',
    counter:'起跳或拉开身位能躲过抓投。'
  },
  xujingyu: {
    style:'篮板空接', name:'接球扣篮', route:['U','W+U'],
    plan:'点远攻投篮，留在出手处接回球，再按上加远攻跃起扣篮。',
    choice:'接球后也可以再点远攻快速出手。两条路线的起手相同，终点由你选。',
    counter:'注意回球的位置，别让徐静雨舒服地接到球。'
  },
  nailong: {
    style:'弹跳坐墩', name:'滚跳坐墩', route:['S+U','K','J'],
    plan:'按防御加远攻滚起来，在滚动中按跳，再按普攻坐墩。',
    choice:'低处按普攻落得快。等弹得更高再砸，能打到更远的对手。',
    counter:'看到奶龙收身下坠就离开落点。'
  }
};

// Short labels occupy the same HUD space for both local and network snapshots.
export function signatureLabel(player,tick){
  const v=player.signature;
  if(!v || player.hp===0)return '';
  switch(player.char){
    case 'doubao': return v.echoAt>tick?'回声将至':v.markUntil>tick&&v.markTarget?'书签就绪':'';
    case 'rocket': return v.fuseAt>tick?'引爆倒数':v.mineCount?'已布雷 ×'+v.mineCount:'';
    case 'iron': return v.hoverUntil>tick?'悬停 '+Math.ceil((v.hoverUntil-tick)/6)/10+'s':'';
    case 'jianguo': return v.stampAt>tick?'落印将至':v.seal?'持印':'';
    case 'liangzi': return v.carryTarget?'扛摔中':v.stride>=100?'脚程已满':v.stride>=10?'脚程 '+Math.floor(v.stride/10)*10+'%':'';
    case 'xujingyu': return v.caughtUntil>tick?'已接篮板':v.rebound?'篮板回传':'';
    case 'nailong': return v.slamming?'坐墩下落':v.spring?'弹跳中':'';
    default:return '';
  }
}
