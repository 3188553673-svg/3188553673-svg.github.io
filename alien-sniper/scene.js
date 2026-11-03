import * as THREE from './vendor/three.module.js';
import { WALL, getTargetParts } from './rules.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
function seeded(seed = 84) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

/** Wall positions and robot ellipses come from the same rules as the game server. */
export class DuelScene {
  constructor(canvas, { onReady } = {}) {
    this.canvas = canvas;
    this.available = false;
    this.time = 0;
    this.recoil = 0;
    this.scoped = false;
    this.aim = { x: 0, y: 5 };
    this.state = null;
    this.effects = [];
    this.materials = {};
    this.geometries = {};
    this.wallHash = null;
    this.demo = true;
    this.raycaster = new THREE.Raycaster();
    this.wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#284c50');
      this.scene.fog = new THREE.FogExp2('#456262', 0.008);
      this.camera = new THREE.PerspectiveCamera(55, 1, 0.08, 500);
      this.camera.position.set(0, 5, 18);
      this.scene.add(this.camera);
      this.createMaterials();
      this.createEnvironment();
      this.createWall();
      this.createRobot();
      this.createRifle();
      this.resize();
      this.available = true;
      this.drawWall([{ id: 'demo-a', x: -0.25, y: 5.6 }, { id: 'demo-b', x: -4.8, y: 3.5 }, { id: 'demo-c', x: 3.1, y: 7.3 }]);
      this.applyTarget({ x: 0, y: 4.8, pose: 'stand' });
      onReady?.({ available: true });
    } catch (error) {
      this.error = error;
      this.renderer?.dispose();
      onReady?.({ available: false, error: '当前浏览器无法启动 3D 画面，请使用新版 Chrome、Edge 或 Safari。' });
    }
  }

  mat(name, color, extra = {}) {
    const m = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.78, ...extra });
    this.materials[name] = m;
    return m;
  }
  createMaterials() {
    this.mat('sand', '#a4af9b');
    this.mat('concrete', '#607d79');
    this.mat('metal', '#314f55', { metalness: 0.7, roughness: 0.5 });
    this.mat('dark', '#19353c', { metalness: 0.6, roughness: 0.5 });
    this.mat('edge', '#bdc2a9');
    this.mat('cyan', '#7df2d2', { emissive: '#36caaa', emissiveIntensity: 1.4 });
    this.mat('orange', '#e9a359', { emissive: '#ce7337', emissiveIntensity: 0.35 });
    this.mat('alien', '#a5d382', { metalness: 0.22, roughness: 0.52 });
    this.mat('armor', '#598d77', { metalness: 0.6, roughness: 0.44 });
    this.mat('joint', '#345c59', { metalness: 0.5 });
    this.mat('eyes', '#142f34', { metalness: 0.7, roughness: 0.25 });
    this.mat('pupil', '#aaffce', { emissive: '#60fcb4', emissiveIntensity: 1.8 });
    this.mat('rifle', '#18343c', { metalness: 0.75, roughness: 0.4 });
    this.mat('rifleEdge', '#729189', { metalness: 0.75, roughness: 0.4 });
    this.mat('gold', '#d1a16b', { metalness: 0.7, roughness: 0.4 });
    this.geometries.box = new THREE.BoxGeometry(1, 1, 1);
    this.geometries.sphere = new THREE.SphereGeometry(1, 18, 12);
    this.geometries.cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  }
  mesh(shape, material, scale, position, parent = this.scene) {
    const mesh = new THREE.Mesh(this.geometries[shape], typeof material === 'string' ? this.materials[material] : material);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }
  box(material, scale, position, parent) { return this.mesh('box', material, scale, position, parent); }

  createEnvironment() {
    this.scene.add(new THREE.HemisphereLight('#d8efdc', '#6b7259', 2.6));
    const sun = new THREE.DirectionalLight('#ffe0ad', 2.8);
    sun.position.set(-30, 60, 20);
    this.scene.add(sun);
    const back = new THREE.DirectionalLight('#69c6c4', 1.2);
    back.position.set(30, 35, -30);
    this.scene.add(back);
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec3 vP;void main(){float h=normalize(vP).y;vec3 c=mix(vec3(.73,.64,.47),vec3(.035,.18,.22),smoothstep(-.025,.7,h));gl_FragColor=vec4(c,1.);}',
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(390, 24, 16), skyMat));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), this.materials.sand);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.12, -45);
    this.scene.add(ground);
    this.box('concrete', [23, 0.2, 21], [0, -0.05, 6]);
    for (let z = 2; z < 18; z += 3) {
      this.box('orange', [0.13, 0.02, 1.8], [-10.5, 0.07, z]);
      this.box('cyan', [0.13, 0.02, 1.8], [10.5, 0.07, z]);
    }
    for (const side of [-1, 1]) {
      const x = side * 24;
      this.box('metal', [12, 10, 14], [x, 5, -21]);
      this.box('edge', [12.8, 0.35, 14.8], [x, 10.2, -21]);
      this.box('dark', [13, 1, 14.1], [x, 4.3, -21]);
      this.box('cyan', [7, 0.18, 0.04], [x, 8.5, -13.93]);
      this.box('metal', [0.16, 6, 0.16], [x + side * 2, 13.3, -22]);
      this.mesh('sphere', 'orange', [0.25, 0.25, 0.25], [x + side * 2, 16.4, -22]);
      this.box('dark', [8, 4, 7], [side * 14.3, 2, -8]);
      this.box('edge', [8.4, 0.3, 7.4], [side * 14.3, 4.2, -8]);
    }
    const planet = new THREE.Group();
    planet.position.set(-55, 58, -176);
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(21, 36, 24), new THREE.MeshStandardMaterial({ color: '#698e84', roughness: 1, fog: false })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(27, 36, 80), new THREE.MeshBasicMaterial({ color: '#e1d2ab', transparent: true, opacity: 0.27, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    ring.rotation.set(-0.85, 0.1, -0.4);
    planet.add(ring);
    this.scene.add(planet);
    const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), this.materials.concrete, 50);
    const rng = seeded(34);
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 50; i++) {
      const s = 0.3 + rng() * 0.8;
      q.setFromEuler(new THREE.Euler(rng(), rng() * TAU, rng()));
      matrix.compose(new THREE.Vector3((rng() > 0.5 ? 1 : -1) * (15 + rng() * 50), 0.1, 18 - rng() * 100), q, new THREE.Vector3(s, s * 0.5, s));
      stones.setMatrixAt(i, matrix);
    }
    this.scene.add(stones);
  }

  createWall() {
    this.wallCanvas = document.createElement('canvas');
    this.wallCanvas.width = 1536;
    this.wallCanvas.height = Math.round(1536 * WALL.height / WALL.width);
    this.wallContext = this.wallCanvas.getContext('2d');
    this.wallTexture = new THREE.CanvasTexture(this.wallCanvas);
    this.wallTexture.colorSpace = THREE.SRGBColorSpace;
    this.wallTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.wallMaterial = new THREE.MeshStandardMaterial({ map: this.wallTexture, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.35 });
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL.width, WALL.height), this.wallMaterial);
    this.wall.position.set(0, WALL.height / 2, 0);
    this.scene.add(this.wall);
    const half = WALL.width / 2;
    for (const side of [-1, 1]) {
      this.box('dark', [0.38, WALL.height + 0.6, 0.9], [side * (half + 0.23), WALL.height / 2, -0.18]);
      this.box('edge', [0.08, WALL.height + 0.2, 0.2], [side * (half + 0.24), WALL.height / 2, 0.34]);
      this.box(side < 0 ? 'orange' : 'cyan', [0.08, 7.5, 0.08], [side * (half + 0.24), 5.2, 0.46]);
      for (let i = 1; i < 10; i += 2) this.box('metal', [0.62, 0.22, 1], [side * (half + 0.23), i, -0.18]);
    }
    this.box('dark', [WALL.width + 1.2, 0.45, 1.2], [0, WALL.height + 0.18, -0.12]);
    this.box('edge', [WALL.width + 1, 0.1, 1.2], [0, WALL.height + 0.43, -0.12]);
    this.box('dark', [WALL.width + 1.1, 0.3, 1.25], [0, 0.05, -0.15]);
    this.box('orange', [WALL.width - 0.8, 0.06, 0.08], [0, WALL.height + 0.06, 0.5]);
  }

  drawWall(holes = []) {
    const ctx = this.wallContext;
    const w = this.wallCanvas.width;
    const h = this.wallCanvas.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#a48c68';
    ctx.fillRect(0, 0, w, h);
    const rng = seeded(734);
    const brickW = w / 9;
    const brickH = h / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 10; col++) {
        const x = col * brickW + (row % 2 ? brickW / 2 : 0);
        const y = row * brickH;
        const shade = Math.floor(rng() * 14);
        ctx.fillStyle = `rgb(${166 + shade},${153 + shade},${124 + shade})`;
        ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
        ctx.fillStyle = 'rgba(240,228,194,.2)';
        ctx.fillRect(x + 3, y + 3, brickW - 6, 2);
        ctx.fillStyle = 'rgba(35,49,39,.12)';
        ctx.fillRect(x + 3, y + brickH - 5, brickW - 6, 2);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = 'rgba(35,49,39,.05)';
          ctx.fillRect(x + rng() * brickW, y + rng() * brickH, 1 + rng() * 5, 1 + rng() * 3);
        }
      }
    }
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(255,226,166,.08)');
    gradient.addColorStop(0.7, 'rgba(24,57,51,0)');
    gradient.addColorStop(1, 'rgba(24,57,51,.21)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(48,65,56,.32)';
    ctx.font = '600 22px monospace';
    ctx.fillText('ORBITAL RANGE   /   WALL 07', 30, 41);
    ctx.font = '600 18px monospace';
    ctx.fillText('LIVE FIRE', w - 150, h - 23);
    ctx.strokeStyle = 'rgba(49,69,59,.16)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 9; x++) {
      ctx.beginPath();
      ctx.moveTo(42 + x * 160, h - 35);
      ctx.lineTo(69 + x * 160, h - 59);
      ctx.stroke();
    }
    const scale = w / WALL.width;
    for (const hole of holes) {
      const x = (hole.x + WALL.width / 2) * scale;
      const y = (WALL.height - hole.y) * scale;
      const radius = WALL.holeRadius * scale;
      const local = seeded(Math.round((hole.x + 20) * 911 + hole.y * 123));
      ctx.strokeStyle = 'rgba(37,50,38,.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const a = local() * TAU;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * radius * 0.8, y + Math.sin(a) * radius * 0.8);
        const len = radius * (1.3 + local() * 0.35);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, 0, TAU);
      ctx.fillStyle = '#675f4d';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 1, radius + 1.5, 0, TAU);
      ctx.strokeStyle = 'rgba(233,215,171,.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (const hole of holes) {
      ctx.beginPath();
      ctx.arc((hole.x + WALL.width / 2) * scale, (WALL.height - hole.y) * scale, WALL.holeRadius * scale, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.wallTexture.needsUpdate = true;
  }

  createRobot() {
    this.robot = new THREE.Group();
    this.robot.position.z = -0.65;
    this.robotParts = [];
    this.robotFace = new THREE.Group();
    this.robot.add(this.robotFace);
    for (const side of [-1, 1]) {
      const eye = this.mesh('sphere', 'eyes', [0.145, 0.12, 0.036], [side * 0.17, 0.055, 0.225], this.robotFace);
      eye.rotation.z = side * 0.28;
      this.mesh('sphere', 'pupil', [0.042, 0.06, 0.022], [side * 0.16, 0.055, 0.257], this.robotFace);
    }
    this.box('joint', [0.14, 0.035, 0.025], [0, -0.17, 0.242], this.robotFace);
    this.robotCore = this.mesh('sphere', 'cyan', [0.08, 0.11, 0.035], [0, 0, 0.25], this.robot);
    this.scene.add(this.robot);
  }

  applyTarget(target) {
    this.robot.visible = !!target;
    if (!target) return;
    // Compensate for the robot's 0.65 m depth so shared 2D hit ellipses project
    // onto their exact wall coordinates, including on a narrow mobile viewport.
    const perspective = (this.camera.position.z + 0.65) / this.camera.position.z;
    this.robot.scale.set(perspective, perspective, 1);
    this.robot.position.y = this.camera.position.y * (1 - perspective);
    const parts = getTargetParts(target);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!this.robotParts[i]) this.robotParts[i] = this.mesh('sphere', part.kind === 'head' ? 'alien' : 'armor', [1, 1, 0.22], [0, 0, 0], this.robot);
      const mesh = this.robotParts[i];
      mesh.visible = true;
      mesh.position.set(part.x, part.y, 0);
      mesh.scale.set(part.rx, part.ry, part.kind === 'head' ? 0.25 : 0.2);
      mesh.material = this.materials[part.kind === 'head' ? 'alien' : part.part === 'torso' ? 'armor' : 'joint'];
    }
    for (let i = parts.length; i < this.robotParts.length; i++) this.robotParts[i].visible = false;
    const head = parts.find(p => p.kind === 'head');
    if (head) this.robotFace.position.set(head.x, head.y, 0);
    const body = parts.find(p => p.part === 'torso') || parts.find(p => p.kind === 'body');
    if (body) this.robotCore.position.set(body.x, body.y, 0.215);
  }

  createRifle() {
    this.rifle = new THREE.Group();
    this.rifle.scale.setScalar(0.65);
    this.rifle.position.set(0.4, -0.49, -0.9);
    this.rifle.rotation.y = -0.035;
    this.camera.add(this.rifle);
    const r = this.rifle;
    this.box('rifle', [0.18, 0.19, 0.62], [0, 0, -0.16], r);
    this.box('rifleEdge', [0.17, 0.09, 0.48], [0, 0.105, -0.12], r);
    this.box('rifle', [0.1, 0.15, 0.5], [0, -0.03, -0.7], r);
    this.box('gold', [0.105, 0.018, 0.3], [0, 0.048, -0.72], r);
    const barrel = this.mesh('cylinder', 'rifleEdge', [0.035, 0.63, 0.035], [0, 0.03, -1.15], r);
    barrel.rotation.x = Math.PI / 2;
    const muzzle = this.mesh('cylinder', 'rifle', [0.058, 0.19, 0.058], [0, 0.03, -1.49], r);
    muzzle.rotation.x = Math.PI / 2;
    this.box('rifle', [0.16, 0.12, 0.36], [0, -0.015, 0.29], r);
    this.box('rifleEdge', [0.19, 0.26, 0.08], [0, -0.04, 0.47], r);
    const grip = this.box('rifle', [0.09, 0.25, 0.1], [0, -0.17, 0.055], r);
    grip.rotation.x = -0.27;
    this.box('rifleEdge', [0.11, 0.23, 0.16], [0, -0.17, -0.21], r);
    this.box('gold', [0.012, 0.05, 0.12], [0.096, 0.03, 0.02], r);
    for (const z of [-0.24, 0.08]) this.box('rifleEdge', [0.12, 0.07, 0.08], [0, 0.17, z], r);
    const optic = this.mesh('cylinder', 'rifle', [0.075, 0.48, 0.075], [0, 0.24, -0.08], r);
    optic.rotation.x = Math.PI / 2;
    for (const z of [-0.32, 0.16]) {
      const rim = this.mesh('cylinder', 'rifleEdge', [0.1, 0.065, 0.1], [0, 0.24, z], r);
      rim.rotation.x = Math.PI / 2;
    }
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.077, 20), new THREE.MeshBasicMaterial({ color: '#80c8c3', transparent: true, opacity: 0.65 }));
    lens.position.set(0, 0.24, 0.195);
    r.add(lens);
    for (let i = 0; i < 7; i++) this.box('rifleEdge', [0.115, 0.025, 0.023], [0, 0.069, -0.52 - i * 0.045], r);
    this.mesh('sphere', 'metal', [0.105, 0.12, 0.14], [0.035, -0.15, 0.075], r);
    this.mesh('sphere', 'metal', [0.12, 0.12, 0.22], [-0.04, -0.12, -0.61], r);
    this.muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.6, 7), new THREE.MeshBasicMaterial({ color: '#ffdf96', transparent: true, opacity: 0.95, depthWrite: false }));
    this.muzzleFlash.rotation.x = -Math.PI / 2;
    this.muzzleFlash.position.set(0, 0.03, -1.8);
    this.muzzleFlash.visible = false;
    r.add(this.muzzleFlash);
  }

  update(state, dt = 1 / 60) {
    if (!this.available) return;
    if (!state) {
      // The app calls update(null) every frame on its home screen. Restore the
      // showcase only on the transition, avoiding repeated texture uploads.
      if (!this.demo || this.state !== null) {
        this.state = null;
        this.demo = true;
        this.wallHash = null;
        this.scoped = false;
        this.setHiderView(false);
        this.drawWall([{ id: 'demo-a', x: -0.25, y: 5.6 }, { id: 'demo-b', x: -4.8, y: 3.5 }, { id: 'demo-c', x: 3.1, y: 7.3 }]);
        this.applyTarget({ x: 0, y: 4.8, pose: 'stand' });
        this.rifle.visible = true;
      }
      return;
    }
    this.state = state;
    this.demo = false;
    const holes = state.holes || [];
    const hash = holes.map(h => `${h.id}:${h.x}:${h.y}`).join('|');
    if (hash !== this.wallHash) { this.wallHash = hash; this.drawWall(holes); }
    const hider = state.role === 'hider';
    this.setHiderView(hider);
    this.applyTarget(state.target || null);
    this.rifle.visible = !hider && !this.scoped;
  }

  setHiderView(hider) {
    if (hider !== this.hiderView) {
      this.hiderView = hider;
      this.wallMaterial.transparent = hider;
      this.wallMaterial.opacity = hider ? 0.25 : 1;
      this.wallMaterial.alphaTest = hider ? 0.04 : 0.35;
      this.wallMaterial.depthWrite = !hider;
      this.wallMaterial.needsUpdate = true;
    }
  }

  setAimPoint(x, y) {
    if (typeof x === 'object') { y = x.y; x = x.x; }
    if (Number.isFinite(x) && Number.isFinite(y)) this.aim = { x: clamp(x, -WALL.width / 2, WALL.width / 2), y: clamp(y, 0, WALL.height) };
  }
  setScoped(value) { this.scoped = !!value; }
  setAim() { /* The firing position is fixed; the aim is a point on the wall. */ }
  resize() {
    if (!this.renderer || !this.camera) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width || window.innerWidth);
    this.height = Math.max(1, rect.height || window.innerHeight);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;
    this.camera.position.z = Math.max(17.6, WALL.width * 0.56 / (Math.tan(THREE.MathUtils.degToRad(55 / 2)) * aspect));
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(0, WALL.height / 2, 0);
    this.camera.updateMatrixWorld();
    this.renderer.setSize(this.width, this.height, false);
  }
  pointerToWall(clientX, clientY) {
    if (!this.available) return null;
    const rect = this.canvas.getBoundingClientRect();
    const point = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(point, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.wallPlane, hit)) return null;
    if (Math.abs(hit.x) > WALL.width / 2 || hit.y < 0 || hit.y > WALL.height) return null;
    return { x: hit.x, y: hit.y };
  }
  projectWall(x, y) {
    this.camera.updateMatrixWorld();
    const p = new THREE.Vector3(x, y, 0).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * this.width + rect.left, y: (-p.y * 0.5 + 0.5) * this.height + rect.top, visible: Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1 };
  }
  getTargetScreen() {
    const target = this.state?.target;
    if (!target) return null;
    const head = getTargetParts(target).find(p => p.kind === 'head');
    return head ? this.projectWall(head.x, head.y) : null;
  }
  getDirection() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return { x: direction.x, y: direction.y, z: direction.z };
  }

  shot(event = {}) {
    if (!this.available) return;
    this.recoil = 1;
    const headshot = event.result === 'head' || !!event.headshot;
    const hit = event.result === 'body' || headshot || !!event.hit;
    let x = event.x ?? event.point?.x;
    let y = event.y ?? event.point?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = this.aim.x; y = this.aim.y; }
    const rng = seeded(Math.round(this.time * 1e4));
    const count = hit ? 20 : 13;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions.set([x, y, 0.15], i * 3);
      velocities.push(new THREE.Vector3((rng() - 0.5) * 3, rng() * 2.4, rng() * 2));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: headshot ? '#ffc37e' : '#dbc79a', size: 0.07, transparent: true, depthWrite: false });
    const points = new THREE.Points(geo, material);
    this.scene.add(points);
    this.effects.push({ mesh: points, life: 0.65, total: 0.65, velocities });
  }

  render(dt = 1 / 60) {
    if (!this.available) return;
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.recoil = Math.max(0, this.recoil - dt * 6.5);
    this.camera.fov = lerp(this.camera.fov, this.scoped ? 38 : 55, 1 - Math.exp(-dt * 17));
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.scoped ? this.aim.x : 0, this.scoped ? this.aim.y : WALL.height / 2, 0);
    this.rifle.visible = !this.hiderView && !this.scoped;
    this.rifle.position.y = -0.49 + Math.sin(this.time * 1.6) * 0.003 - this.recoil * 0.025;
    this.rifle.position.z = -0.9 + this.recoil * 0.08;
    this.rifle.rotation.x = this.recoil * 0.04;
    this.muzzleFlash.visible = this.recoil > 0.8 && !this.scoped;
    if (this.demo) this.applyTarget({ x: 0.1 + Math.sin(this.time * 0.6) * 0.25, y: 4.8, pose: 'stand' });
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      effect.mesh.material.opacity = Math.max(0, effect.life / effect.total);
      const pos = effect.mesh.geometry.attributes.position;
      for (let j = 0; j < effect.velocities.length; j++) {
        const v = effect.velocities[j];
        pos.setXYZ(j, pos.getX(j) + v.x * dt, pos.getY(j) + v.y * dt, pos.getZ(j) + v.z * dt);
        v.y -= 6 * dt;
      }
      pos.needsUpdate = true;
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls);
    this.canvas.dataset.triangles = String(this.renderer.info.render.triangles);
    // Own-head coordinates are exposed only to the hider, whose view already
    // shows that geometry. Hidden opponent positions never reach the DOM.
    const head = this.state?.role === 'hider' ? this.getTargetScreen() : null;
    if (head) {
      this.canvas.dataset.targetHeadX = head.x.toFixed(3);
      this.canvas.dataset.targetHeadY = head.y.toFixed(3);
    } else {
      delete this.canvas.dataset.targetHeadX;
      delete this.canvas.dataset.targetHeadY;
    }
  }

  dispose() {
    if (!this.scene) return;
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse(obj => {
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.wallTexture?.dispose();
    this.renderer.dispose();
    this.available = false;
  }
}

export { DuelScene as SniperScene };
