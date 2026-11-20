import { MOVES, NORMALS } from './moves.mjs';
import { applyMovePose, drawNailong, drawEquipment } from './fighter-poses.mjs';
// All seven fighters use the same foot anchor. Each sprite is rasterized once at
// its native pixel resolution, then mirrored and scaled as a single image.
const INK = '#1a1729';
const ATLAS_W = 90;
const ATLAS_H = 69;
const ANCHOR_X = 42;
const ANCHOR_Y = 59;
const frameCache = new Map();

const portraits = {
  liangzi: {
    colors:{"k":"#241c2b","n":"#332936","d":"#473b43","h":"#685157","u":"#986b68","s":"#b97d6b","m":"#da9779","f":"#eeb799","w":"#ffcfaa","e":"#f4dfc4","p":"#a25751","b":"#60423e"},
    rows:[
      '',
      '...............n',
      '..........nnnnnndnnnnn',
      '........nnddhhdhdhdddnn',
      '......nndhhhddddddddddnnn',
      '.....ndhhdddnnnnnnnnnndnn',
      '.....nddnnnnnnnnnnnnnnnnnn',
      '....ndddnnnfffnwwwnwwfnnnn',
      '...nnddnnmffwwwwwwwwwwffskk',
      '...ndnnnmffwwwwwwwwfffffmkk',
      '...nnnnnmfffffwfffffbbbbfsk',
      '..nnnnnmfbbbbffffffbffffbmk',
      '..nnnnnmbmfffbbmmwffnnnnmmk',
      '..nnnummmnnnnmmmmwmnefkmnmk',
      '..kumummnmemkknmmwmmmmmmmmk',
      '.kkmuuummmmfmmmmswmmmmmmmmsk',
      '.ksuuuufffffffmsssssmmmmmmsk',
      '..suuumfffffmmmbbssbsmmmmmsk',
      '..kksummffmmmmmmmsmmbbbmmsk',
      '...kssumfbmmmmmmbbeeebmmmsk',
      '....kssummbbeeeeeebbbbmmmsk',
      '.....ssmummbbbbbppppmmmssk',
      '.....kksmuummmppbbbmmmssk',
      '......kkssssffmmmffmsssk',
      '........kkksssfffmskkk',
      '..........kkkskkkkkk',
      '..............k'
    ]
  },
  xujingyu: {
    colors:{"k":"#241c2b","n":"#332936","d":"#473b43","h":"#685157","u":"#986b68","s":"#b97d6b","m":"#da9779","f":"#eeb799","w":"#ffcfaa","e":"#f4dfc4","p":"#a25751","b":"#60423e","c":"#76758a","a":"#a9ccce","i":"#48333b"},
    rows:[
      '',
      '..............n',
      '.........nnhhhhhhnnn',
      '.......nnhhddddddddnnn',
      '.....nnndddddddddddhdnnn',
      '.....ndhddnnnnnnnnnnnnnn',
      '....nndddnnnnnnnnnnnnnnnn',
      '....ndnnnmfffnffffnnnnnnn',
      '...nnnnnmffffffffffffffnkk',
      '...nnnnnmfffffffffffbbfskk',
      '...nnnnmfbbbbbffffbbkkkksk',
      '...nnnnkkkkkkkkffkkkfffmkk',
      '...nnnnkcccfmmmkkkafiiimkk',
      '...kkkkkammiiimkwkmimmmmkk',
      '...ufuskmmimmmkmwkmmmmmksk',
      '...uuuukmmmmmmkmwmkkkkkksk',
      '...kuuumkkkkkkmmmwmmmmmmsk',
      '...kuusmffffmmmbmwummmmmk',
      '.....usmmfffffmuuummmmmsk',
      '......ssmfffmmmbbbbbmmms',
      '......ksmmmmmbbmeepmbmsk',
      '.......ksmmmmmmpmmfmmms',
      '........kssmmfffffffmkk',
      '.........kkssmffffmskk',
      '..........kksssssmkk',
      '............kkkkskk',
      '.............k'
    ]
  },

  doubao: {
    colors: {K:'#21191a', n:'#2c211e', d:'#3c2c25', s:'#503b31', h:'#69534a', u:'#8a6354', t:'#b98170', r:'#d19b87', m:'#e7b8a6', f:'#f2cfbc', w:'#f8dfcf', e:'#fff0db', b:'#4b3026', q:'#82594a', p:'#b76e62', l:'#dc9686'},
    rows: [
      '............K...........',
      '........KKKKdddK........',
      '.......KddssddddKK......',
      '.....KKdssddddnndsKK....',
      '....KdhhddddnnnnKdssK...',
      '...KdhddndnnnnnKdddds...',
      '...dhddddnnnndKKddddsK..',
      '..KdhddnnnndKfffrddddd..',
      '.KdhddnnnndmffwwwfddddK.',
      '.KdhddnnnKfwwwwwwwfdddK.',
      '.KhddnnnKfwwwwwwwwwfddK.',
      'KdsddnnKssswwwwwwwfffdK.',
      'KsdndnnsffwswwfffsssfKK.',
      'KsddnndKhKKfffffsfffsKK.',
      'KsddnnKeebeKffffKKKrrKK.',
      'KsddnnKKbbeKfffeebeKrr..',
      'KsddnnKrqqKwwmfmbbeKrmm.',
      'KsddnnKmmfwmmmmwqqKfrmr.',
      'KsddnnKmffwfrrmffmmmrmr.',
      'KdddnnKmffffffffffmmrrm.',
      'KdndnnKrfflpppplfmmt....',
      '.dnnnnKqrffmlllmmmun....',
      '.KKKKKKKsrfwwffmtsKn....',
      '........KdurmmrKKKKn....',
      '................nnnn....'
    ]
  },
  jianguo: {
    colors:{k:INK,g:'#5d586e',h:'#928b9b',i:'#c8b7bd',d:'#5d3672',s:'#864b9b',m:'#b576bd',f:'#d298d0',w:'#f1c6dc',e:'#fff0ae'},
    rows:[
      '.....kkkkkkkkkk.......',
      '...kkghhhhihihhk......',
      '..kghihihiiihihgk.....',
      '.kghhggghhhhhghggk....',
      '.kgggsmmfffffffsgk....',
      'kgggsmmfffmmfffmmk....',
      'kggsmfmffffmfffffk....',
      'kdgsmmdhhihmfmiihkk...',
      'ksdsmmkhihkkmmkhikk...',
      'ksdmmfmewkfmffewkk....',
      '.kdsmmmmmsmmffmsmk....',
      '.kdsmmmfffmsffwsfk....',
      '..kssfmfffmddssmmk....',
      '..kdsmfmmhiihhiifk....',
      '...kdsmshhhgghhhmk....',
      '...kdsmfmfmmmfmmfk....',
      '....ksmdmsmsmsmsmk....',
      '.....kdssmsmsmsmk.....',
      '......kkddsssskk......',
      '........kkkkkk........'
    ]
  },
  rocket: {
    colors:{k:INK,n:'#30272b',d:'#50434a',s:'#79625e',m:'#a68c7b',f:'#cbb5a0',w:'#f1e0c5',p:'#d89386',e:'#ffd054',j:'#fff2de'},
    rows:[
      '..kkk..........kk....',
      '.ksmskk.......ksmk...',
      '.ksfpmkk....kkmpsk...',
      '.ksfpmmk.kkkmsppsk...',
      '..ksfmmskssmmfmssk...',
      '..kdsmmfmmsffmsdkk...',
      '...ksmffffffmmssk....',
      '..kssfwwwmfwwwfmk....',
      '.ksskkknnfmnkkksmk...',
      'kssdddkejndkejknsmk..',
      '.kdssnnnmfffnnnmsk...',
      'kdsfmmsfffwfffmmsk...',
      '.ksfffwwwffnnffwwmk..',
      '..kssmwwwfknnwwwwk...',
      '...kssmfffwmffwfkk...',
      '....kdssmfwwjwfk.....',
      '.....kkdsmfffmk......',
      '.......kkdddkk.......'
    ]
  },
  iron: {
    colors: {k:'#211d25', n:'#30252b', d:'#443237', b:'#59423f', h:'#76594b', g:'#9c7c65', u:'#86676b', c:'#9c726a', t:'#b77f70', r:'#c99278', m:'#dba183', f:'#eab394', a:'#f4c5a8', l:'#f9d5b6', w:'#e7ccae', v:'#bc7969'},
    rows: [
      '...................k........................',
      '...................k...k....k...............',
      '.............k....knkkknkkkknkk.............',
      '.............knkkknnkknnnnnbbbdkkk..........',
      '.............kknkknnbnnddbhhhhbbnbk.........',
      '......k.....kkknnnbbdndbhhbbbbbbdnbbk.......',
      '......kknkkkkngnhhbbddbbbbbbbbbbbnddbk......',
      '......kknnnddbhhbbbbddhbbdddbbbbddndbn......',
      '.....nnnnnndbhbbbbbbdhbbddbbddddbbndnkk.....',
      '...kkkndddgbhbbbbbbdddbbdbddddddddbnddkkk...',
      '....kknnnggbbbbbbbbdddbddddddddddddnddddk...',
      '....knndghhbbbbbbbddddddddddddddddbdddnnn...',
      '...nnndbhhhbbbbddddnnnnnnnnnnnnnnddbbddnn...',
      '..knddddhhhbbbdddnnntttttrrfrrrnnndddbddnk..',
      '...knddhhdbbbdddnttmmmmfffaffffffnddddbddnk.',
      '...knddhbbbbdddnttmffffaaaaaaaaaffnnddbddn..',
      '..knndhbbbddbdntmffaaaaaaaaaaaaaaffnnddbnnn.',
      '..knddbbbdbbdntfffaaaaaaammmmmmaaaffnddbnkk.',
      '.knndbdddbddntfffaaaaaaaaaaaaaammfffnndddnk.',
      '.knnddddbdudrmffaaaaaaaaaaaaaaaaaffffnddddkk',
      '..nnddddbudnrffaarrrrrrafffffffffffffnddddnk',
      '..knnddbudnrfffrrfffffaftftffffffbfffnddddn.',
      '..knndndudnmmttbbbbffffftftffbbdddddbnnddnk.',
      '..knnddudncmbbbbbbddbbmmtmmbbdddbbbbbbnddnk.',
      '...knndudntbbhbbbbbbbrrrfmmbbbmaaaammmbddnk.',
      '...knndddnbhbttrrcrttbrfffmmmacnnnnncmnnnnk.',
      '...kkndddnttttnnnnnnntrfafmmmnnwwkncncnnnnk.',
      '...kknddnutttnnwwknnncmfafmmncwccbbcmmnnnnk.',
      '...kknddnuttnnwwcbbacmmfafmmmcccccttttnnnnk.',
      '....bnndnuccccaccccttmmrafmmmmtttttttftnnkk.',
      '...brannburrrrtttttmmmmrafrmmmmmmtttfttnkk..',
      '...baranburffaaaaffrmmmrfafmmmmmffffftttkk..',
      '...brrcrrcrffaaafrrrmmmrfafmmmmmffffttttttk.',
      '...brcrcrbrffafftttrrmmrfllffmmtftttrtttttk.',
      '...brrcrrbrfrrrtttmmmrcfffflfrtttttrrrtttk..',
      '...brrcrrurrrtttttmmmcddcrfcbcrmmmrrrrrttk..',
      '...bbrrcrrurtttttrmmmdcccccbtmmrrmmrrrrtk...',
      '...kbrrrbccrttttrmmttdddatttdddtmrrmmrrtk...',
      '....bbbrbcrrtttrmmtbbbbdmdhhhhhddmmmmrrkk...',
      '....kktbtbcttttmdbbdddddttddddddddtmmrrk....',
      '......kkkbctttmmdddrrrrvvvvrrrvvdddmmrkk....',
      '.......kkbbcrtmddmrvvmbbbbbbbbbbvdtmrrkk....',
      '.......kkbbbcrmdmbbbbbmmmmmaammmmmmrrtkk....',
      '.......kkbbbrcrrrmmmmmaaaaambmmmmrmbrkk.....',
      '........kkbbbrrrrrmmfbbbbbbdbmmmmmbbtkk.....',
      '........kkbbbbbrrrffffbdddddbmmmrbbbkk......',
      '.........kkbbbbbrrffffbbdddbmmmmbbbtk.......',
      '.........kkkbbccbrrfffbbdddmmmrbdbbkk.......',
      '..........kkkbbdccrfffbdbbbrrhbdbbkk........',
      '...........kkkbdddccbbbdddddddbdbkk.........',
      '............kkktddhhddddddhdbddbkk..........',
      '.............kkkkkddhhddddddddbkk...........',
      '...............kkkkkkddddddkkkk.............',
      '................kkkkkkkkkkkkk...............',
      '......................k.....................'
    ]
  }
};

