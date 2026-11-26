import { CHARACTERS } from './engine.mjs';

export const fighters = {
  doubao: { code:'DOUBAO', style:'远程牵制', icon:'message',
    detail:'用对话框占住前方，被逼近时用「撤回重发」后撤并补两发短讯。' },
  jianguo: { code:'JIANGUO', style:'防守反击', icon:'shield',
    detail:'站稳等对手先动，抓住空档，用肩撞或拍桌震地还击。' },
  rocket: { code:'ROCKET', style:'机动布雷', icon:'trap',
    detail:'脚下布雷封路，用改装火箭逼对手跳，再后跳拉开距离。' },
  iron: { code:'IRON MAN', style:'空中压制', icon:'bolt',
    detail:'用推进器改变高度，掌心炮牵制远处，对手靠近就电弧突进。' },
  liangzi: { code:'LIANGZI', style:'贴身压制', icon:'trail',
    detail:'带着大饼卷肉上场，徒步冲坡拉近距离，贴脸甩出胃袋摇。' },
  xujingyu: { code:'XU JINGYU', style:'弹道控场', icon:'hoop',
    detail:'三分球走高弧线，弹地球封低位，再用快嘴解说压住正面。' },
  nailong: { code:'NAILOONG', style:'弹跳突袭', icon:'bounce',
    detail:'贴身靠弹肚，地面打滚追人，腾空后用坐墩抢落点。' }
};
export const fighterIds = Object.keys(fighters);
for (const id of fighterIds) fighters[id].art = id+'-arcade-v2.webp';
export const portrait = char => 'art/' + fighters[char].art;
export const fighterName = char => CHARACTERS[char].name;
