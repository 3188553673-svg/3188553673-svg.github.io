import * as THREE from './vendor/three.module.js';

// Original character art and animation, authored for this project. Geometry is
// built from anatomical sections, sewn clothing panels and shaped armor shells.
// No League of Legends meshes, textures, skeletons or motions are used here.
const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const mix = (a, b, t) => a + (b - a) * t;
const geometryCache = new Map(), materialCache = new Map(), textureCache = new Map();
const palettes = {
  garen: { name: '苍穹骑士', cloth: 0x263e61, clothLight: 0x4a6482, metal: 0x4d718d, trim: 0xc79a57, leather: 0x44342c, skin: 0xd5aa8c, hair: 0x171b24, gem: 0x73c9ea },
  ashe: { name: '月影游侠', cloth: 0x362f58, clothLight: 0x64577e, metal: 0x8fa9b7, trim: 0xc9d5dc, leather: 0x3e3444, skin: 0xd6b5a3, hair: 0x303346, gem: 0xb6c7f6 },
  lux: { name: '星辉术士', cloth: 0xe8dec7, clothLight: 0xfaf3de, metal: 0xb88c42, trim: 0xf3d69a, leather: 0x725b48, skin: 0xe0b6a0, hair: 0x674132, gem: 0xb59bef },
  yi: { name: '翡翠剑客', cloth: 0x183d39, clothLight: 0x326159, metal: 0x4b8e7d, trim: 0xbcc59c, leather: 0x3c3730, skin: 0xcda98e, hair: 0x172625, gem: 0x8dcbb2 },
};