const bodies = {
  liangzi: {
    colors:{k:INK,g:'#465544',d:'#303c37',m:'#718063',h:'#a8b08a',b:'#322b32',c:'#5e544b',s:'#8b6b4d',l:'#bd9361',t:'#d7a774'},
    rows:[
      '.......kkkcckkk.......','...kkkmhgkbckghkkk....','..kgmghmgbbkggmlmkk...',
      '.kmgmmgggbbkglsmmmk..','.kghgdgggbkglscggmgk.','.kgmgdgggbklssdgghgk.',
      '..kgmgdgklslsbgmmmgk.','..kgmgdklslsbgmgdmgk.','..kgmmklsscbgmgdgmgk.',
      '..kghklsscbggmmggmdk.','..kgksllbbggghggmmdk.','..kggslbccggmmgmmmdk.',
      '..kgggbccbbbcggggmgk.','..kddkssllltssbbdddk.','...kkbsccsssssbkkkk..',
      '....kksllllsssk......','.....kkkkkkkkk.......'
    ]
  },
  xujingyu: {
    colors:{k:INK,d:'#222d40',b:'#33485c',s:'#496478',m:'#738a96',l:'#70bbd1',w:'#b3dce0',c:'#978675'},
    rows:[
      '.....kkccckk.....','...kkmbkcbdmk....','..kbsblbbkblbbk..','.klsbbslbblbbsbk.',
      '.ksbdbbssbbssblk.','.kbdbbsdbbbssbbk.','..kbdbsdbbbbdbk..','..kbsbbdbbbdbbk..',
      '..kbbbsdbbbdbbk..','..kbsbddbbbsbbk..','..kbbsddbbbsbbk..','..kbbdssbbsbbbk..',
      '...kdddkkdddkk...','....kkkkkkkkk....'
    ]
  },

  doubao: {
    colors:{k:INK,b:'#262326',c:'#343133',h:'#484449',s:'#85241e',r:'#ae3327',v:'#cb4632',l:'#e75e42'},
    rows:[
      '......ksssk.....','....kkrrrvskk...','...kssrvvrrvsk..',
      '..ksrrvvrrsvvsk.','.ksrvsvrrssvvsk.','.ksrvrrsvvvlrsk.',
      '.kssrrvvvrrssck.','..kcrvrrrsskbck.','..kbssrrrskbbck.',
      '..kbcbsrskbccck.','..kbbcskbcccbck.','..kbcckbcccbbbk.',
      '..kbccbcccbbbck.','...kbbbcccbbbk..','....kkkkkkkkk...'
    ]
  },
  jianguo: {
    colors:{k:INK,d:'#392440',c:'#5c3d67',h:'#84598b',w:'#e7d8c9',s:'#b6a6ad',f:'#d4bdc0',m:'#956b90',p:'#694a6c'},
    rows:[
      '......kkmkkmkk.......','...kkchwmmpmfwckk....','..kcchcwfmmpwsschkk..',
      '.kcchkcwfffwwscdhhck.','.kchhkcwwwffwschhhck.','.kchckcwsswwssckchck.',
      '..kchkcwwwwwwsckchck.','..kckkswwswsssckchck.','..kchkswwssswwdkchck.',
      '..kchkswwwwwwsdchhd..','..kchkswswwwwsdchck..','..kchkswsswwssdchck..',
      '..kcdksswsswssdchck..','..kcckdccdddddkchck..','..kcdkkkkkffkkkccck..',
      '..kkk...kkkk..kkkk...'
    ]
  },
  rocket: {
    colors:{k:INK,d:'#703c3b',o:'#d86c32',f:'#ffa548',g:'#655950',w:'#d7c69e',m:'#8d7664',e:'#4c5a67',a:'#a2c2b5'},
    rows:[
      '....kmmwwmk....','..kkofkwwkokk..','.koofgdwgafook.',
      '.kofgawgagfook.','.kogggwggofok..','..koggwwgoffok.',
      '..kdofgwwgfgok.','..kofofgwwwgok.','..kdgggggagggk.',
      '..kdgdggggggdk.','...kdooodgoodk.','...kkkkkkkkkk..'
    ]
  },
  iron: {
    colors:{k:INK,d:'#611f38',r:'#bd2b3f',v:'#ef4844',h:'#ff8657',g:'#a85e38',o:'#e4ab55',f:'#ffdc82',b:'#4c8fac',l:'#6fe2f3',w:'#e9fff5'},
    rows:[
      '.....kkggggkk......','...krvvvrrvvvkk....','..krhhvvvvvhvvvkk..',
      '.krvvvhrrrvhhhhvrk.','.krrrvvkblkkvvvrk..','..kdrrkblwwlkvrrk..',
      '..kvrvkllwwlkvvrk..','..krrrkkbllbkvrdk..','...kdrvrkbbkrvrk...',
      '...kdrrrvvrrvrrk...','...kdoogrkgrgogk...','...kdrvvvgvvrrok...',
      '...kdgggkrrkgggk...','....kdvvrvvrvvk....','.....krrdrdrrk.....',
      '......kkkkkkk......'
    ]
  }
};

