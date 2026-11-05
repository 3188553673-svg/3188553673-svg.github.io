export const MAP = Object.freeze({ minX: -40, maxX: 40, minZ: -8, maxZ: 8,
  spawns: [{ x: -34, z: 0 }, { x: 34, z: 0 }],
  bushes: [{ x: -10, z: -6, radius: 2.8 }, { x: 10, z: 6, radius: 2.8 }] });

const skill = (name, description, cooldown, cost, range, shape) => ({ name, description, cooldown, cost, range, shape });
export const CHAMPIONS = {
  garen: { id: 'garen', name: '盖伦', title: '德玛西亚之力', role: '战士', color: '#d3b56c', description: '坚韧的近战战士，以沉默、旋转和斩杀结束战斗。',
    stats: { hp: 880, mana: 0, ad: 65, ap: 0, armor: 34, speed: 7, attackRange: 2.5, attackInterval: 1.05 },
    skills: {
      q: skill('致命打击', '加速3秒，下一次普攻额外造成70+0.4攻击力物理伤害，并沉默目标1.2秒。', 8, 0, 3, 'self'),
      w: skill('勇气', '获得180+每级20护盾，持续3秒；期间减少25%所受伤害。', 14, 0, 0, 'self'),
      e: skill('审判', '旋转3秒，每0.5秒对周围4.2范围敌人造成24+0.22攻击力物理伤害。', 10, 0, 4.2, 'circle'),
      r: skill('德玛西亚正义', '对5.5范围内敌方英雄造成160+其已损生命30%的真实伤害。6级解锁。', 45, 0, 5.5, 'target') } },
  ashe: { id: 'ashe', name: '艾希', title: '寒冰射手', role: '射手', color: '#75cbe9', description: '远程持续输出，冰霜减速和魔法水晶箭掌控距离。',
    stats: { hp: 680, mana: 340, ad: 60, ap: 0, armor: 24, speed: 6.7, attackRange: 9.5, attackInterval: 1.1 },
    skills: {
      q: skill('射手的专注', '获得5秒攻速提升，普攻额外造成15物理伤害；寒冰普攻使敌人减速。', 10, 40, 0, 'self'),
      w: skill('万箭齐发', '朝指针方向发射7支锥形冰箭，造成85+0.5攻击力物理伤害并减速。', 9, 55, 17, 'cone'),
      e: skill('鹰击长空', '鹰灵侦察全路草丛5秒，使其中敌方英雄暴露。', 18, 0, 80, 'line'),
      r: skill('魔法水晶箭', '发射大型冰箭，对命中的敌方英雄造成210魔法伤害并眩晕2秒。6级解锁。', 45, 100, 80, 'line') } },
  lux: { id: 'lux', name: '拉克丝', title: '光辉女郎', role: '法师', color: '#e2cf8e', description: '光之法师，用束缚和远程爆发捕捉对手的走位。',
    stats: { hp: 660, mana: 440, ad: 51, ap: 0, armor: 22, speed: 6.6, attackRange: 8.5, attackInterval: 1.2 },
    skills: {
      q: skill('光之束缚', '光球最多穿透两个敌人，造成110+0.7法强魔法伤害并禁锢1.5秒。', 10, 50, 19, 'line'),
      w: skill('曲光屏障', '获得160+0.45法强护盾，持续3秒。', 13, 45, 0, 'self'),
      e: skill('透光奇点', '在指针处制造光区，减速其中敌人；1.4秒后爆炸造成125+0.7法强魔法伤害。', 10, 65, 16, 'circle'),
      r: skill('终极闪光', '短暂蓄力后，向指针方向发射宽光束，造成280+0.9法强魔法伤害。6级解锁。', 40, 100, 42, 'line') } },
  yi: { id: 'yi', name: '易大师', title: '无极剑圣', role: '刺客', color: '#92c985', description: '灵活的近战刺客，借助突进、治疗与高速斩击寻找收割时机。',
    stats: { hp: 750, mana: 310, ad: 68, ap: 0, armor: 28, speed: 7.1, attackRange: 2.6, attackInterval: 0.95 },
    skills: {
      q: skill('阿尔法突袭', '瞬身斩击10范围内的敌人，造成115+0.8攻击力物理伤害，并短暂无敌0.35秒。', 12, 55, 10, 'target'),
      w: skill('冥想', '停止行动治疗3秒，每秒回复最大生命8%，期间减少40%所受伤害；移动取消。', 18, 45, 0, 'self'),
      e: skill('无极剑道', '5秒内普攻额外造成28+0.18攻击力真实伤害。', 13, 0, 0, 'self'),
      r: skill('高原血统', '8秒内大幅提升攻速和移动速度，免疫减速。6级解锁。', 45, 100, 0, 'self') } }
};

export const ITEMS = [
  { id: 'blade', name: '长剑', cost: 350, description: '+15 攻击力', stats: { ad: 15 } },
  { id: 'tome', name: '增幅典籍', cost: 350, description: '+25 法术强度', stats: { ap: 25 } },
  { id: 'ruby', name: '红水晶', cost: 400, description: '+200 最大生命', stats: { hp: 200 } },
  { id: 'armor', name: '布甲', cost: 350, description: '+25 护甲', stats: { armor: 25 } },
  { id: 'boots', name: '轻灵之靴', cost: 500, description: '+1.3 移动速度（仅一双）', stats: { speed: 1.3 } },
  { id: 'bow', name: '反曲之弓', cost: 650, description: '+25% 攻击速度', stats: { attackSpeed: 0.25 } },
  { id: 'greatsword', name: '风暴之刃', cost: 1400, description: '+60 攻击力', stats: { ad: 60 } },
  { id: 'staff', name: '辉光法杖', cost: 1400, description: '+100 法术强度', stats: { ap: 100 } }
];

export const SUMMONERS = {
  d: { name: '闪现', description: '朝指针方向闪现最多9单位。', cooldown: 45, range: 9, cost: 0 },
  f: { name: '治疗', description: '回复220+每级30生命，并短暂加速。', cooldown: 40, range: 0, cost: 0 }
};
