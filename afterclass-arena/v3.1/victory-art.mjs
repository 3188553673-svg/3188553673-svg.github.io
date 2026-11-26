// Victory frames are sampled at 12 fps on the same pixel grid as the fighters.
export const LAST_VICTORY_FRAME = 24;
const outline = '#241e32';
const gold = '#ffd376';
const cream = '#fff1c2';

function progress(frame, first, last) {
  return Math.max(0,Math.min(1,(frame-first)/(last-first)));
}
function mix(a,b,t) { return Math.round(a+(b-a)*t); }

// Each row records time, the two hands, then torso and head motion.
// Hands lead the gesture; the elbows trail lower to keep the silhouette open.
const gestures = {
  doubao: [
    [0,12,-22,-7,-20,0,0,0,0], [4,13,-24,8,-24,1,2,2,1],
    [8,12,-27,12,-30,0,1,2,0], [12,14,-25,5,-21,0,0,0,-1],
    [17,20,-27,-7,-16,0,-1,2,-1], [24,20,-27,-6,-16,0,0,2,-1]
  ],
  jianguo: [
    [0,12,-24,-8,-19,0,0,0,0], [4,15,-21,-11,-14,1,2,1,1],
    [9,14,-44,-12,-15,-2,-1,-1,-1], [12,19,-16,-14,-13,3,6,2,1],
    [16,16,-19,-10,-18,1,2,1,0], [21,-4,-21,6,-23,0,-1,0,-1],
    [24,-5,-21,5,-23,0,-1,0,-1]
  ],
  rocket: [
    [0,11,-17,-10,-13,0,0,0,0], [4,13,-10,-12,-13,1,3,1,2],
    [7,15,-29,-11,-15,0,-1,1,-1], [11,16,-23,-10,-20,-2,0,-1,-2],
    [15,13,-25,-12,-16,0,1,0,-2], [17,16,-25,-14,-17,1,3,1,1],
    [21,13,-39,-11,-12,0,-1,1,-1], [24,13,-39,-12,-12,0,0,1,-1]
  ],
  iron: [
    [0,13,-25,-6,-22,0,0,0,0], [4,11,-14,-9,-12,0,4,0,2],
    [8,16,-13,-15,-12,0,0,0,-1], [12,22,-22,-19,-18,0,0,0,-1],
    [16,16,-37,-16,-15,0,0,1,-1], [19,8,-43,-14,-13,0,0,1,-1],
    [22,8,-43,-11,-14,0,2,1,0], [24,8,-43,-10,-14,0,0,1,-1]
  ],
  liangzi: [
    [0,12,-23,-7,-15,0,0,0,0], [4,16,-18,6,-17,1,3,1,1],
    [8,10,-29,3,-23,2,2,3,1], [11,8,-30,-5,-22,2,1,4,1],
    [15,14,-25,-11,-19,-1,0,-1,-1], [20,17,-36,-11,-13,0,-1,0,-1],
    [24,17,-36,-14,-16,0,0,0,-1]
  ],
  xujingyu: [
    [0,12,-21,-7,-20,0,0,0,0], [4,15,-13,-6,-22,1,4,2,1],
    [8,15,-36,6,-29,0,-2,1,-1], [12,18,-30,6,-29,-1,-1,0,-1],
    [17,20,-28,5,-29,0,0,0,0], [24,20,-28,5,-29,0,0,0,-1]
  ]
};
function handPose(id,frame) {
  const rows=gestures[id];
  const end=rows.findIndex(row=>row[0]>=frame);
  if(end<=0)return end===0?rows[0]:rows[rows.length-1];
  const a=rows[end-1],b=rows[end],t=progress(frame,a[0],b[0]);
  return a.map((n,i)=>mix(n,b[i],t));
}
export function applyVictoryPose(p,id,f) {
  const [,fx,fy,bx,by,dx,dy,hx,hy]=handPose(id,f);
  Object.assign(p,{dx,dy,headX:hx,headY:hy,fistF:[fx,fy],fistB:[bx,by]});
  const shoulder=id==='rocket'?-18:-24;
  p.elbowF=[mix(7,fx,.47)+5,mix(shoulder,fy,.45)+4];
  p.elbowB=[mix(-6,bx,.47)-4,mix(shoulder,by,.45)+4];
  if(id==='jianguo'){p.toeF=[12,0];p.toeB=[-12,0];p.kneeF=[10,-6];}
  if(id==='rocket'){p.tail=f<16?Math.round(Math.sin(f*.55)*2):-2;p.toeB=[-10,0];}
  if(id==='iron'&&f>=6&&f<=20){
    const tuck=Math.min(progress(f,5,11),1-progress(f,16,21));
    p.kneeB=[-7,mix(-6,-12,tuck)];p.toeB=[-6,mix(0,-6,tuck)];
    p.kneeF=[mix(5,8,tuck),mix(-6,-11,tuck)];p.toeF=[mix(7,10,tuck),mix(0,-3,tuck)];
  }
}