const design = {
  liangzi:{size:1.28,head:[-13,-52],body:[-11,-28],shoulder:[6,-24],hip:[0,-12],arm:['#414c3f','#718369','#a5ae8c'],skin:['#af796a','#d9987c','#f4be96'],leg:['#36333d','#514b53','#7c746c'],boot:['#654d43','#c3956b'],wide:7},
  xujingyu:{size:1.26,head:[-11,-49],body:[-8,-25],shoulder:[5,-21],hip:[0,-12],arm:['#263447','#415767','#71b4c2'],skin:['#b07a6c','#d9987c','#f5c7a1'],leg:['#263447','#42516a','#728699'],boot:['#697281','#d1d0bd'],wide:5},
  nailong:{size:1.30,head:[-10,-39],body:[-9,-23],shoulder:[5,-19],hip:[0,-10],wide:6},
  doubao:{size:1.24,head:[-11,-47],body:[-8,-26],shoulder:[5,-22],hip:[1,-12],arm:['#262427','#3a3739','#575055'],skin:['#b87f70','#e0ad98','#f4cdbc'],leg:['#35333b','#514e55','#716a71'],boot:['#3c393d','#897c77'],wide:5},
  jianguo:{size:1.34,head:[-9,-45],body:[-10,-29],shoulder:[6,-25],hip:[0,-13],arm:['#4c3d50','#5f4d62','#877286'],skin:['#805481','#ac7ca9','#d1a1c3'],leg:['#38374b','#55556a','#79788b'],boot:['#3f343e','#866d62'],wide:8},
  rocket:{size:1.15,head:[-9,-36],body:[-7,-21],shoulder:[4,-19],hip:[0,-11],arm:['#9c4937','#e98039','#ffc16b'],skin:['#665654','#a08670','#dac3a3'],leg:['#704332','#ae6537','#e39249'],boot:['#3a3436','#7c6c62'],wide:5},
  iron:{size:1.36,head:[-10,-53],body:[-9,-28],shoulder:[5,-24],hip:[0,-13],arm:['#9d2f42','#e24b43','#ff8559'],skin:['#a92b41','#e45041','#ffc96c'],leg:['#a95638','#e2a34a','#ffcd70'],boot:['#ad2d41','#ef5849'],wide:6}
};

