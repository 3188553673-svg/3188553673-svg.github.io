import * as THREE from './vendor/three.module.js';

const PI = Math.PI;
const stone = [125, 128, 117];
const randomFrom = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let v = Math.imul(seed ^ seed >>> 15, 1 | seed); v ^= v + Math.imul(v ^ v >>> 7, 61 | v); return ((v ^ v >>> 14) >>> 0) / 4294967296; };
const fract = x => x - Math.floor(x);
const lerp = (a,b,t) => a + (b-a)*t;
const ease = x => x*x*(3-2*x);
function noise(x,z) {
  const a = Math.floor(x), b = Math.floor(z), u = ease(fract(x)), v = ease(fract(z));
  const h = (i,j) => { let n = Math.imul(i + 155, 374761393) ^ Math.imul(j + 277, 668265263); n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295; };
  return lerp(lerp(h(a,b),h(a+1,b),u),lerp(h(a,b+1),h(a+1,b+1),u),v);
}
const grain = (x,z) => noise(x,z)*.58 + noise(x*3.1+11,z*3.1+2)*.28 + noise(x*8.4,z*8.4+17)*.14;

function canvasOf(size, paint) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size); return canvas;
}
function stonePaint(ctx, size) {
  const rnd = randomFrom(1086), pixels = ctx.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const n = grain(x*.018,y*.022), moss = Math.max(0,noise(x*.014+40,y*.018)-.61), p=(y*size+x)*4;
    const edge = Math.pow(Math.max(Math.abs(x-size*.5),Math.abs(y-size*.5))/(size*.5),9);
    const weather=(n-.5)*44 + (rnd()-.5)*11 - edge*19;
    pixels.data[p]=stone[0]+weather-moss*32; pixels.data[p+1]=stone[1]+weather+moss*20; pixels.data[p+2]=stone[2]+weather-moss*37; pixels.data[p+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  // Thin mineral veins, chips and lichens sit below the lighting rather than glowing.
  for(let i=0;i<38;i++) {
    const x=rnd()*size,y=rnd()*size,length=4+rnd()*36,angle=rnd()*PI*2;
    ctx.strokeStyle=i%3?'rgba(49,60,54,.16)':'rgba(203,196,158,.22)'; ctx.lineWidth=.4+rnd()*1.6;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle)*length*.62,y+Math.sin(angle)*length*.62);ctx.lineTo(x+Math.cos(angle+.25)*length,y+Math.sin(angle+.25)*length);ctx.stroke();
  }
  for(let i=0;i<95;i++) {
    const x=rnd()*size,y=rnd()*size;if(noise(x*.015,y*.015+22)<.54)continue;
    ctx.fillStyle=i%2?'rgba(122,133,83,.16)':'rgba(196,181,136,.14)';ctx.beginPath();ctx.ellipse(x,y,1+rnd()*4,.6+rnd()*2,rnd()*PI,0,PI*2);ctx.fill();
  }
}
function riverPaint(ctx,size) {
  const rnd=randomFrom(84920), pixels=ctx.createImageData(size,size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const n=grain(x*.007,y*.023),p=(y*size+x)*4, wave=Math.sin(y*.22+noise(x*.013,y*.007)*7)*.5+.5;
    pixels.data[p]=20+n*21+wave*2; pixels.data[p+1]=40+n*29+wave*4; pixels.data[p+2]=51+n*34+wave*7; pixels.data[p+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  for(let i=0;i<145;i++) { const x=rnd()*size,y=rnd()*size;ctx.strokeStyle=`rgba(127,179,187,${.03+rnd()*.12})`;ctx.lineWidth=.6+rnd()*1.25;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+10,y-2,x+24,y+2,x+30+rnd()*69,y);ctx.stroke(); }
}
function compassPaint(ctx,size) {
  const half=size/2; ctx.translate(half,half); ctx.strokeStyle='rgba(175,150,105,.65)'; ctx.lineWidth=1.6;
  for(const r of [size*.414,size*.367,size*.145]) {ctx.beginPath();ctx.arc(0,0,r,0,PI*2);ctx.stroke();}
  for(let i=0;i<24;i++) { ctx.save();ctx.rotate(i*PI/12);ctx.beginPath();ctx.moveTo(0,size*.378);ctx.lineTo(i%3?0:size*.012,size*.405);ctx.stroke();ctx.restore(); }
  ctx.fillStyle='rgba(162,131,81,.5)';
  for(let i=0;i<8;i++) {ctx.save();ctx.rotate(i*PI/4);ctx.beginPath();ctx.moveTo(0,-size*(i%2?.246:.352));ctx.lineTo(size*.036,-size*.055);ctx.lineTo(0,-size*.092);ctx.lineTo(-size*.036,-size*.055);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
  ctx.beginPath();ctx.moveTo(0,-size*.06);ctx.lineTo(size*.058,0);ctx.lineTo(0,size*.06);ctx.lineTo(-size*.058,0);ctx.closePath();ctx.stroke();
}
function radialPaint(ctx,size,tone) {
  const c=size/2, g=ctx.createRadialGradient(c,c,0,c,c,c);
  g.addColorStop(0,`rgba(${tone},.64)`);g.addColorStop(.34,`rgba(${tone},.25)`);g.addColorStop(1,`rgba(${tone},0)`);ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
}

// Chamfered outline and a gently rounded bevel: one small reusable slab mesh.
function slabGeometry(width,height,depth,bevel) {
  const points=[], uv=[], indices=[];
  function ring(y,inset){
    const x=width*.5-inset,z=depth*.5-inset,c=Math.min(bevel*1.6,x*.3,z*.3);
    return [[x-c,y,-z],[x,y,-z+c],[x,y,z-c],[x-c,y,z],[-x+c,y,z],[-x,y,z-c],[-x,y,-z+c],[-x+c,y,-z]];
  }
  const rings=[ring(-height*.5,bevel),ring(-height*.5+bevel,0),ring(height*.5-bevel,0),ring(height*.5,bevel)];
  const put = (p,u=(p[0]/width+.5),v=(p[2]/depth+.5)) => {points.push(...p);uv.push(u,v);return points.length/3-1;};
  const face=(a,b,c,d)=>{const i=put(a,0,0);put(b,1,0);put(c,1,1);put(d,0,1);indices.push(i,i+1,i+2,i,i+2,i+3);};
  for(let r=0;r<3;r++) for(let i=0;i<8;i++) {const j=(i+1)%8;face(rings[r][j],rings[r][i],rings[r+1][i],rings[r+1][j]);}
  const top=points.length/3;for(const p of rings[3])put(p);for(let i=1;i<7;i++)indices.push(top,top+i+1,top+i);
  const bottom=points.length/3;for(const p of rings[0])put(p);for(let i=1;i<7;i++)indices.push(bottom,bottom+i,bottom+i+1);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function landHeight(x,d,side) {
  const a=grain(x*.041+side*43,d*.047), b=noise(x*.027+51,d*.033+side*15), shore=13+2.5*noise(x*.071,side*18);
  const rise=Math.max(0,d-shore);return -5.25 + 11*(1-Math.exp(-rise*.105))+(a-.5)*7.8*Math.min(1,rise/7)+(b-.55)*9*Math.min(1,rise/24);
}
function cliffGeometry(side) {
  const ps=[],colors=[],uv=[],ids=[], nx=74,nz=21, dark=new THREE.Color(0x233d41), grass=new THREE.Color(0x405448), shale=new THREE.Color(0x43545a);
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++) {
    const x=-90+i*180/nx, d=10+j*52/nz,z=side*d,y=landHeight(x,d,side);
    const slope=Math.abs(landHeight(x,d+1,side)-landHeight(x,d-1,side))*.5;
    const color=dark.clone().lerp(slope>.63?shale:grass,Math.max(.1,Math.min(.95,(y+5.3)*.088))).multiplyScalar(.78+grain(x*.2,z*.16)*.44);
    ps.push(x,y,z);colors.push(color.r,color.g,color.b);uv.push(x/8,z/8);
    if(j<nz&&i<nx){const a=j*(nx+1)+i,b=a+nx+1;if(side>0)ids.push(a,b,a+1,a+1,b,b+1);else ids.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return g;
}
function evergreenGeometry(distant = false) {
  const profile=distant?[[.07,.02],[.92,.24],[.65,.44],[.72,.61],[.49,.87],[.57,1.04],[.32,1.38],[.34,1.55],[.012,2.18]]:[[.1,.02],[.93,.2],[.77,.29],[.61,.48],[.75,.58],[.56,.67],[.43,.93],[.59,1.03],[.42,1.13],[.27,1.45],[.36,1.54],[.21,1.73],[.012,2.18]];
  const n=distant?6:9,ps=[],cs=[],ids=[], shade=new THREE.Color(0x163132), tip=new THREE.Color(0x3d6252);
  for(let row=0;row<profile.length;row++)for(let i=0;i<n;i++) {
    const [r,y]=profile[row], a=i*PI*2/n + .14*Math.sin(row*.91), v=r*(.87+.19*noise(i*1.3,row*.62));
    ps.push(Math.cos(a)*v+y*.055,y+Math.sin(a*3)*r*.042,Math.sin(a)*v);
    const c=shade.clone().lerp(tip,.22+y*.27).multiplyScalar(.76+.45*noise(i*.77,row*.82));cs.push(c.r,c.g,c.b);
    if(row<profile.length-1){const a0=row*n+i,b0=row*n+(i+1)%n;ids.push(a0,a0+n,b0,b0,a0+n,b0+n);}
  }
  const trunk=ps.length/3, bark=new THREE.Color(0x4c4535), stem=6;
  for(let row=0;row<2;row++)for(let i=0;i<stem;i++) {const a=i*PI*2/stem,r=row?.071:.119;ps.push(Math.cos(a)*r,row?.41:-.41,Math.sin(a)*r);cs.push(bark.r,bark.g,bark.b);if(!row){const j=(i+1)%stem;ids.push(trunk+i,trunk+i+stem,trunk+j,trunk+j,trunk+i+stem,trunk+j+stem);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));g.setIndex(ids);g.computeVertexNormals();return g;
}
function leafGeometry() {
  const p=[],uv=[],ix=[];
  for(let i=0;i<5;i++) { const t=i/4,w=.13*Math.sin(PI*(.08+t*.92)),z=.48*t*t;
    p.push(-w,t,z,0,t+.035*Math.sin(PI*t),z+.039,w,t,z);uv.push(0,t,.5,t,1,t);
    if(i<4){const j=i*3;ix.push(j,j+1,j+3,j+1,j+4,j+3,j+1,j+2,j+4,j+2,j+5,j+4);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}

/** A traversable 3D bridge over an original painted gorge. Geometry, materials and textures are scene-owned. */
export function buildArenaEnvironment(world) {
  const random=randomFrom(506216), resources=new Set(), hold=o=>(resources.add(o),o), dummy=new THREE.Object3D();
  const material=(color,options={})=>hold(new THREE.MeshStandardMaterial({color,roughness:.86,metalness:.04,...options}));
  const texture=(size,paint)=>{const t=hold(new THREE.CanvasTexture(canvasOf(size,paint)));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
  const mesh=(g,m,x,y,z)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);world.add(o);return o;};
  const instance=(g,m,items,{receiveShadow=false,castShadow=false}={})=>{
    const o=new THREE.InstancedMesh(g,m,items.length);o.receiveShadow=receiveShadow;o.castShadow=castShadow;
    items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx||0,p.rot||0,p.rz||0);dummy.scale.set(p.sx??1,p.sy??1,p.sz??1);dummy.updateMatrix();o.setMatrixAt(i,dummy.matrix);if(p.color)o.setColorAt(i,p.color);});
    o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();world.add(o);return o;
  };
  const grove=(g,m,items)=>{const sectors=new Map();for(const p of items){const key=`${Math.floor(p.x/27)}:${Math.floor(p.z/12)}`;if(!sectors.has(key))sectors.set(key,[]);sectors.get(key).push(p);}for(const batch of sectors.values())instance(g,m,batch);};
  const paving=texture(384,stonePaint), waterTexture=texture(384,riverPaint), emblem=texture(256,compassPaint), lanternGlow=texture(96,(ctx,s)=>radialPaint(ctx,s,'255,183,84'));
  waterTexture.wrapS=waterTexture.wrapT=THREE.RepeatWrapping;waterTexture.repeat.set(8,5);
  const water=mesh(hold(new THREE.PlaneGeometry(200,150)),material(0xe0e9e4,{map:waterTexture,roughness:.68,metalness:.05}),0,-5.22,0);water.rotation.x=-PI/2;
  const landMat=material(0xffffff,{vertexColors:true});for(const side of [-1,1])mesh(hold(cliffGeometry(side)),landMat,0,0,0);
  const backbone=mesh(hold(slabGeometry(83,2.5,17.6,.22)),material(0x39494a,{map:paving}),0,-.63,0);backbone.receiveShadow=true;
  const slab=hold(slabGeometry(1,.21,1,.061)), pavers=[];
  for(let row=0;row<8;row++) {
    const z=-7.15+row*2.04;let left=-41.3;
    while(left<41.2) {
      const span=Math.min(41.3-left,2.18+random()*2.52);if(span<.15)break;
      const edge=Math.pow(Math.abs(z)/8,2)*.10, weather=grain(left*.14,z*.21)*.14;
      const c=new THREE.Color().setRGB(.88+random()*.16+weather-edge,.88+random()*.16+weather-edge*.35,.84+random()*.16+weather-edge*.7);
      pavers.push({x:left+span/2,y:.75+random()*.016,z:z+(random()-.5)*.055,sx:span-.035,sz:1.995+random()*.026,rot:(random()-.5)*.009,color:c});left+=span;
    }
  }
  instance(slab,material(0xebeadc,{map:paving}),pavers,{receiveShadow:true});
  const badge=hold(new THREE.PlaneGeometry(1,1)), badgeMat=hold(new THREE.MeshBasicMaterial({map:emblem,transparent:true,depthWrite:false,opacity:.82,polygonOffset:true,polygonOffsetFactor:-2}));
  for(const x of [-33,0,33]){const m=mesh(badge,badgeMat,x,.879,0);m.rotation.x=-PI/2;m.scale.setScalar(x===0?6.7:7.6);}

  // Carved stone coping and lamp sockets are repeated in a few instance batches.
  const rails=[], inset=[],posts=[], caps=[], sconces=[], crystals=[], glow=[];
  for(const z of [-8.12,8.12]) {
    for(let x=-39;x<=39;x+=6) {
      rails.push({x,y:1.01,z,sx:5.89,sy:.39,sz:.64});inset.push({x,y:1.27,z,sx:5.94,sy:.14,sz:.74});
    }
    for(const x of [-36,-24,-12,0,12,24,36]) {
      posts.push({x,y:1.25,z,sx:1.35,sy:.73,sz:1.34},{x,y:1.79,z,sx:.86,sy:.59,sz:.85});
      caps.push({x,y:2.095,z,sx:1.10,sy:.19,sz:1.10});
      sconces.push({x,y:2.31,z,sx:1,sy:.54,sz:1});crystals.push({x,y:2.58,z,rot:PI/4,sx:1,sy:1.22,sz:1});
      glow.push({x,y:2.47,z,rx:-PI/4,sx:1.78,sy:1.78});
    }
  }
  const block=hold(slabGeometry(1,1,1,.09));
  instance(block,material(0x9eaaa0,{map:paving}),rails,{receiveShadow:true});
  instance(block,material(0xbab29a,{map:paving}),[...inset,...caps],{receiveShadow:true});
  instance(block,material(0xb3b9aa,{map:paving}),posts,{receiveShadow:true});
  instance(hold(new THREE.CylinderGeometry(.41,.49,.44,8,1,false)),material(0x564a3c,{metalness:.3}),sconces);
  instance(hold(new THREE.OctahedronGeometry(.25,1)),material(0xf8bb67,{emissive:0xff9a37,emissiveIntensity:.87,roughness:.34}),crystals);
  const glowMat=hold(new THREE.MeshBasicMaterial({map:lanternGlow,transparent:true,depthWrite:false,opacity:.65,color:0xffbd77}));
  instance(badge,glowMat,glow);

  const rockGeo=hold(new THREE.SphereGeometry(1,12,8)), rp=rockGeo.attributes.position;
  const rockColors=[], ca=new THREE.Color(0x294246), cb=new THREE.Color(0x638071);
  for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),t=.77+grain(x*1.9+12,z*2.1+y*.5)*.34;rp.setXYZ(i,x*t,y*t,z*t);const c=ca.clone().lerp(cb,.24+Math.max(0,y)*.49);rockColors.push(c.r,c.g,c.b);}
  rockGeo.setAttribute('color',new THREE.Float32BufferAttribute(rockColors,3));rockGeo.computeVertexNormals();
  const rocks=[],nearTrees=[],farTrees=[];
  for(const side of [-1,1]) {
    for(let i=0;i<31;i++) {const x=-66+random()*132,d=12.2+random()*14,z=side*d,s=1.2+random()*3.8;rocks.push({x,y:landHeight(x,d,side)-s*.38,z,rot:random()*PI*2,sx:s*(.85+random()*.6),sy:s*.75,sz:s*(.71+random()*.5)});}
    for(const [trees,count,start,spread] of [[nearTrees,48,13.25,9.4],[farTrees,31,23,27]]) for(let i=0;i<count;i++) {
      const x=-72+random()*144,d=start+random()*spread,z=side*d,y=landHeight(x,d,side),s=.7+random()*1.18,h=s*(.94+random()*.33),tone=new THREE.Color().setScalar(.74+random()*.37);
      trees.push({x,y:y+s*.27,z,sx:s,sy:h,sz:s,rot:random()*PI*2,color:tone});
    }
  }
  grove(rockGeo,material(0xffffff,{vertexColors:true}),rocks);
  const treeMat=material(0xffffff,{vertexColors:true});grove(hold(evergreenGeometry()),treeMat,nearTrees);grove(hold(evergreenGeometry(true)),treeMat,farTrees);

  const bushMask=texture(96,(ctx,s)=>radialPaint(ctx,s,'62,95,58'));
  const bushMat=hold(new THREE.MeshBasicMaterial({map:bushMask,transparent:true,depthWrite:false,opacity:.67,color:0x90ac6b}));
  const foliage=[], leaf=hold(leafGeometry());
  for(const [x,z] of [[-10,-6],[10,6]]) {
    const decal=mesh(badge,bushMat,x,.887,z);decal.rotation.x=-PI/2;decal.scale.set(5.1,3.7,1);
    for(let i=0;i<112;i++) {const a=random()*PI*2,r=Math.sqrt(random())*2.24,h=.4+random()*.84, c=new THREE.Color().setHSL(.223+random()*.083,.26+random()*.18,.23+random()*.17);foliage.push({x:x+Math.cos(a)*r,y:.84,z:z+Math.sin(a)*r*.58,rot:random()*PI*2,sx:.6+random()*.55,sy:h,sz:h,color:c});}
  }
  instance(leaf,material(0xdbe8a9,{side:THREE.DoubleSide,roughness:.91}),foliage,{receiveShadow:true});
  const dustPoints=[];for(let i=0;i<62;i++)dustPoints.push((random()-.5)*93,random()*4.4+1.2,(random()-.5)*39);
  const dustGeometry=hold(new THREE.BufferGeometry());dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPoints,3));
  const dust=new THREE.Points(dustGeometry,hold(new THREE.PointsMaterial({color:0xe8d49d,size:.052,transparent:true,opacity:.46,depthWrite:false})));world.add(dust);
  return {waterTexture,stoneTexture:paving,dust,dispose(){for(const resource of resources)resource.dispose();}};
}