export function victoryLift(id,f) {
  const hop=(from,to,h)=>-Math.round(Math.sin(Math.PI*progress(f,from,to))*h);
  if(id==='iron')return -Math.round(13*Math.min(progress(f,4,10),1-progress(f,17,22)));
  if(id==='nailong')return hop(3,11,14)+hop(12,19,8);
  return 0;
}

// Nailong's paws and belly follow an independent squash pose rather than the
// humanoid skeleton. Both paws finish in a cheer around the milk bottle.
export function nailongCheer(f) {
  const push=f<4?f:f<9?0:f<13?4:f<17?0:f<20?2:0;
  const raised=f<4?progress(f,0,3)*.2:f<11?1:f<14?.35:f<18?1:progress(f,18,22)*.65+.35;
  return {squat:push,front:[mix(12,17,raised),mix(-17,-33,raised)],
    back:[mix(-10,-16,raised),mix(-17,-29,raised)],smile:f>=11};
}

function rect(c,x,y,w,h,color) {
  c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);
}
function line(c,x0,y0,x1,y1,color,thickness=1) {
  const n=Math.max(1,Math.abs(x1-x0),Math.abs(y1-y0));
  for(let i=0;i<=n;i++)rect(c,mix(x0,x1,i/n),mix(y0,y1,i/n),thickness,thickness,color);
}
function stamp(c,x,y,rows,palette) {
  for(let j=0;j<rows.length;j++)for(let i=0;i<rows[j].length;i++){
    const color=palette[rows[j][i]];if(color)rect(c,x+i,y+j,1,1,color);
  }
}
function glint(c,x,y,color) {
  rect(c,x-3,y,7,1,color);rect(c,x,y-3,1,7,color);rect(c,x,y,1,1,'#ffffff');
}
function phone(c,x,y) {
  rect(c,x-2,y-7,6,10,outline);rect(c,x-1,y-6,4,7,'#78a9d1');
  rect(c,x,y-5,2,4,'#d2f4fc');rect(c,x,y+1,2,1,'#cad3db');
}
function message(c,f) {
  if(f<5)return;
  const x=mix(12,18,progress(f,5,15)), y=mix(-40,-51,progress(f,5,15));
  const w=mix(14,23,progress(f,7,17));
  rect(c,x+2,y-1,w-4,15,outline);rect(c,x,y+1,w,11,outline);
  rect(c,x+1,y+1,w-2,10,'#77d8e4');rect(c,x+3,y,w-6,12,'#c5f8eb');
  rect(c,x+3,y+12,5,3,outline);rect(c,x+4,y+11,4,3,'#77d8e4');
  if(f<13){for(let j=0;j<=Math.min(2,Math.floor((f-5)/2));j++)rect(c,x+3+j*4,y+5,2,2,'#577992');}
  else stamp(c,x+Math.floor((w-9)/2),y+2,['.ppp.ppp.','prrrprrrp','prrlrrrrp','prrrrrrrp','.prrrrrp.','..prrrp..','...prp...','....p....'],{p:'#82415c',r:'#ec7080',l:'#ffbbb0'});
}
function reportCard(c,f) {
  // The school stamp lands on the report card, then leaves its red mark behind.
  const y=-16;
  rect(c,21,y,18,20,outline);rect(c,22,y+1,16,17,'#c7915b');rect(c,23,y+2,14,15,cream);
  rect(c,25,y+5,8,1,'#b79978');rect(c,25,y+7,5,1,'#b79978');
  if(f>=12){stamp(c,25,y+8,['.rrrrrr.','rr....rr','r....r.r','r.r.r..r','r..r...r','rr....rr','.rrrrrr.'],{r:'#bf4e48'});}
}
function parentSeal(c,x,y) {
  rect(c,x-2,y-2,5,7,outline);rect(c,x-1,y-1,3,5,'#c38e54');
  rect(c,x-5,y+3,11,5,outline);rect(c,x-4,y+4,9,2,gold);rect(c,x-4,y+6,9,1,'#ce6054');
}
function wrench(c,x,y,angle) {
  const dx=Math.cos(angle),dy=Math.sin(angle);
  function dot(a,b) {return [Math.round(x+dx*a-dy*b),Math.round(y+dy*a+dx*b)];}
  function bar(a,b,e,g,col,w){line(c,...dot(a,b),...dot(e,g),col,w);}
  for(const [offset,col,thick] of [[0,outline,4],[0,'#d59440',2],[1,'#ffe89c',1]]){
    bar(-6,offset,4,offset,col,thick);bar(3,offset,7,-3+offset,col,thick);
    bar(3,offset,9,1+offset,col,thick);
  }
}
function bootJet(c,x,y,flame) {
  rect(c,x-2,y+2,5,3,'#338ba8');rect(c,x-1,y+3,4,flame,'#67e2ec');
  rect(c,x,y+4,2,Math.max(2,flame-2),'#e6ffdf');rect(c,x+1,y+3+flame,1,2,'#65bccc');
}
function wrap(c,x,y,bitten) {
  const rows=['..gggrr..','.ggrrrgk.','gdrrfggdk','dffgfffd.','dfffffd..','.dfaffd..','.dfffad..','..dffad..','..dffbd..','...dbbd..','...dkk...'];
  const top=bitten?['....grr..','....rrgk.','..grfggdk',...rows.slice(3)]:rows;
  stamp(c,x,y,top,{d:'#84513c',k:outline,f:'#f6ce85',a:'#d9a45d',b:'#a87642',r:'#b65740',g:'#77a25c'});
}
function cheersMic(c,x,y) {
  rect(c,x,y-6,3,7,outline);rect(c,x+1,y-4,1,4,'#a6b7bf');
  stamp(c,x-2,y-10,['.kkk.','khhhk','klllk','.khk.'],{k:outline,h:'#8598a2',l:'#c1d9d4'});
}
function ball(c,x,y,f) {
  stamp(c,x-6,y-6,['...kkkkk...','..kfoooak..','.kfooooook.','kfooooooook','kfooooooook','koooooooook','koooooooaak','kaooooaaaak','.kaaaaaaak.','..kaaaaak..','...kkkkk...'],{k:'#52382e',a:'#bf703a',o:'#ee9449',f:'#ffd785'});
  const offset=[-3,-1,2,3][f%4];
  line(c,x-5,y-1,x+4,y+1,'#865039');
  line(c,x+1,y-5,x+offset,y,'#865039');line(c,x+offset,y,x-1,y+4,'#865039');
}
function milk(c,x,y) {
  stamp(c,x-4,y-10,['..mmmm..','..wwmw..','.kwwwwk.','kwwwwwwk','kqqqqqqk','kqwqqwqk','kqqwwqqk','kqqqqqqk','kwwwwwwk','.kkkkkk.'],
    {k:'#654c54',w:'#faf0ce',q:'#83c9d5',m:'#d08f70'});
}