function rect(ctx,x,y,w,h,color) {
  ctx.fillStyle=color;
  ctx.fillRect(Math.round(x),Math.round(y),w,h);
}
function stamp(ctx,sprite,x,y) {
  const {rows,colors}=sprite;
  rows.forEach((row,dy)=>{
    for(let i=0;i<row.length;) {
      let end=i+1;
      while(end<row.length&&row[end]===row[i]) end++;
      if(colors[row[i]]) rect(ctx,x+i,y+dy,end-i,1,colors[row[i]]);
      i=end;
    }
  });
}
// Build thick limbs from clusters on the native pixel grid. Canvas strokes
// would anti-alias their contours, blurring silhouettes when enlarged.
function segment(ctx,a,b,width,colors) {
  const count=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]),1);
  const paint=(size,col,offset)=>{
    for(let i=0;i<=count;i++) {
      const x=Math.round(a[0]+(b[0]-a[0])*i/count-size/2)+offset;
      const y=Math.round(a[1]+(b[1]-a[1])*i/count-size/2);
      rect(ctx,x+1,y,Math.max(1,size-2),size,col);
      rect(ctx,x,y+1,size,Math.max(1,size-2),col);
    }
  };
  paint(width+2,INK,0);paint(width,colors[0],0);
  paint(Math.max(2,width-2),colors[1],0);
  if(colors[2]) rect(ctx,b[0]-2,b[1]-2,3,1,colors[2]);
}
function hand(ctx,x,y,c,big) {
  const w=big?9:6,h=big?7:5;
  rect(ctx,x-w/2+1,y-h/2-1,w-2,h+2,INK);
  rect(ctx,x-w/2,y-h/2,w,h,INK);
  rect(ctx,x-w/2+1,y-h/2,w-2,h,c[0]);
  rect(ctx,x-w/2+2,y-h/2,w-3,3,c[1]);
  rect(ctx,x-w/2+2,y-h/2,3,1,c[2]);
  rect(ctx,x+1,y,1,2,c[0]);
}
function limb(ctx,a,b,c,wide,upper,lower) {
  segment(ctx,a,b,wide,upper);
  segment(ctx,b,c,Math.max(4,wide-1),lower);
}
function boot(ctx,x,y,colors) {
  rect(ctx,x-3,y-4,6,5,INK);rect(ctx,x-3,y-2,9,3,INK);
  rect(ctx,x-2,y-3,4,3,colors[0]);rect(ctx,x+2,y-2,3,2,colors[1]);
  rect(ctx,x-2,y,7,1,colors[1]);
}
const ring = [[-7,-2],[-3,-1],[2,-2],[6,-4],[9,-7],[6,-5],[2,-3],[-3,-1]];
function poseFor(id,action,frame,jab) {
  const d=design[id];
  const p={dx:0,dy:0,headX:0,headY:0,kneeB:[-7,-6],toeB:[-7,0],
    kneeF:[5,-6],toeF:[7,0],elbowB:[-9,-20],fistB:[-6,-23],
    elbowF:[9,-17],fistF:[12,-23],tail:0};
  if(id==='rocket') { p.elbowB=[-6,-15];p.fistB=[4,-16];p.elbowF=[8,-15];p.fistF=[12,-17]; }
  if(id==='jianguo') {p.toeB=[-9,0];p.toeF=[9,0];p.elbowF=[12,-19];p.fistF=[13,-25];}
  if(action==='idle') {
    p.dy=(frame===1||frame===2)?-1:0;p.headY=frame===2?-1:0;
    p.elbowF[1]+=p.dy;p.fistF[1]+=p.dy;p.tail=frame===2?1:0;
  }
  if(action==='run') {
    const a=ring[frame],b=ring[(frame+4)%8];
    p.dx=2;p.dy=frame%4===1?-2:0;
    p.kneeF=[Math.round(a[0]*0.7)+3,-7+(a[0]<0?-1:-3)];
    p.kneeB=[Math.round(b[0]*0.7)+2,-7+(b[0]<0?-1:-3)];
    p.toeF=[a[0],a[1]+1];p.toeB=[b[0],b[1]+1];
    const swing=Math.round(a[0]*0.7);
    p.elbowF=[5-swing,-16];p.fistF=[10-swing,-19];
    p.elbowB=[-4+swing,-19];p.fistB=[2+swing,-22];p.tail=frame%4-2;
    if(id==='rocket'){p.elbowF=[6,-14];p.fistF=[11,-16];}
  }
  if(action==='jump'||action==='fall') {
    p.dy=-1;p.headY=action==='jump'?-1:0;
    p.kneeF=[8,-10];p.toeF=action==='jump'?[5,-5]:[9,-3];
    p.kneeB=[-6,-6];p.toeB=[-10,-7];
    p.elbowB=[-12,-24];p.fistB=[-12,-28];
    p.elbowF=[10,-20];p.fistF=action==='jump'?[14,-27]:[17,-20];
    p.tail=action==='jump'?-3:3;
  }
  if(action==='attack') {
    const reach=[-1,2,13,12,6,1][frame];
    const height=d.shoulder[1]+(jab?0:-3);
    p.dx=[-2,0,4,4,2,0][frame];p.dy=frame===0?2:0;
    p.headX=frame<2?-1:1;p.kneeF=[9,-6];p.toeF=[12,0];
    p.elbowF=[8+Math.round(reach*0.55),height+3];p.fistF=[11+reach,height];
    p.elbowB=[-9,-18];p.fistB=[-5,-24];
    if(id==='rocket'){p.fistF[1]+=5;p.elbowF[1]+=4;}
  }
  if(action==='skill') {
    const launch=frame>=1&&frame<=4;
    if(id==='doubao'){
      p.dx=launch?2:-1;p.elbowF=[10,-20];p.fistF=launch?[20,-24]:[8,-30];
      p.elbowB=[-9,-21];p.fistB=[-7,-29];p.kneeF=[7,-6];p.toeF=[9,0];
    }else if(id==='rocket'){
      p.dy=launch?4:2;p.headY=1;p.elbowF=[10,-10];p.fistF=[14,-4];p.toeB=[-10,0];
      p.kneeF=[8,-5];p.toeF=[9,0];p.tail=-3;
    }else{
      p.dy=-1;p.elbowF=[15,-23];p.fistF=launch?[22,-24]:[9,-26];
      p.elbowB=[-10,-14];p.fistB=[-12,-11];p.kneeF=[6,-9];p.toeF=[4,-3];
      p.kneeB=[-7,-5];p.toeB=[-8,0];
    }
  }
  if(action==='counter'){
    const burst=frame>=3&&frame<=4;
    p.dy=burst?3:2;p.dx=burst?5:-1;p.headX=2;p.toeB=[-11,0];p.toeF=[11,0];
    p.kneeF=[10,-6];p.elbowF=burst?[14,-20]:[9,-20];p.fistF=burst?[20,-23]:[3,-29];
    p.elbowB=[-6,-18];p.fistB=burst?[4,-25]:[8,-26];
  }
  if(action==='hurt'||action==='ko') {
    p.dx=-3;p.dy=1;p.headX=-2;p.headY=-1;p.kneeF=[5,-8];p.toeF=[9,-2];
    p.kneeB=[-5,-5];p.toeB=[-7,0];p.elbowF=[13,-23];p.fistF=[15,-31];
    p.elbowB=[-11,-22];p.fistB=[-13,-27];p.tail=4;
  }
  if(action==='dodge') {
    p.dx=4;p.dy=6;p.headX=3;p.headY=1;p.kneeF=[12,-5];p.toeF=[11,0];
    p.kneeB=[-9,-4];p.toeB=[-15,-1];p.elbowF=[12,-11];p.fistF=[16,-12];
    p.elbowB=[-8,-18];p.fistB=[-13,-16];p.tail=-4;
  }
  return p;
}
function spark(ctx,x,y,color) {
  rect(ctx,x,y-3,1,7,color);rect(ctx,x-3,y,7,1,color);
  rect(ctx,x-1,y-1,3,3,'#ecfff6');
}
function raccoonTail(ctx,dy) {
  const tail=[
    [[-3,-10],[-9,-11],8,'#927e78'],[[-7,-11],[-12,-13],9,'#554852'],
    [[-11,-13],[-16,-15+dy],9,'#bca88e'],[[-15,-15+dy],[-19,-18+dy],8,'#5c5055'],
    [[-18,-17+dy],[-21,-22+dy],7,'#c4b399'],[[-21,-22+dy],[-22,-24+dy],5,'#534853']
  ];
  // Lay down one continuous silhouette so stripes have no internal ink seams.
  for(const [a,b,w] of tail) segment(ctx,a,b,w,[INK,INK]);
  for(const [a,b,w,c] of tail) {
    const n=Math.max(1,Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
    for(let i=0;i<=n;i++){
      const x=Math.round(a[0]+(b[0]-a[0])*i/n-w/2);
      const y=Math.round(a[1]+(b[1]-a[1])*i/n-w/2);
      rect(ctx,x+1,y,w-2,w,c);rect(ctx,x,y+1,w,w-2,c);
    }
    rect(ctx,b[0]-2,b[1]-Math.floor(w/2),3,1,'#d0b89b');
  }
}
function blaster(ctx,x,y){
  const metal={k:INK,d:'#37424b',m:'#697a85',l:'#b0ced0',g:'#dc944a',o:'#f4bb65',b:'#69d8e7'};
  stamp(ctx,{colors:metal,rows:[
    '..kk..kkkkk......','..kmkkmmmmdkkkkk.','kklmmmmmmlmllmmk.',
    'kggmdgggddmdmmbk.','kggmdoodddmdmmmk.','.kkddddkkkdkkkkk.',
    '...kmdk..........','...kkk...........'
  ]},x,y);
}
const trails={
  doubao:['#2887b0','#a2f4f1'],jianguo:['#a274b4','#ead4ed'],
  rocket:['#c7783e','#ffdb95'],iron:['#e86d5f','#ffde9b'],
  liangzi:['#92966b','#ebd69b'],xujingyu:['#5c92ae','#b8e9e4'],nailong:['#dc903d','#ffe68a']
};
function actionTrail(ctx,id,p,action,frame,move) {
  const [dark,light]=trails[id];
  if(action==='attack'&&(frame===2||frame===3)){
    const [x,y]=move==='follow'?p.fistB:['air','airFinish','sweep'].includes(move)?p.toeF:p.fistF;
    if(move==='finisher'){
      for(let step=0;step<4;step++){
        rect(ctx,x+4-step*2,y+4+step*3,4,2,dark);
        rect(ctx,x+6-step*2,y+2+step*3,3,2,light);
      }
      return;
    }
    if(move==='airFinish'){
      for(let step=0;step<3;step++){
        rect(ctx,x-4+step*3,y-8+step*3,4,2,dark);
        rect(ctx,x-1+step*3,y-9+step*3,3,1,light);
      }
      return;
    }
    const end=id==='rocket'?19:15;
    const advance=frame===2?0:2;
    // These narrowing streaks bridge the character's clenched fist and the
    // tip of the melee hitbox, without covering another fighter's face.
    rect(ctx,x+4+advance,y-3,end-8,1,dark);
    rect(ctx,x+7+advance,y-2,end-8,1,light);
    rect(ctx,x+8+advance,y-1,end-7,1,dark);
    rect(ctx,x+3+advance,y+2,end-7,1,light);
    rect(ctx,x+1+advance,y+3,end-8,1,dark);
  }else if(action==='counter'&&(frame===1||frame===2)){
    rect(ctx,12,-33,2,3,dark);rect(ctx,13,-31,2,3,light);
    rect(ctx,14,-28,2,7,light);rect(ctx,13,-21,2,3,dark);
  }else if(action==='dodge'){
    rect(ctx,-25,-17,13,1,dark);rect(ctx,-21,-15,8,1,light);
    rect(ctx,-28,-11,12,1,dark);
  }
}
function drawFrame(id,action,frame,jab,move) {
  // Tony's unmasked features use half-size pixels; the armor retains its
  // original pixel grid. Other fighters still rasterize at native resolution.
  const resolution=id==='iron'?2:1;
  const width=ATLAS_W*resolution,height=ATLAS_H*resolution;
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),d=design[id],p=poseFor(id,action,frame,jab);
  ctx.scale(resolution,resolution);
  ctx.translate(ANCHOR_X,ANCHOR_Y);
  if(id==='nailong'){drawNailong(ctx,action,move,frame);return canvas;}
  applyMovePose(p,id,move,action,frame);
  const at=(pt)=>[pt[0]+p.dx,pt[1]+p.dy];
  const shoulder=at(d.shoulder),backShoulder=at([-d.shoulder[0],d.shoulder[1]+1]);
  const hip=at(d.hip),backHip=at([d.hip[0]-3,d.hip[1]+1]);
  actionTrail(ctx,id,p,action,frame,move);
  if(id==='rocket') raccoonTail(ctx,p.tail+p.dy);
  limb(ctx,backHip,p.kneeB,p.toeB,d.wide,d.leg,d.leg);boot(ctx,...p.toeB,d.boot);
  limb(ctx,hip,p.kneeF,p.toeF,d.wide,d.leg,d.leg);boot(ctx,...p.toeF,d.boot);
  if(id==='iron'){
    rect(ctx,p.kneeF[0]-1,p.kneeF[1]-1,4,3,'#ea554c');
    rect(ctx,p.kneeF[0],p.kneeF[1]-1,2,1,'#ffc367');
  }
  limb(ctx,backShoulder,p.elbowB,p.fistB,d.wide,d.arm,id==='doubao'?d.arm:d.skin);
  hand(ctx,...p.fistB,d.skin,id==='jianguo');
  stamp(ctx,bodies[id],d.body[0]+p.dx,d.body[1]+p.dy);
  const headX=d.head[0]+p.dx+p.headX, headY=d.head[1]+p.dy+p.headY;
  if(id==='iron'){
    ctx.save();
    ctx.translate(headX,headY);
    ctx.scale(0.5,0.5);
    stamp(ctx,portraits[id],0,0);
    ctx.restore();
  }else{
    stamp(ctx,portraits[id],headX,headY);
  }
  limb(ctx,shoulder,p.elbowF,p.fistF,d.wide,d.arm,id==='doubao'?d.arm:d.skin);
  hand(ctx,...p.fistF,d.skin,id==='jianguo');
  const [fx,fy]=p.fistF;
  drawEquipment(ctx,id,action,move,frame,fx,fy);
  if(id==='rocket'&&(action!=='skill'||move==='qcf')) blaster(ctx,fx-6,fy-7);
  if(id==='doubao'&&action==='skill'){
    rect(ctx,fx+1,fy-9,7,10,INK);rect(ctx,fx+2,fy-8,5,7,'#67def0');
    rect(ctx,fx+3,fy-7,3,2,'#e0fff4');
    if(frame>=1&&frame<=3) spark(ctx,fx+10,fy-7,'#7fe8ef');
  }
  if(id==='iron'){
    rect(ctx,fx-1,fy-2,3,2,'#adf4fb');
    if(action==='skill'&&frame>0&&frame<5){
      spark(ctx,fx+3,fy,'#69e7f4');
      for(const [x,y] of [p.toeF,p.toeB]){
        rect(ctx,x-1,y+2,4,3,'#47b6e0');rect(ctx,x,y+3,2,4,'#a6f5fc');
        rect(ctx,x,y+7,1,2,'#558fd1');
      }
    }
  }
  if(id==='rocket'&&action==='skill'&&move!=='qcf'&&frame<2) {
    rect(ctx,fx-2,fy-2,9,4,INK);rect(ctx,fx-1,fy-3,7,3,'#82909b');
    rect(ctx,fx+1,fy-4,2,2,'#ffd57b');
  }
  return canvas;
}

