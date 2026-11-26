import { CHARACTERS } from './engine.mjs';

import { PLAYBOOKS } from './playbooks.mjs';

export const fighters = {
  doubao:{code:'DOUBAO',icon:'message'}, jianguo:{code:'JIANGUO',icon:'shield'},
  rocket:{code:'ROCKET',icon:'trap'}, iron:{code:'IRON MAN',icon:'bolt'},
  liangzi:{code:'LIANGZI',icon:'trail'}, xujingyu:{code:'XU JINGYU',icon:'hoop'},
  nailong:{code:'NAILOONG',icon:'bounce'}
};
export const fighterIds = Object.keys(fighters);
for (const id of fighterIds) Object.assign(fighters[id], {art:id+'-arcade-v2.webp',style:PLAYBOOKS[id].style,detail:PLAYBOOKS[id].plan});
export const portrait = char => 'art/' + fighters[char].art;
export const fighterName = char => CHARACTERS[char].name;