export function drawVictoryProps(c,id,f,p) {
  if(id==='nailong'){
    const pose=nailongCheer(f);
    milk(c,pose.front[0]+3,pose.front[1]+pose.squat/2);
    return;
  }
  const [fx,fy]=p.fistF, [bx,by]=p.fistB;
  if(id==='doubao'){phone(c,fx,fy);message(c,f);}
  if(id==='jianguo'){
    reportCard(c,f);
    if(f<17)parentSeal(c,fx+2,fy+1);
    else {parentSeal(c,40,-3);}
    if(f===12||f===13){line(c,33,-17,36,-22,gold);line(c,37,-15,41,-17,cream);}
  }
  if(id==='rocket'){
    const t=progress(f,7,17),loose=f>=7&&f<=17;
    const x=loose?mix(18,19,t):fx+4, y=loose?mix(-31,-27,t)-Math.round(Math.sin(t*Math.PI)*21):fy-3;
    wrench(c,x,y,loose?-.8+t*Math.PI*2:-.8);
    if(f===12||f===21)glint(c,x+10,y-5,gold);
  }
  if(id==='iron'&&f>3&&f<22){
    for(const [x,y] of [p.toeB,p.toeF]){
      const flame=Math.min(5+f%3,-victoryLift(id,f)-y-1);
      if(flame>=2)bootJet(c,x,y,flame);
    }
  }
  if(id==='liangzi'){
    wrap(c,fx,fy-9,f>=11);
    if(f>=11&&f<=14){rect(c,12+(f-11)*2,-29+f-11,2,1,gold);rect(c,9+f-11,-27+(f-11)*2,1,2,'#d3a06e');}
    if(f>=17){rect(c,bx-1,by-6,3,5,outline);rect(c,bx,by-5,2,3,'#f6bf93');}
  }
  if(id==='xujingyu'){
    cheersMic(c,bx,by);
    const toss=f>=8&&f<=16?Math.round(Math.sin(Math.PI*progress(f,8,16))*13):0;
    const y=fy-8-toss;
    ball(c,fx+3,y,f);
    if(f>=16){rect(c,fx+2,fy-4,2,3,'#f1bc96');if(f%4===2){rect(c,fx+8,y,3,1,'#efcb85');rect(c,fx-7,y-2,2,1,'#efcb85');}}
  }
}