function frameFor(action,t,char,move) {
  if(action==='idle') return Math.floor(t/11)%4;
  if(action==='run') return Math.floor(t/5)%8;
  if(action==='attack'){
    const data=NORMALS[move], start=data?.start??3,end=start+(data?.active??4);
    if(t<start) return t<Math.ceil(start/2)?0:1;
    if(t<end) return t<start+2?2:3;
    return t<end+4?4:5;
  }
  if(action==='skill'){
    if(char==='nailong'&&move==='qcf')return Math.floor(t/2)%6;
    const data=MOVES[char]?.[move];
    if(!data)return Math.min(5,Math.floor(t/4));
    const windows=data.hits||data.shots;
    if(!windows?.length)return Math.min(5,Math.floor(t/4));
    for(const window of windows){
      const start=window.from??window.at,end=window.to??start+2;
      if(t<start)return t<start-2?0:1;
      if(t<=end)return t<=start+1?2:3;
    }
    const last=windows[windows.length-1],end=last.to??last.at+2;
    return t<end+4?4:5;
  }
  if(action==='counter') return t<5?0:t<11?1:t<15?2:t<18?3:t<23?4:5;
  return 0;
}

export function drawFighter(ctx,player,tick=0) {
  const id=Object.hasOwn(design,player.char)?player.char:'doubao';
  const action=player.guard&&!['attack','skill','counter','hurt','ko'].includes(player.action)?'guard':player.action||'idle';
  const move=action==='attack'||action==='skill'||action==='counter'?player.move||'':'';
  const time=Math.max(0,Math.floor(player.actionTick??tick));
  const frame=frameFor(action,time,id,move),jab=action==='attack'&&player.jab?1:0;
  const key=id+'/'+action+'/'+frame+'/'+jab+'/'+move;
  if(!frameCache.has(key)) frameCache.set(key,drawFrame(id,action,frame,jab,move));
  const d=design[id];
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.translate(Math.round(player.x),Math.round(player.y));
  ctx.scale((player.facing<0?-1:1)*d.size,d.size);
  if(player.invuln>4&&Math.floor(tick/4)%2===1)ctx.globalAlpha*=0.71;
  ctx.drawImage(frameCache.get(key),-ANCHOR_X,-ANCHOR_Y,ATLAS_W,ATLAS_H);
  ctx.restore();
}