function texture(kind, normal = false) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const key = `${kind}-${normal ? 'normal' : 'paint'}`;
  if (!textureCache.has(key)) {
    const map = new THREE.TextureLoader().load(new URL(`./assets/original-heroes/${key}.png`, import.meta.url).href);
    map.colorSpace = normal ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    textureCache.set(key, map);
  }
  return textureCache.get(key);
}
function material(kind, champion) {
  const key = `${champion}:${kind}`;
  if (!materialCache.has(key)) {
    const p = palettes[champion];
    const m = new THREE.MeshStandardMaterial({
      name: `original-${champion}-${kind}`, vertexColors: true,
      roughness: kind === 'metal' ? .57 : kind === 'skin' ? .72 : kind === 'gem' ? .23 : .87,
      metalness: kind === 'metal' ? .48 : kind === 'gem' ? .18 : .02,
      side: kind === 'cloth' || kind === 'hair' || kind === 'metal' ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (kind === 'gem') { m.emissive.set(p.gem); m.emissiveIntensity = .24; }
    else {
      m.map = texture(kind); m.normalMap = texture(kind, true);
      m.normalScale.setScalar(kind === 'metal' ? .36 : kind === 'cloth' ? .22 : .14);
    }
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}

const REST = [
  ['Root', -1, 0,0,0], ['Hips',0,0,1.90,0], ['Spine',1,0,2.25,0], ['Chest',2,0,2.65,0],
  ['Neck',3,0,2.99,0], ['Head',4,0,3.28,0],
  ['UpperArmL',3,.65,2.77,0], ['ForearmL',6,1.03,2.18,.02], ['HandL',7,1.18,1.63,.06],
  ['UpperArmR',3,-.65,2.77,0], ['ForearmR',9,-1.03,2.18,.02], ['HandR',10,-1.18,1.63,.06],
  ['ThighL',1,.29,1.90,0], ['ShinL',12,.33,1.03,.07], ['FootL',13,.33,.23,0],
  ['ThighR',1,-.29,1.90,0], ['ShinR',15,-.33,1.03,.07], ['FootR',16,-.33,.23,0],
  ['CapeTop',3,0,2.74,-.24], ['CapeMid',18,0,1.75,-.40], ['CapeHem',19,0,.83,-.50],
];
const fixed = i => () => [[i, 1]];
function blendBones(t, ids, stops = ids.map((_, i) => i / (ids.length - 1))) {
  let i = 0; while (i < stops.length - 2 && t > stops[i + 1]) i++;
  const a = clamp((t - stops[i]) / (stops[i + 1] - stops[i]));
  return [[ids[i], 1 - a], [ids[i + 1], a]];
}
const torsoWeights = p => blendBones(p.y, [1,2,3,4], [1.85,2.25,2.65,3.05]);

class Surface {
  constructor() { this.p=[];this.uv=[];this.c=[];this.si=[];this.sw=[];this.index=[]; }
  vertex(p, uv, color, weights) {
    const i=this.p.length/3;this.p.push(p.x,p.y,p.z);this.uv.push(...uv);
    const shade=new THREE.Color(color);this.c.push(shade.r,shade.g,shade.b);
    const w=weights(p);for(let j=0;j<4;j++){this.si.push(w[j]?.[0]||0);this.sw.push(w[j]?.[1]||0);}return i;
  }
  grid(rows, columns, point, color, weights) {
    rows = Math.max(4, Math.round(rows * .64)); columns = Math.max(6, Math.round(columns * .72));
    const base=this.p.length/3;
    for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
      const v=j/rows,u=i/columns,p=point(u,v);this.vertex(p,[u,v],typeof color==='function'?color(p,u,v):color,weights);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
      const a=base+j*(columns+1)+i,b=a+columns+1;this.index.push(a,b,a+1,a+1,b,b+1);
    }
  }
  finish() {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(this.si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(this.sw,4));g.setIndex(this.index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}
function ellipsoid(out, center, radius, color, weights, deform, sides=24, rings=16) {
  out.grid(rings,sides,(u,v)=>{
    const theta=v*Math.PI,phi=u*TAU;
    const p=V(center[0]+radius[0]*Math.sin(theta)*Math.sin(phi),center[1]+radius[1]*Math.cos(theta),center[2]+radius[2]*Math.sin(theta)*Math.cos(phi));
    return deform?deform(p,u,v):p;
  },color,weights);
}
function sweep(out, points, radii, color, weights, sides=12, rings=20) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>V(...p))),count=points.length-1;
  out.grid(rings,sides,(u,v)=>{
    const p=curve.getPoint(v),tangent=curve.getTangent(v).normalize(),axis=Math.abs(tangent.z)<.92?V(0,0,1):V(0,1,0);
    const a=V().crossVectors(tangent,axis).normalize(),b=V().crossVectors(a,tangent).normalize();
    const k=Math.min(count-1,Math.floor(v*count)),f=v*count-k;
    const rx=mix(radii[k][0],radii[k+1][0],f),rz=mix(radii[k][1],radii[k+1][1],f);
    return p.addScaledVector(a,Math.cos(u*TAU)*rx).addScaledVector(b,Math.sin(u*TAU)*rz);
  },color,p=>weights(p,curve));
}
function cord(out, points, width, color, weights, sides=7) {
  sweep(out,points,points.map((_,i)=>[width*((i === 0 || i === points.length - 1 ? .75 : 1)),width]),color,weights,sides,Math.max(8,points.length*5));
}
function profile(out, levels, color, weights, sides=32, frontShape=0) {
  const rows=(levels.length-1)*3;
  out.grid(rows,sides,(u,v)=>{
    const n=v*(levels.length-1),i=Math.min(levels.length-2,Math.floor(n)),t=n-i;
    const y=mix(levels[i][0],levels[i+1][0],t),rx=mix(levels[i][1],levels[i+1][1],t),rz=mix(levels[i][2],levels[i+1][2],t),a=-u*TAU;
    return V(Math.sin(a)*rx,y,Math.cos(a)*rz+frontShape*Math.max(0,Math.cos(a))**5*Math.sin(v*Math.PI));
  },color,weights);
}
function gem(out, center, radius, color, weights, sides=8) {
  ellipsoid(out,center,radius,color,weights,null,sides,6);
}
function patch(out, points, color, weights) {
  const a=out.p.length/3;
  for(let i=0;i<points.length;i++)out.vertex(V(...points[i]),[i%2,Math.floor(i/2)],color,weights);
  for(let i=1;i<points.length-1;i++)out.index.push(a,a+i,a+i+1);
}

function face(parts,p,style) {
  const skin=parts.skin,hair=parts.hair,head=fixed(5);
  ellipsoid(skin,[0,3.34,.01],[.255,.325,.225],p.skin,head,(q,u)=>{
    const front=Math.max(0,Math.cos(u*TAU));
    q.x*=q.y<3.27?mix(.73,1,clamp((q.y-3.01)/.26)):1;
    q.z+=front**8*(.060*Math.exp(-((q.x/.070)**2)-((q.y-3.34)/.11)**2)+.025*Math.exp(-(((q.y-3.47)/.055)**2)));
    return q;
  },64,40);
  for(const side of [-1,1]){
    ellipsoid(skin,[side*.105,3.423,.219],[.054,.015,.014],0xf3e6d6,head,null,14,8);
    ellipsoid(hair,[side*.105,3.423,.231],[.014,.014,.007],style==='mage'?0x594d65:0x263d43,head,null,12,8);
    cord(hair,[[side*.055,3.471,.233],[side*.10,3.481,.231],[side*.16,3.463,.215]],.009,p.hair,head);
    // The shaded eyelid is a shaped arc, not a black sphere pasted on the face.
    cord(skin,[[side*.051,3.426,.224],[side*.103,3.444,.233],[side*.159,3.426,.221]],.006,0xa17a67,head);
  }
  cord(skin,[[-.063,3.207,.212],[0,3.196,.228],[.064,3.208,.212]],.008,0x9e6e64,head);
  ellipsoid(skin,[0,3.168,.18],[.07,.015,.018],p.skin,head,null,16,8);
  // Sculpted scalp with individual swept hair locks, sideburns and a hairline.
  hair.grid(14,32,(u,v)=>{
    const a=u*TAU,front=Math.max(0,Math.cos(a)),theta=v*(1.72-front*(.35+.14*Math.sin(a)));
    return V(.264*Math.sin(theta)*Math.sin(a),3.35+.335*Math.cos(theta),.01+.235*Math.sin(theta)*Math.cos(a));
  },p.hair,head);
  const strands=style==='mage'?20:16;
  for(let i=0;i<strands;i++){
    const t=i/(strands-1),x=(t-.5)*.46;
    const color=new THREE.Color(p.hair).lerp(new THREE.Color(0x596270),(i%4)*.045).getHex();
    sweep(hair,[[-.14+t*.05,3.65,-.025],[x*.56-.04,3.675-Math.abs(x)*.13,.07],[x,3.58-Math.abs(x)*.12,.175],[x+.025,3.47+t*.075+.018*Math.sin(t*Math.PI),.205]],
      [[.010,.012],[.036,.022],[.032,.020],[.002,.004]],color,head,8,20);
  }
  for(const side of [-1,1])ellipsoid(skin,[side*.25,3.34,.005],[.038,.075,.039],p.skin,head,null,14,10);
  if(style==='mage'){
    // Three intertwined strands make a visible original side braid.
    for(let s=0;s<3;s++){
      const points=[];for(let i=0;i<17;i++){const t=i/16,a=t*TAU*3+s*TAU/3;points.push([.24+Math.cos(a)*.035,3.52-t*.96,-.01+Math.sin(a)*.035]);}
      cord(hair,points,.035,p.hair,head,8);
    }
    cord(parts.metal,[[.20,2.60,-.01],[.25,2.59,.03],[.30,2.60,-.01]],.018,p.trim,head);
  }
  if(style==='duelist'){
    ellipsoid(hair,[0,3.77,-.11],[.115,.10,.14],p.hair,head,null,20,12);
    cord(parts.cloth,[[-.09,3.77,-.17],[0,3.81,-.21],[.10,3.77,-.17]],.024,p.clothLight,head);
    cord(parts.cloth,[[.05,3.78,-.18],[.20,3.72,-.25],[.18,3.53,-.28]],.035,p.clothLight,head);
  }
}

function body(parts,p,style) {
  const female=style==='ranger'||style==='mage';
  const torso=female?[[1.80,.40,.22],[1.95,.43,.24],[2.15,.31,.20],[2.35,.36,.24],[2.60,.47,.26],[2.78,.52,.25],[2.90,.29,.20],[3.06,.14,.13]]:
    [[1.80,.43,.25],[1.95,.46,.27],[2.15,.35,.24],[2.35,.43,.27],[2.60,.55,.30],[2.78,.61,.28],[2.91,.30,.21],[3.06,.15,.14]];
  profile(parts.cloth,torso,p.cloth,torsoWeights,32,.035);
  profile(parts.skin,[[2.96,.13,.12],[3.10,.14,.13],[3.18,.15,.13]],p.skin,fixed(4),24);
  for(const side of [-1,1]){
    const arm=side===1?[6,7,8]:[9,10,11],leg=side===1?[12,13,14]:[15,16,17];
    const armWidth=female?.82:1;
    const arms=[[side*.62,2.76,0],[side*.78,2.54,0],[side*1.03,2.18,.02],[side*1.12,1.90,.04],[side*1.18,1.63,.06]];
    sweep(parts.cloth,arms,[[.18,.19],[.19,.17],[.13,.13],[.13,.12],[.085,.075]].map(r=>r.map(v=>v*armWidth)),p.cloth,q=>blendBones(clamp((2.77-q.y)/1.14),arm,[0,.52,1]),16,24);
    sweep(parts.cloth,[[side*.29,1.91,0],[side*.32,1.57,.035],[side*.33,1.04,.07],[side*.33,.70,.02],[side*.33,.23,0]],
      [[female?.225:.26,.24],[female?.23:.265,.235],[.15,.15],[.19,.17],[.115,.12]],p.cloth,q=>blendBones(clamp((1.9-q.y)/1.67),leg,[0,.52,1]),18,30);
    ellipsoid(parts.leather,[side*.33,.16,.19],[.17,.16,.34],p.leather,fixed(leg[2]),(q)=>{q.y=Math.max(.018,q.y);return q;},24,12);
    // Palm, thumb and four tapered fingers follow the actual hand joint.
    ellipsoid(parts.skin,[side*1.205,1.52,.07],[.085,.13,.065],p.skin,fixed(arm[2]),null,18,12);
    for(let f=0;f<4;f++){
      const z=.02+f*.034,y=1.44-Math.sin((f+1)/5*Math.PI)*.025;
      cord(parts.skin,[[side*1.22,y,z],[side*1.23,y-.07,z+.008],[side*1.22,y-.12,z+.025]],.019,p.skin,fixed(arm[2]),7);
    }
    cord(parts.skin,[[side*1.15,1.55,.11],[side*1.12,1.48,.16],[side*1.14,1.43,.18]],.027,p.skin,fixed(arm[2]),8);
    // Shaped bracer and boot cuffs; no cubes or cylindrical toy limbs.
    sweep(parts.metal,[[side*1.04,2.15,.02],[side*1.12,1.91,.04],[side*1.18,1.68,.055]],[[.15,.145],[.155,.14],[.10,.10]].map(r=>r.map(v=>v*armWidth)),p.metal,q=>blendBones(clamp((2.18-q.y)/.55),[arm[1],arm[2]]),16,14);
    // Long robes cover the knees; an exterior knee plate would pierce the cloth.
    if(style!=='mage'&&style!=='duelist'){
      sweep(parts.metal,[[side*.33,.99,.075],[side*.33,.65,.035],[side*.33,.28,0]],[[.175,.175],[.205,.185],[.13,.135]],p.metal,q=>blendBones(clamp((1.03-q.y)/.80),[leg[1],leg[2]]),18,16);
      ellipsoid(parts.metal,[side*.33,1.04,.18],[.19,.22,.105],p.metal,fixed(leg[1]),null,20,14);
      cord(parts.metal,[[side*.47,.91,.13],[side*.33,.96,.245],[side*.19,.91,.13]],.018,p.trim,fixed(leg[1]));
    }
    cord(parts.leather,[[side*.44,.47,.10],[side*.33,.43,.19],[side*.22,.47,.10]],.025,p.leather,fixed(leg[2]));
  }
  // A shaped leather waist belt and individually curved metal clasp.
  profile(parts.leather,[[2.05,.38,.26],[2.10,.39,.27],[2.18,.37,.255]],p.leather,fixed(1),40);
  ellipsoid(parts.metal,[0,2.12,.275],[.115,.085,.023],p.trim,fixed(1),null,24,12);
  gem(parts.gem,[0,2.12,.30],[.049,.052,.019],p.gem,fixed(1));
  face(parts,p,style);
}

function cape(parts,p,style) {
  const long=style==='knight'||style==='ranger',length=long?2.12:1.55,width=style==='knight'?.60:.55;
  const weights=q=>blendBones(clamp((2.76-q.y)/length),[18,19,20],[0,.47,1]);
  const point=(u,v)=>{
    const x=(u-.5)*2*(width+.22*v),y=2.80-length*v+.07*Math.sin(u*Math.PI*5)*v**5;
    return V(x,y,-.29-.31*v-.045*Math.cos(u*TAU*5)*Math.sin(v*Math.PI));
  };
  parts.cloth.grid(26,24,point,(q,u,v)=>new THREE.Color(p.cloth).lerp(new THREE.Color(p.clothLight),.15+.35*Math.cos((u-.5)*Math.PI)**2).getHex(),weights);
  for(const u of [.025,.975]){
    const points=[];for(let i=0;i<=14;i++){const q=point(u,i/14);q.z-=.008;points.push(q.toArray());}
    cord(parts.cloth,points,.018,p.trim,weights);
  }
  const hem=[];for(let i=0;i<=18;i++){const q=point(i/18,.96);q.z-=.008;hem.push(q.toArray());}cord(parts.cloth,hem,.022,p.trim,weights);
  // Embroidery: a stylized original compass/fan motif on the rear cloth.
  for(const side of [-1,1])cord(parts.cloth,[[0,2.45,-.365],[side*.18,2.20,-.40],[side*.08,1.95,-.45],[0,2.13,-.425]],.012,p.trim,weights);
}

function knight(parts,p) {
  body(parts,p,'knight');cape(parts,p,'knight');
  profile(parts.metal,[[2.17,.37,.265],[2.30,.46,.30],[2.56,.58,.34],[2.76,.63,.30],[2.84,.48,.25]],p.metal,torsoWeights,40,.065);
  // Breastplate keel and engraved swept ridges emphasize anatomy and weight.
  for(const side of [-1,1]){
    cord(parts.metal,[[side*.47,2.72,.25],[side*.34,2.64,.37],[side*.16,2.54,.405],[0,2.43,.39]],.018,p.trim,torsoWeights);
    cord(parts.metal,[[side*.44,2.42,.27],[side*.28,2.31,.31],[side*.08,2.25,.31]],.012,p.trim,torsoWeights);
    const bone=side===1?6:9;
    // A single flared plate shell with a rolled rim replaces stacked spheres.
    parts.metal.grid(14,32,(u,v)=>{
      const levels=[[3.04,.03,.06],[3.02,.21,.23],[2.89,.35,.31],[2.74,.37,.29],[2.70,.33,.26]],k=Math.min(3,Math.floor(v*4)),t=v*4-k,a=u*TAU;
      return V(side*.66+Math.sin(a)*mix(levels[k][1],levels[k+1][1],t),mix(levels[k][0],levels[k+1][0],t),Math.cos(a)*mix(levels[k][2],levels[k+1][2],t));
    },p.metal,fixed(bone));
    const edge=[];for(let i=0;i<=28;i++){const a=i/28*TAU;edge.push([side*.66+Math.sin(a)*.336,2.715,Math.cos(a)*.27]);}cord(parts.metal,edge,.018,p.trim,fixed(bone));
    cord(parts.metal,[[side*.43,2.92,.22],[side*.65,3.035,.22],[side*.87,2.92,.20]],.014,p.trim,fixed(bone));
    ellipsoid(parts.metal,[side*.33,.15,.27],[.17,.13,.26],p.metal,fixed(side===1?14:17),(q)=>{q.y=Math.max(.025,q.y);return q;},24,12);
    ellipsoid(parts.metal,[side*1.20,1.56,.092],[.10,.12,.065],p.metal,fixed(side===1?8:11),null,16,10);
    const boneLeg=side===1?12:15;
    sweep(parts.metal,[[side*.28,1.91,0],[side*.36,1.62,.06],[side*.33,1.25,.10]],[[.27,.28],[.28,.25],[.19,.18]],p.metal,fixed(boneLeg),20,14);
  }
  profile(parts.metal,[[2.92,.20,.20],[2.98,.22,.22],[3.02,.19,.18]],p.trim,fixed(4),32);
  // A sewn front tabard reads as cloth rather than another metal body shell.
  parts.cloth.grid(14,12,(u,v)=>V((u-.5)*(.46+.09*v),2.07-v*.78,.29+.045*Math.sin(u*Math.PI*5)-.035*v),p.clothLight,fixed(1));
  for(const side of [-1,1])cord(parts.cloth,[[side*.22,2.05,.31],[side*.25,1.65,.29],[side*.27,1.31,.27]],.012,p.trim,fixed(1));
  const ring=[];for(let i=0;i<=30;i++){const a=i/30*TAU;ring.push([Math.sin(a)*.115,2.64+Math.cos(a)*.115,.416]);}cord(parts.metal,ring,.018,p.trim,fixed(3));
  gem(parts.gem,[0,2.64,.439],[.048,.084,.025],p.gem,fixed(3));
  sword(parts,p,'knight');
}
function sword(parts,p,style) {
  const hand=fixed(11),curved=style==='duelist';
  const points=curved?[[-1.19,1.54,.10],[-1.23,1.92,.11],[-1.30,2.48,.12],[-1.40,3.02,.15],[-1.58,3.39,.18]]:
    [[-1.20,1.49,.10],[-1.23,1.88,.11],[-1.25,2.34,.12],[-1.28,2.86,.13],[-1.32,3.28,.14]];
  sweep(parts.metal,points,curved?[[.018,.016],[.060,.022],[.065,.018],[.057,.014],[.001,.001]]:[[.018,.02],[.095,.025],[.09,.023],[.067,.018],[.001,.001]],0xcbd8df,hand,8,30);
  cord(parts.metal,[[-1.23,1.91,.07],[-1.27,2.48,.09],[-1.31,3.08,.12]],.009,p.trim,hand);
  sweep(parts.leather,[[-1.19,1.43,.10],[-1.20,1.62,.10],[-1.22,1.80,.10]],[[.050,.047],[.043,.043],[.047,.045]],p.leather,hand,14,12);
  for(let i=0;i<7;i++)cord(parts.metal,[[-1.245,1.48+i*.043,.11],[-1.20,1.50+i*.043,.151],[-1.16,1.53+i*.043,.11]],.007,p.trim,hand,5);
  cord(parts.metal,[[-1.55,1.85,.10],[-1.42,1.91,.11],[-1.23,1.84,.11],[-1.04,1.91,.11],[-.91,1.85,.10]],.042,p.trim,hand,10);
  gem(parts.gem,[-1.19,1.40,.10],[.063,.072,.061],p.gem,hand);
}

function ranger(parts,p) {
  body(parts,p,'ranger');cape(parts,p,'ranger');
  profile(parts.leather,[[2.18,.33,.24],[2.35,.39,.27],[2.60,.50,.29],[2.76,.52,.27]],p.leather,torsoWeights,32,.025);
  // A deep open-faced hood with a pointed crown and a silver lining.
  parts.cloth.grid(20,28,(u,v)=>{
    const a=mix(Math.PI*.29,Math.PI*1.71,u),theta=mix(.02,2.36,v);
    return V(Math.sin(a)*Math.sin(theta)*.335,3.39+Math.cos(theta)*.445,Math.cos(a)*Math.sin(theta)*.30-.015);
  },p.cloth,fixed(5));
  const rim=[];for(let i=0;i<=28;i++){const a=i/28*TAU;rim.push([Math.sin(a)*.29,3.39+Math.cos(a)*.39,.186+.035*Math.cos(a)]);}cord(parts.cloth,rim,.046,p.clothLight,fixed(5));cord(parts.cloth,rim.map(q=>[q[0],q[1],q[2]+.036]),.008,p.trim,fixed(5));
  for(const side of [-1,1])cord(parts.leather,[[side*.40,2.77,.18],[side*.20,2.47,.30],[0,2.16,.28]],.045,p.leather,torsoWeights);
  // Crescent brooch and curved laminated bow. The bow is not a flat icon.
  const moon=[];for(let i=0;i<=24;i++){const a=mix(-2.2,2.2,i/24);moon.push([.075*Math.cos(a),2.59+.10*Math.sin(a),.333]);}cord(parts.metal,moon,.018,p.trim,fixed(3));
  const hand=fixed(8),bow=[[1.42,.59,.10],[1.35,.86,.13],[1.22,1.26,.15],[1.20,1.62,.16],[1.22,2.02,.14],[1.35,2.35,.10],[1.42,2.59,.06]];
  sweep(parts.leather,bow,bow.map((_,i)=>[i===0||i===6?.025:.045,.035]),p.leather,hand,12,40);
  cord(parts.metal,bow.map(q=>[q[0]+.025,q[1],q[2]+.018]),.023,p.trim,hand,8);
  cord(parts.hair,[[1.42,.60,.10],[1.42,1.61,.08],[1.42,2.58,.06]],.006,0xd2d4d6,hand,5);
  for(const i of [1,5])gem(parts.gem,[bow[i][0],bow[i][1],bow[i][2]+.047],[.048,.073,.026],p.gem,hand);
  sweep(parts.leather,[[.29,2.00,-.34],[.35,2.36,-.37],[.44,2.85,-.39]],[[.12,.11],[.14,.12],[.15,.13]],p.leather,fixed(3),16,15);
  for(let i=0;i<3;i++){
    const x=.36+i*.07;cord(parts.metal,[[x,2.36,-.4],[x+.10,3.14,-.4]],.012,0xc0b9a1,fixed(3));
    for(const side of [-1,1])patch(parts.cloth,[[x+.07,2.91,-.4],[x+.15,3.13,-.4+side*.07],[x+.10,3.10,-.4]],p.trim,fixed(3));
  }
}
function robe(parts,p,style) {
  const skirtWeights=q=>{
    const leg=q.x>=0?12:15,amount=clamp((2.1-q.y)/1.8)*.55;return [[1,1-amount],[leg,amount]];
  };
  for(const side of [-1,1]){
    parts.cloth.grid(24,20,(u,v)=>{
      const angle=mix(side===1?.12:Math.PI+.12,side===1?Math.PI-.12:TAU-.12,u),r=mix(.43,.69,v)*(1+.035*Math.cos(u*TAU*4));
      return V(Math.sin(angle)*r,2.12-v*1.80+v**5*.05*Math.cos(u*TAU*3),Math.cos(angle)*r*.60);
    },p.cloth,skirtWeights);
    cord(parts.cloth,[[side*.06,2.08,.27],[side*.10,1.55,.32],[side*.11,1.00,.37],[side*.14,.35,.40]],.025,p.trim,skirtWeights);
    cord(parts.cloth,[[side*.15,.35,.40],[side*.50,.33,.27],[side*.67,.35,0]],.028,p.trim,skirtWeights);
  }
}
function mage(parts,p) {
  body(parts,p,'mage');robe(parts,p,'mage');cape(parts,p,'mage');
  for(const side of [-1,1]){
    const bone=fixed(side===1?6:9);
    ellipsoid(parts.cloth,[side*.61,2.78,0],[.25,.22,.26],p.clothLight,bone,null,20,14);
    cord(parts.metal,[[side*.41,2.84,.17],[side*.60,2.93,.20],[side*.79,2.80,.17]],.028,p.trim,bone);
    cord(parts.metal,[[side*.31,2.71,.22],[side*.20,2.43,.29],[side*.11,2.21,.27]],.020,p.trim,torsoWeights);
  }
  gem(parts.gem,[0,2.60,.30],[.07,.12,.04],p.gem,fixed(3));
  cord(parts.metal,[[-.20,3.60,.14],[0,3.67,.20],[.20,3.60,.14]],.020,p.trim,fixed(5));
  gem(parts.gem,[0,3.66,.22],[.034,.052,.020],p.gem,fixed(5));
  const hand=fixed(11);
  sweep(parts.metal,[[-1.19,.10,.11],[-1.20,1.5,.11],[-1.21,2.55,.11],[-1.24,3.43,.11]],[[.035,.035],[.043,.043],[.033,.033],[.027,.027]],p.metal,hand,12,32);
  for(const side of [-1,1])cord(parts.metal,[[-1.23,3.22,.11],[-1.23+side*.24,3.51,.11],[-1.23+side*.13,3.78,.11],[-1.23,3.87,.11]],.032,p.trim,hand,8);
  gem(parts.gem,[-1.23,3.61,.11],[.12,.22,.09],p.gem,hand,6);
  const orbit=[];for(let i=0;i<=28;i++){const a=i/28*TAU;orbit.push([-1.23+Math.sin(a)*.24,3.61+Math.cos(a)*.14,.11+Math.cos(a)*.12]);}cord(parts.metal,orbit,.015,p.trim,hand);
}
function duelist(parts,p) {
  body(parts,p,'duelist');robe(parts,p,'duelist');cape(parts,p,'duelist');
  // Overlapping woven lapels, jade shoulder pieces, and an asymmetrical sash.
  for(const side of [-1,1]){
    cord(parts.cloth,[[side*.31,2.91,.16],[side*.21,2.64,.31],[-side*.08,2.31,.31],[side*.02,2.14,.29]],.075,p.clothLight,torsoWeights,12);
    ellipsoid(parts.metal,[side*.62,2.81,0],[.265,.16,.27],p.metal,fixed(side===1?6:9),null,24,14);
    cord(parts.metal,[[side*.43,2.82,.19],[side*.61,2.91,.22],[side*.80,2.80,.17]],.020,p.trim,fixed(side===1?6:9));
  }
  profile(parts.cloth,[[2.05,.39,.275],[2.13,.41,.28],[2.22,.38,.265]],p.clothLight,fixed(1),40);
  cord(parts.cloth,[[.21,2.16,.29],[.38,1.85,.34],[.47,1.56,.33],[.42,1.33,.32]],.075,p.clothLight,fixed(1),12);
  gem(parts.gem,[.26,2.13,.30],[.09,.11,.045],p.gem,fixed(1));
  sword(parts,p,'duelist');
}

function buildGeometry(champion) {
  const parts=Object.fromEntries(['skin','cloth','metal','leather','hair','gem'].map(k=>[k,new Surface()]));
  const p=palettes[champion];({garen:knight,ashe:ranger,lux:mage,yi:duelist})[champion](parts,p);
  return Object.entries(parts).filter(([,v])=>v.p.length).map(([kind,surface])=>({kind,geometry:surface.finish()}));
}
function quaternionTrack(name,times,values) {
  const q=new THREE.Quaternion(),e=new THREE.Euler(),data=[];
  for(const xyz of values){q.setFromEuler(e.set(...xyz));data.push(q.x,q.y,q.z,q.w);}
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,times,data);
}
function clipsFor(champion) {
  const idleTimes=[0,.6,1.2,1.8,2.4],runTimes=Array.from({length:17},(_,i)=>i/16*.82),attackTimes=[0,.12,.27,.39,.53,.70,.86];
  const idle=[];for(const [name,axis,amount] of [['Chest',0,.018],['Head',1,.022],['CapeMid',0,.035]])idle.push(quaternionTrack(name,idleTimes,idleTimes.map(t=>{const r=[0,0,0];r[axis]=Math.sin(t/2.4*TAU)*amount;return r;})));
  idle.push(quaternionTrack('UpperArmL',idleTimes,idleTimes.map(t=>[.02*Math.sin(t*2),0,-.17])));idle.push(quaternionTrack('UpperArmR',idleTimes,idleTimes.map(t=>[-.02*Math.sin(t*2),0,.17])));
  const run=[];
  for(const [side,offset] of [['L',0],['R',Math.PI]]){
    run.push(quaternionTrack(`Thigh${side}`,runTimes,runTimes.map(t=>[Math.sin(t/.82*TAU+offset)*.69,0,side==='L'?-.03:.03])));
    run.push(quaternionTrack(`Shin${side}`,runTimes,runTimes.map(t=>[Math.max(0,-Math.sin(t/.82*TAU+offset))*.98,0,0])));
    run.push(quaternionTrack(`Foot${side}`,runTimes,runTimes.map(t=>[-Math.sin(t/.82*TAU+offset)*.22,0,0])));
    run.push(quaternionTrack(`UpperArm${side}`,runTimes,runTimes.map(t=>[-Math.sin(t/.82*TAU+offset)*.52-.1,0,side==='L'?-.15:.15])));
    run.push(quaternionTrack(`Forearm${side}`,runTimes,runTimes.map(t=>[-.32-Math.max(0,Math.sin(t/.82*TAU+offset))*.28,0,0])));
  }
  run.push(new THREE.VectorKeyframeTrack('Hips.position',runTimes,runTimes.flatMap(t=>[0,1.90+Math.abs(Math.sin(t/.82*TAU))*.045,0])));
  run.push(quaternionTrack('Chest',runTimes,runTimes.map(t=>[-.07,Math.sin(t/.82*TAU)*.07,Math.sin(t/.82*TAU)*.025])));
  for(const [i,name] of ['CapeTop','CapeMid','CapeHem'].entries())run.push(quaternionTrack(name,runTimes,runTimes.map(t=>[-.08+Math.sin(t/.82*TAU+i*.8)*(.07+i*.025),0,0])));
  const attack=[];
  if(champion==='ashe'){
    attack.push(quaternionTrack('UpperArmL',attackTimes,[[0,0,-.17],[-1.1,-.1,-.4],[-1.2,-.1,-.45],[-1.2,-.1,-.45],[-1.15,-.1,-.4],[-.8,0,-.3],[0,0,-.17]]));
    attack.push(quaternionTrack('UpperArmR',attackTimes,[[0,0,.17],[-.9,-.5,.15],[-1.0,-.7,.3],[-1.0,-.8,.4],[-.9,-.5,.3],[-.6,-.3,.2],[0,0,.17]]));
    attack.push(quaternionTrack('ForearmR',attackTimes,[[0,0,0],[-1.1,-.7,0],[-1.4,-.8,0],[-1.5,-.8,0],[-1.1,-.5,0],[-.5,-.2,0],[0,0,0]]));
  }else{
    attack.push(quaternionTrack('UpperArmR',attackTimes,[[0,0,.17],[-.75,-.1,.34],[-1.55,-.2,.54],[-1.72,-.1,.30],[.72,.1,-.14],[.28,.05,.10],[0,0,.17]]));
    attack.push(quaternionTrack('ForearmR',attackTimes,[[0,0,0],[-.4,0,0],[-.85,0,0],[-.6,0,0],[-.13,0,0],[0,0,0],[0,0,0]]));
    attack.push(quaternionTrack('UpperArmL',attackTimes,[[0,0,-.17],[-.2,0,-.3],[-.4,0,-.4],[-.5,0,-.45],[-.25,0,-.3],[-.1,0,-.2],[0,0,-.17]]));
  }
  attack.push(quaternionTrack('Chest',attackTimes,[[0,0,0],[0,-.17,0],[-.07,-.31,0],[-.12,-.4,0],[.1,.25,0],[0,.1,0],[0,0,0]]));
  const guard=[quaternionTrack('UpperArmL',[0,.3,1,1.4],[[0,0,-.17],[-1.2,0,-.3],[-1.2,0,-.3],[0,0,-.17]]),quaternionTrack('ForearmL',[0,.3,1,1.4],[[0,0,0],[-1,0,0],[-1,0,0],[0,0,0]])];
  const death=[new THREE.VectorKeyframeTrack('Hips.position',[0,.4,1.2],[0,1.9,0,0,1.2,0,0,.55,0]),quaternionTrack('Chest',[0,.4,1.2],[[0,0,0],[.4,0,.2],[1.1,0,.3]])];
  return [new THREE.AnimationClip('idle',2.4,idle),new THREE.AnimationClip('run',.82,run),new THREE.AnimationClip('attack',.86,attack),new THREE.AnimationClip('guard',1.4,guard),new THREE.AnimationClip('death',1.2,death)];
}

/** Synchronous, DOM-independent geometry/skeleton construction. Textures load
 * asynchronously in browsers; Node structure tests simply omit image loading. */
export function createOriginalHero(champion='garen',options={}) {
  if(!palettes[champion])champion='garen';
  if(!geometryCache.has(champion))geometryCache.set(champion,buildGeometry(champion));
  const model=new THREE.Group();model.name=`original-${champion}`;
  const bones=REST.map(([name])=>{const b=new THREE.Bone();b.name=name;return b;});
  for(let i=0;i<REST.length;i++){
    const [,parent,x,y,z]=REST[i];const rest=parent<0?[0,0,0]:REST[parent].slice(2);bones[i].position.set(x-rest[0],y-rest[1],z-rest[2]);
    if(parent<0)model.add(bones[i]);else bones[parent].add(bones[i]);
  }
  model.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
  for(const {kind,geometry} of geometryCache.get(champion)){
    const mesh=new THREE.SkinnedMesh(geometry,material(kind,champion));mesh.name=`${champion}-${kind}`;mesh.frustumCulled=false;mesh.castShadow=options.castShadow!==false;mesh.receiveShadow=false;mesh.bind(skeleton);model.add(mesh);
  }
  const root=new THREE.Group();root.name=palettes[champion].name;root.add(model);root.scale.setScalar((options.height??3.2)/(champion==='lux'?3.90:3.82));
  const mixer=new THREE.AnimationMixer(model),clips=clipsFor(champion),actions=new Map();
  let active=null,state=null,locomotion='idle',locked=false,dead=false,disposed=false;
  const actor={root,mixer,clips,get state(){return state;},
    play(next,settings={}){
      if(disposed)return false;const moving=next==='idle'||next==='run';if(moving)locomotion=next;
      if((dead||locked&&moving)&&!settings.force)return false;
      if(next===state&&!settings.restart){active?.setEffectiveTimeScale(settings.timeScale??1);return true;}
      const name=next==='death'?'death':next==='w'?'guard':moving?next:'attack',clip=clips.find(c=>c.name===name);
      let action=actions.get(name);if(!action){action=mixer.clipAction(clip);actions.set(name,action);}
      const once=settings.once??!moving;action.reset().setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.setEffectiveTimeScale(settings.timeScale??1);action.setEffectiveWeight(1);
      if(active&&active!==action){active.fadeOut(settings.fade??.13);action.fadeIn(settings.fade??.13);}active=action;state=next;locked=once;dead=next==='death';action.play();return true;
    },
    update(dt){if(!disposed&&Number.isFinite(dt))mixer.update(clamp(dt,0,.1));},
    dispose(){if(disposed)return;disposed=true;mixer.stopAllAction();mixer.uncacheRoot(model);mixer.removeEventListener('finished',finished);skeleton.dispose();root.removeFromParent();},
  };
  function finished(e){if(e.action!==active||dead)return;locked=false;actor.play(locomotion,{force:true});}
  mixer.addEventListener('finished',finished);actor.play('idle');
  root.userData.original=true;root.userData.champion=champion;root.userData.credits='Original art, mesh, painted material maps and skeletal motion authored for Rift Arena.';
  return actor;
}
export async function loadOriginalHero(champion,options={}) {return createOriginalHero(champion,options);}
