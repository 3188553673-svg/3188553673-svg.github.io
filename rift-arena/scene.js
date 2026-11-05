import * as THREE from './vendor/three.module.js';
import { FrameBudget } from './scene-performance.js?v=perf2';
import { MovementPredictor } from './client-movement.js?v=perf2';
import { hasHeroAsset, loadHeroModel } from './hero-assets.js?v=perf2';

const TEAM = [0x47d9ed, 0xf16c80];
const CHAMPION = { garen: 0x65a8da, ashe: 0x96e7ff, lux: 0xf6cf73, yi: 0x94d382 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const angleLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** Original, procedural 3D arena. All match positions and effects come from the server. */
export class ArenaScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.available = false;
    this.error = null;
    this.entities = new Map();
    this.projectiles = new Map();
    this.effects = new Map();
    this.localEffects = [];
    this.floaters = [];
    this.seenEvents = new Set();
    this.materials = new Map();
    this.geometries = new Map();
    this.textures = new Set();
    this.clock = 0;
    this.lastSnapshot = 0;
    this.snapshotTime = 0;
    this.motionSampleSeen = false;
    this.motionTick = -1;
    this.predictor = new MovementPredictor();
    this.frameBudget = new FrameBudget(window.devicePixelRatio || 1);
    this.performance = this.frameBudget.metrics;
    this.assetStatus = {};
    this.previewAssetRequest = 0;
    this.actorBatchGeometries = new Map();
    this.state = null;
    this.selfId = null;
    this.selfTeam = 0;
    this.locked = true;
    this.zoom = 13;
    this.focus = new THREE.Vector3(0, 0.7, 0);
    this.focusTarget = this.focus.clone();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);
    this.pointer = new THREE.Vector2();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.88);
    this.pickTargets = [];
    this.previewChampion = 'garen';
    this.disposed = false;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(this.frameBudget.ratio);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.22;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x11232d);
      this.scene.fog = new THREE.FogExp2(0x132d36, 0.009);
      this.camera = new THREE.OrthographicCamera(-28, 28, 18, -18, 0.1, 220);
      this.camera.position.set(0, 31, 25);
      this.scene.add(new THREE.HemisphereLight(0xb9e8ee, 0x354039, 1.65));
      const sun = new THREE.DirectionalLight(0xffe9c4, 2.4);
      sun.position.set(-18, 42, 25);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 28, bottom: -28, near: 1, far: 110 });
      sun.shadow.normalBias = 0.035;
      sun.shadow.bias = -0.0002;
      this.scene.add(sun);
      const rim = new THREE.DirectionalLight(0x62c8ee, 0.9);
      rim.position.set(12, 12, -28);
      this.scene.add(rim);
      this.world = new THREE.Group();
      this.actors = new THREE.Group();
      this.fxLayer = new THREE.Group();
      this.scene.add(this.world, this.actors, this.fxLayer);
      this.buildWorld();
      this.batchStaticScenery();
      this.buildAim();
      this.buildPreview();
      this.onResize = () => this.resize();
      this.onWheel = e => { e.preventDefault(); this.zoom = clamp(this.zoom + e.deltaY * 0.012, 9, 24); this.resize(); };
      this.onPanStart = e => { if (e.button === 1) { this.dragCamera = { x: e.clientX, y: e.clientY }; this.locked = false; e.preventDefault(); } };
      this.onPanMove = e => { if (!this.dragCamera) return; this.focusTarget.x -= (e.clientX - this.dragCamera.x) * this.zoom / 300; this.focusTarget.z -= (e.clientY - this.dragCamera.y) * this.zoom / 260; this.focusTarget.x = clamp(this.focusTarget.x, -35, 35); this.focusTarget.z = clamp(this.focusTarget.z, -8, 8); this.dragCamera = { x: e.clientX, y: e.clientY }; };
      this.onPanEnd = () => { this.dragCamera = null; };
      window.addEventListener('resize', this.onResize);
      canvas.addEventListener('wheel', this.onWheel, { passive: false });
      canvas.addEventListener('pointerdown', this.onPanStart);
      window.addEventListener('pointermove', this.onPanMove);
      window.addEventListener('pointerup', this.onPanEnd);
      this.resize();
      this.available = true;
      this.render(0);
    } catch (error) { this.error = error; this.dispose(); }
  }

  geometry(kind, ...args) {
    const key = `${kind}:${args.join(',')}`;
    if (!this.geometries.has(key)) {
      const Constructors = { box: THREE.BoxGeometry, sphere: THREE.SphereGeometry, cylinder: THREE.CylinderGeometry, cone: THREE.ConeGeometry, torus: THREE.TorusGeometry, ring: THREE.RingGeometry, circle: THREE.CircleGeometry, octa: THREE.OctahedronGeometry, plane: THREE.PlaneGeometry, ico: THREE.IcosahedronGeometry };
      this.geometries.set(key, new Constructors[kind](...args));
    }
    return this.geometries.get(key);
  }

  material(color, glow = 0, opacity = 1, metalness = 0.15) {
    const key = `${color}:${glow}:${opacity}:${metalness}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness, flatShading: true, emissive: color, emissiveIntensity: glow, transparent: opacity < 1, opacity, depthWrite: opacity >= 0.65, side: THREE.DoubleSide }));
    return this.materials.get(key);
  }

  mesh(parent, kind, args, color, position = [0, 0, 0], rotation = [0, 0, 0], options = {}) {
    const object = new THREE.Mesh(this.geometry(kind, ...args), this.material(color, options.glow || 0, options.opacity ?? 1, options.metalness ?? 0.15));
    object.position.set(...position); object.rotation.set(...rotation);
    object.castShadow = options.shadow !== false && (options.opacity ?? 1) > 0.65;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  ring(parent, radius, color, y = 0.93, thickness = 0.06, opacity = 1) {
    return this.mesh(parent, 'ring', [Math.max(0.01, radius - thickness), radius, 48], color, [0, y, 0], [-Math.PI / 2, 0, 0], { glow: 0.6, opacity, shadow: false });
  }

  buildWorld() {
    const random = rng(80713);
    // Deep river, softly scrolling hand-painted ripples, and distant banks.
    const waterCanvas = document.createElement('canvas'); waterCanvas.width = waterCanvas.height = 256;
    const wc = waterCanvas.getContext('2d');
    wc.fillStyle = '#123e49'; wc.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 120; n++) { const x = random() * 256, y = random() * 256; wc.strokeStyle = `rgba(104,184,184,${0.03 + random() * 0.1})`; wc.lineWidth = 1 + random() * 2; wc.beginPath(); wc.ellipse(x, y, 9 + random() * 20, 2 + random() * 4, -0.35, 0, Math.PI * 1.7); wc.stroke(); }
    this.waterTexture = new THREE.CanvasTexture(waterCanvas); this.waterTexture.wrapS = this.waterTexture.wrapT = THREE.RepeatWrapping; this.waterTexture.repeat.set(12, 10); this.waterTexture.colorSpace = THREE.SRGBColorSpace; this.textures.add(this.waterTexture);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x517e82, map: this.waterTexture, roughness: 0.28, metalness: 0.6 });
    this.waterMaterial = waterMat;
    const water = new THREE.Mesh(this.geometry('plane', 210, 180), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = -4.9; this.world.add(water);
    this.mesh(this.world, 'box', [83, 1.5, 17], 0x374b4e, [0, -0.05, 0]);
    // Hundreds of individual pavers in one GPU draw call.
    const tileGeometry = this.geometry('box', 2.43, 0.3, 2.43), tileMat = this.material(0x75817b, 0, 1, 0.05);
    const pavers = new THREE.InstancedMesh(tileGeometry, tileMat, 32 * 6); pavers.receiveShadow = true;
    const dummy = new THREE.Object3D(), tone = new THREE.Color(); let count = 0;
    for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) { dummy.position.set(-38.75 + i * 2.5, 0.65 + random() * 0.025, -6.25 + j * 2.5); dummy.rotation.y = (random() - 0.5) * 0.015; dummy.updateMatrix(); pavers.setMatrixAt(count, dummy.matrix); tone.setHSL(0.16 + random() * 0.025, 0.09, 0.36 + random() * 0.09); pavers.setColorAt(count++, tone); }
    this.world.add(pavers);
    for (const z of [-7.8, 7.8]) {
      this.mesh(this.world, 'box', [82, 0.45, 0.48], 0x9c9c83, [0, 0.95, z]);
      this.mesh(this.world, 'box', [80, 0.12, 0.11], 0xb5a675, [0, 1.22, z]);
    }
    // Heavy bridge piers, stone parapets, rune lamps and arched buttresses.
    for (const x of [-36, -24, -12, 0, 12, 24, 36]) {
      for (const z of [-7.8, 7.8]) {
        this.mesh(this.world, 'box', [1.35, 5.8, 1.55], 0x344c51, [x, -2.1, z]);
        this.mesh(this.world, 'box', [1.8, 0.4, 1.95], 0x8c968a, [x, 1.25, z]);
        this.mesh(this.world, 'box', [0.92, 1.7, 0.92], 0x4d6666, [x, 2.15, z]);
        this.mesh(this.world, 'box', [1.25, 0.2, 1.25], 0xa9a18a, [x, 3.1, z]);
        this.mesh(this.world, 'octa', [0.34], x <= 0 ? TEAM[0] : TEAM[1], [x, 3.55, z], [0, 0.3, 0], { glow: 1.3 });
        this.ring(this.world, 0.65, x <= 0 ? TEAM[0] : TEAM[1], 1.5, 0.07, 0.3).position.set(x, 1.5, z);
      }
    }
    for (const z of [-5.1, 5.1]) for (let x = -32; x <= 32; x += 8) {
      const tile = this.mesh(this.world, 'box', [1.15, 0.025, 1.15], 0xbba66b, [x, 0.83, z], [0, Math.PI / 4, 0], { glow: 0.04, shadow: false });
      tile.scale.z = 0.35;
    }
    const middle = new THREE.Group(); this.world.add(middle);
    this.ring(middle, 3.0, 0xc8b785, 0.84, 0.11, 0.58); this.ring(middle, 2.45, 0x78928d, 0.85, 0.035, 0.7);
    for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; this.mesh(middle, 'box', [0.38, 0.025, 0.38], 0xc1b27b, [Math.cos(a) * 2.7, 0.85, Math.sin(a) * 2.7], [0, a, 0], { glow: 0.1, shadow: false }); }
    // Team fountains remain visible even while their nexus is destroyed.
    for (let team = 0; team < 2; team++) {
      const x = team ? 34 : -34, fountain = new THREE.Group(); fountain.position.x = x; this.world.add(fountain);
      this.mesh(fountain, 'cylinder', [4.5, 4.8, 0.22, 12], 0x657974, [0, 0.85, 0]);
      this.ring(fountain, 4.1, TEAM[team], 0.98, 0.11, 0.65); this.ring(fountain, 3.6, TEAM[team], 1.0, 0.035, 0.35);
      for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3; this.mesh(fountain, 'box', [0.5, 0.03, 0.5], TEAM[team], [Math.cos(a) * 3.85, 1.01, Math.sin(a) * 3.85], [0, a, 0], { glow: 0.8, shadow: false }); }
    }
    // Mossy river banks, evergreen groves, exposed faceted stone.
    const bankGeo = this.geometry('ico', 1, 0), bankMat = this.material(0x2f4c4b, 0, 1, 0);
    const rocks = new THREE.InstancedMesh(bankGeo, bankMat, 100), trunks = new THREE.InstancedMesh(this.geometry('cylinder', 0.17, 0.28, 2.1, 5), this.material(0x4b4940), 90), trees = new THREE.InstancedMesh(this.geometry('cone', 1.6, 5.2, 6), this.material(0x214b49), 90);
    for (let n = 0; n < 100; n++) { const side = n % 2 ? 1 : -1, x = (random() - 0.5) * 118, z = side * (15 + random() * 23); dummy.position.set(x, -3.8, z); dummy.rotation.set(random() * 0.3, random() * 7, random() * 0.4); dummy.scale.set(3 + random() * 4, 3 + random() * 4, 2 + random() * 4); dummy.updateMatrix(); rocks.setMatrixAt(n, dummy.matrix); }
    for (let n = 0; n < 90; n++) { const side = n % 2 ? 1 : -1; dummy.position.set((random() - 0.5) * 115, -0.4, side * (20 + random() * 28)); dummy.rotation.set(0, random() * 6, 0); const s = 0.7 + random() * 0.75; dummy.scale.setScalar(s); dummy.updateMatrix(); trunks.setMatrixAt(n, dummy.matrix); dummy.position.y += 2.15 * s; dummy.updateMatrix(); trees.setMatrixAt(n, dummy.matrix); }
    rocks.castShadow = trees.castShadow = true; this.world.add(rocks, trunks, trees);
    this.buildBush(-10, -6, random); this.buildBush(10, 6, random);
    const dust = new Float32Array(110 * 3);
    for (let n = 0; n < 110; n++) { dust[n * 3] = (random() - 0.5) * 90; dust[n * 3 + 1] = random() * 10 + 1; dust[n * 3 + 2] = (random() - 0.5) * 35; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3)); this.dustGeometry = dustGeo;
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xc5e5df, size: 0.065, transparent: true, opacity: 0.5, depthWrite: false })); this.world.add(this.dust);
  }

  buildBush(x, z, random) {
    const patch = this.mesh(this.world, 'circle', [2.65, 24], 0x364f40, [x, 0.88, z], [-Math.PI / 2, 0, 0], { shadow: false }); patch.scale.y = 0.75;
    const blades = new THREE.InstancedMesh(this.geometry('cone', 0.18, 1.15, 4), this.material(0x78936a), 90), dummy = new THREE.Object3D();
    for (let n = 0; n < 90; n++) { const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 2.6; dummy.position.set(x + Math.cos(a) * r, 1.25 + random() * 0.25, z + Math.sin(a) * r * 0.6); dummy.rotation.set((random() - 0.5) * 0.4, random() * 6, (random() - 0.5) * 0.4); dummy.scale.set(1, 0.75 + random() * 0.55, 1); dummy.updateMatrix(); blades.setMatrixAt(n, dummy.matrix); }
    blades.castShadow = true; this.world.add(blades);
  }

  batchStaticScenery() {
    // Merge unmoving stonework by material while keeping foliage instanced.
    this.world.updateMatrixWorld(true);
    this.mergedGeometries = [];
    const groups = new Map();
    this.world.traverse(object => {
      if (!object.isMesh || object.isInstancedMesh || object.material.transparent || !object.geometry.attributes.position || !object.geometry.attributes.normal) return;
      const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(object);
    });
    const vertex = new THREE.Vector3(), normal = new THREE.Vector3();
    for (const meshes of groups.values()) {
      if (meshes.length < 3) continue;
      const positions = [], normals = [], uvs = [];
      for (const object of meshes) {
        const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
        const pos = source.attributes.position, nor = source.attributes.normal, uv = source.attributes.uv, normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          vertex.fromBufferAttribute(pos, i).applyMatrix4(object.matrixWorld); normal.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
          positions.push(vertex.x, vertex.y, vertex.z); normals.push(normal.x, normal.y, normal.z); uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
        }
        if (source !== object.geometry) source.dispose();
        object.removeFromParent();
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, meshes[0].material); mesh.castShadow = meshes[0].castShadow; mesh.receiveShadow = meshes[0].receiveShadow; this.world.add(mesh); this.mergedGeometries.push(geometry);
    }
  }

  humanoid(champion = 'garen', team = 0, minion = false) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const colors = { skin: 0xd7ac83, steel: 0x9aabb2, gold: 0xcbb16b, dark: 0x26363d, cloth: CHAMPION[champion] || TEAM[team] };
    const limbs = {}, height = minion ? 0.82 : 1;
    const torsoColor = minion ? (team ? 0xa64f60 : 0x397b95) : champion === 'yi' ? 0x487844 : champion === 'lux' ? 0xddd7b6 : champion === 'ashe' ? 0x3f7e9c : 0x536b83;
    this.mesh(body, 'box', [0.78, 0.79, 0.45], torsoColor, [0, 1.16, 0]);
    this.mesh(body, 'box', [0.77, 0.16, 0.5], colors.gold, [0, 0.77, 0.02]);
    this.mesh(body, 'sphere', [0.33, 8, 6], colors.skin, [0, 1.85, 0.02]);
    const hair = champion === 'ashe' ? 0xdde9e6 : champion === 'lux' ? 0xe1bd60 : champion === 'yi' ? 0x28352e : 0x433c35;
    this.mesh(body, 'sphere', [0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.58], hair, [0, 1.94, 0]);
    this.mesh(body, 'box', [0.26, 0.065, 0.04], champion === 'yi' ? 0xe1db64 : 0x5b6367, [0, 1.87, 0.315], [0, 0, 0], { glow: champion === 'yi' ? 0.7 : 0 });
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * 0.5, 1.43, 0); body.add(arm);
      this.mesh(arm, 'box', [0.3, 0.59, 0.3], torsoColor, [0, -0.23, 0]);
      this.mesh(arm, 'box', [0.31, 0.23, 0.33], colors.steel, [0, -0.55, 0]);
      this.mesh(arm, 'sphere', [0.16, 6, 5], colors.skin, [0, -0.71, 0]);
      const leg = new THREE.Group(); leg.position.set(side * 0.22, 0.74, 0); body.add(leg);
      this.mesh(leg, 'box', [0.3, 0.5, 0.3], colors.dark, [0, -0.22, 0]);
      this.mesh(leg, 'box', [0.34, 0.26, 0.48], champion === 'lux' ? colors.steel : colors.dark, [0, -0.54, 0.09]);
      limbs[side === -1 ? 'leftArm' : 'rightArm'] = arm; limbs[side === -1 ? 'leftLeg' : 'rightLeg'] = leg;
    }
    if (champion === 'garen' || minion) {
      this.mesh(body, 'sphere', [0.38, 6, 5], colors.gold, [-0.53, 1.47, 0]); this.mesh(body, 'sphere', [0.38, 6, 5], colors.gold, [0.53, 1.47, 0]);
      this.mesh(body, 'box', [0.58, 0.48, 0.09], 0x7294b0, [0, 1.19, 0.28]);
      const cape = this.mesh(body, 'box', [0.9, 1.2, 0.08], 0x254e74, [0, 0.97, -0.32], [-0.15, 0, 0]); limbs.cape = cape;
      const sword = new THREE.Group(); sword.position.set(0, -0.65, 0.15); limbs.rightArm.add(sword);
      this.mesh(sword, 'box', [0.24, 1.63, 0.095], 0xcad6d8, [0, 0.94, 0], [0, 0, 0], { metalness: 0.8 });
      this.mesh(sword, 'cone', [0.175, 0.39, 4], 0xe5eddd, [0, 1.93, 0], [0, Math.PI / 4, 0]);
      this.mesh(sword, 'box', [0.7, 0.13, 0.2], colors.gold, [0, 0.12, 0]); this.mesh(sword, 'cylinder', [0.07, 0.07, 0.4, 6], 0x4c4c4b, [0, -0.12, 0]);
      limbs.rightArm.rotation.z = -0.25;
      if (minion) { body.scale.setScalar(0.63); this.mesh(body, 'cone', [0.4, 0.38, 6], TEAM[team], [0, 2.23, 0]); }
    } else if (champion === 'ashe') {
      this.mesh(body, 'cone', [0.58, 1.0, 6], 0x396b89, [0, 0.72, -0.16], [0.06, 0, 0]);
      this.mesh(body, 'cone', [0.43, 0.52, 6], 0x426b83, [0, 2.15, -0.05]);
      const bow = new THREE.Group(); bow.position.set(0, -0.52, 0.27); limbs.leftArm.add(bow);
      this.mesh(bow, 'torus', [0.78, 0.055, 4, 20, Math.PI], 0x9be5eb, [0, 0, 0], [0, Math.PI / 2, -Math.PI / 2], { glow: 0.4, metalness: 0.6 });
      this.mesh(bow, 'cylinder', [0.012, 0.012, 1.56, 4], 0xe6efeb, [0, 0, 0.04]);
      for (const y of [-0.7, 0.7]) this.mesh(bow, 'octa', [0.17], 0xbaf4f0, [0, y, 0.02], [0, 0, 0], { glow: 0.7 });
      this.mesh(body, 'cylinder', [0.16, 0.18, 0.88, 6], 0x384d56, [0.32, 1.27, -0.43], [0, 0, -0.3]);
      this.mesh(body, 'box', [0.66, 1.12, 0.075], 0x72a6ba, [0, 1.12, -0.3], [-0.17, 0, 0]);
      limbs.leftArm.rotation.x = -0.42; limbs.leftArm.rotation.z = 0.22;
    } else if (champion === 'lux') {
      this.mesh(body, 'cone', [0.58, 0.85, 8], 0x465a8c, [0, 0.69, 0]);
      this.mesh(body, 'sphere', [0.28, 6, 5], colors.gold, [-0.51, 1.47, 0]); this.mesh(body, 'sphere', [0.28, 6, 5], colors.gold, [0.51, 1.47, 0]);
      this.mesh(body, 'box', [0.22, 0.66, 0.12], 0xf4e4b3, [0, 1.13, 0.28]);
      this.mesh(body, 'cone', [0.3, 0.7, 7], 0xdac87b, [0, 1.75, -0.27], [0.2, 0, 0]);
      const staff = new THREE.Group(); staff.position.set(0, -0.7, 0.1); limbs.rightArm.add(staff);
      this.mesh(staff, 'cylinder', [0.045, 0.06, 2.25, 6], 0xb7b3ad, [0, 0.65, 0]);
      this.mesh(staff, 'torus', [0.32, 0.065, 5, 16], colors.gold, [0, 1.97, 0]);
      this.mesh(staff, 'octa', [0.25], 0xbfeaff, [0, 1.97, 0], [0, 0.5, 0], { glow: 1.5 });
      limbs.staff = staff; limbs.rightArm.rotation.z = -0.23;
    } else {
      this.mesh(body, 'cone', [0.4, 0.5, 5], 0x648048, [0, 2.17, -0.05]);
      const visor = this.mesh(body, 'box', [0.69, 0.23, 0.16], 0x978d4b, [0, 1.94, 0.28]);
      for (const x of [-0.22, 0, 0.22]) this.mesh(body, 'sphere', [0.055, 6, 4], 0xc1efa1, [x, 1.94, 0.385], [0, 0, 0], { glow: 1.5 });
      this.mesh(body, 'box', [0.84, 0.15, 0.6], 0x9b965f, [0, 1.5, 0]);
      const sword = new THREE.Group(); sword.position.set(0, -0.64, 0.15); limbs.rightArm.add(sword);
      this.mesh(sword, 'box', [0.12, 1.9, 0.065], 0xd8e1c8, [0, 0.9, 0], [0, 0, -0.1], { metalness: 0.8 });
      this.mesh(sword, 'box', [0.44, 0.09, 0.15], 0x9dbf72, [0, -0.05, 0]);
      limbs.rightArm.rotation.z = -0.58; limbs.leftArm.rotation.x = -0.35; limbs.visor = visor;
    }
    root.userData = { body, limbs, champion, minion, baseArm: [limbs.leftArm.rotation.x, limbs.rightArm.rotation.z] };
    root.scale.multiplyScalar(height);
    return root;
  }

  casterMinion(team) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    this.mesh(body, 'cone', [0.43, 0.9, 7], team ? 0x985166 : 0x3e758f, [0, 0.65, 0]);
    this.mesh(body, 'sphere', [0.22, 7, 5], 0xc2b69b, [0, 1.32, 0.03]);
    this.mesh(body, 'cone', [0.32, 0.46, 6], team ? 0x9f5f7c : 0x5b92ac, [0, 1.63, -0.04]);
    this.mesh(body, 'box', [0.12, 0.05, 0.04], 0xe1eacf, [0, 1.34, 0.24], [0, 0, 0], { glow: 0.8 });
    this.mesh(body, 'cylinder', [0.045, 0.045, 1.35, 5], 0x8f8767, [0.43, 0.82, 0.1]);
    this.mesh(body, 'octa', [0.18], TEAM[team], [0.43, 1.65, 0.1], [0, 0, 0], { glow: 1 });
    root.userData = { body, limbs: {}, champion: 'caster', minion: true }; this.batchMinionParts(root, `caster:${team}`); return root;
  }

  meleeMinion(team) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const armor = team ? 0xa85a6b : 0x4f8299, limbs = {};
    this.mesh(body, 'box', [0.55, 0.55, 0.4], armor, [0, 0.83, 0]);
    this.mesh(body, 'sphere', [0.24, 6, 5], 0xbdb292, [0, 1.32, 0.03]);
    this.mesh(body, 'cone', [0.32, 0.33, 5], armor, [0, 1.62, 0]);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.17, 0.55, 0); body.add(leg); this.mesh(leg, 'box', [0.22, 0.5, 0.3], 0x2a3f46, [0, -0.2, 0.05]); limbs[side < 0 ? 'leftLeg' : 'rightLeg'] = leg;
      const arm = new THREE.Group(); arm.position.set(side * 0.37, 1, 0); body.add(arm); this.mesh(arm, 'box', [0.18, 0.48, 0.2], armor, [0, -0.2, 0]); limbs[side < 0 ? 'leftArm' : 'rightArm'] = arm;
    }
    this.mesh(limbs.leftArm, 'box', [0.38, 0.48, 0.12], 0xbaa56f, [0, -0.25, 0.22]);
    this.mesh(limbs.rightArm, 'box', [0.11, 0.78, 0.07], 0xc7d5d2, [0, 0.05, 0.15]);
    root.userData = { body, limbs, champion: 'melee', minion: true }; this.batchMinionParts(root, `melee:${team}`); return root;
  }

  // Preserve limb animation and vertex colors; merge only rigid siblings.
  batchMinionParts(root, cachePrefix) {
    let groupIndex = 0;
    root.traverse(parent => {
      const index = groupIndex++, groups = new Map();
      for (const mesh of parent.children) {
        if (!mesh.isMesh || mesh.isInstancedMesh || mesh.material.transparent || mesh.material.emissiveIntensity > 0) continue;
        const key = `${mesh.material.metalness}:${mesh.material.roughness}:${mesh.material.side}`;
        if (!groups.has(key)) groups.set(key, []); groups.get(key).push(mesh);
      }
      for (const [materialKey, meshes] of groups) {
        if (meshes.length < 2) continue;
        const key = `${cachePrefix}:${index}:${materialKey}`;
        let geometry = this.actorBatchGeometries.get(key);
        if (!geometry) {
          const positions = [], normals = [], colors = [], v = new THREE.Vector3(), n = new THREE.Vector3();
          for (const mesh of meshes) {
            mesh.updateMatrix(); const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrix), pos = source.attributes.position, nor = source.attributes.normal, color = mesh.material.color;
            for (let i = 0; i < pos.count; i++) {
              v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix); n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
              positions.push(v.x, v.y, v.z); normals.push(n.x, n.y, n.z); colors.push(color.r, color.g, color.b);
            }
            if (source !== mesh.geometry) source.dispose();
          }
          geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeBoundingSphere();
          this.actorBatchGeometries.set(key, geometry);
        }
        const materialCacheKey = `minion-batch:${materialKey}`;
        let material = this.materials.get(materialCacheKey);
        if (!material) { material = meshes[0].material.clone(); material.color.set(0xffffff); material.vertexColors = true; this.materials.set(materialCacheKey, material); }
        const merged = new THREE.Mesh(geometry, material); merged.receiveShadow = true; merged.castShadow = false;
        for (const mesh of meshes) parent.remove(mesh); parent.add(merged);
      }
    });
    root.traverse(object => { if (object.isMesh) object.castShadow = false; });
  }

  structure(kind, team) {
    const root = new THREE.Group(), body = new THREE.Group(), ruins = new THREE.Group(); root.add(body, ruins); ruins.visible = false;
    const color = TEAM[team];
    this.mesh(body, 'cylinder', [kind === 'tower' ? 1.65 : 2.5, kind === 'tower' ? 1.9 : 2.9, 0.45, 8], 0x68797a, [0, 0.2, 0]);
    this.mesh(body, 'cylinder', [kind === 'tower' ? 1.25 : 2.0, kind === 'tower' ? 1.4 : 2.3, 0.35, 8], 0xb1aa8b, [0, 0.6, 0]);
    if (kind === 'tower') {
      this.mesh(body, 'cylinder', [0.75, 1.05, 3.2, 7], 0x65787b, [0, 2.1, 0]);
      for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; this.mesh(body, 'box', [0.35, 2.4, 0.35], 0xa29e82, [Math.cos(a) * 0.82, 2.3, Math.sin(a) * 0.82], [0, a, 0]); }
      this.mesh(body, 'cylinder', [1.25, 0.9, 0.35, 8], 0xb9aa84, [0, 3.9, 0]);
      this.mesh(body, 'torus', [0.92, 0.11, 5, 20], 0xc5b584, [0, 4.25, 0], [Math.PI / 2, 0, 0]);
      const crystal = this.mesh(body, 'octa', [0.85], color, [0, 4.8, 0], [0, Math.PI / 4, 0], { glow: 0.85, metalness: 0.55 }); crystal.scale.y = 1.5;
      root.userData.crystal = crystal;
    } else {
      for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; this.mesh(body, 'cone', [0.7, 1.7, 4], 0x8b9185, [Math.cos(a) * 1.65, 1.4, Math.sin(a) * 1.65], [0, -a, 0.2]); }
      const crystal = this.mesh(body, 'octa', [1.6], color, [0, 3.1, 0], [0, 0.4, 0], { glow: 0.65, metalness: 0.6 }); crystal.scale.y = 1.65; root.userData.crystal = crystal;
      this.ring(body, 2.25, color, 0.9, 0.08, 0.6);
    }
    for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; this.mesh(ruins, 'ico', [0.75, 0], 0x687575, [Math.cos(a) * (n % 3 + 0.4), 0.35, Math.sin(a) * (n % 2 + 0.6)], [a, a / 2, 0]); }
    root.userData = { ...root.userData, body, ruins, kind }; return root;
  }

  makeLabel(kind) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = kind === 'hero' ? 76 : 40;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; this.textures.add(texture);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    const width = kind === 'hero' ? 4.2 : kind === 'minion' ? 1.6 : 4.8;
    sprite.scale.set(width, width * canvas.height / canvas.width, 1);
    sprite.position.y = kind === 'hero' ? 3.0 : kind === 'minion' ? 2.0 : 6.5;
    return { canvas, texture, material, sprite, key: '' };
  }

  updateLabel(entry, unit) {
    const label = entry.label, self = unit.id === this.selfId, friendly = unit.team === this.selfTeam;
    const hp = clamp(finite(unit.hp) / Math.max(1, finite(unit.maxHp, 1)), 0, 1), mana = clamp(finite(unit.mana) / Math.max(1, finite(unit.maxMana, 1)), 0, 1);
    const key = `${Math.round(hp * 256)}:${Math.round(mana * 256)}:${unit.name || ''}:${unit.level || ''}:${self}:${friendly}:${unit.invulnerable}`;
    if (label.key === key) return; label.key = key;
    const ctx = label.canvas.getContext('2d'), h = label.canvas.height; ctx.clearRect(0, 0, 256, h);
    const hero = unit.kind === 'hero', y = hero ? 32 : 10, margin = hero ? 26 : 12;
    if (hero) { ctx.font = '600 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#12212b'; ctx.strokeText(`${unit.name || unit.champion || ''}`, 128, 23, 240); ctx.fillStyle = self ? '#f2e2ad' : '#f2f6f1'; ctx.fillText(`${unit.name || unit.champion || ''}`, 128, 23, 240); }
    ctx.fillStyle = '#091821'; ctx.fillRect(margin - 3, y - 3, 256 - margin * 2 + 6, hero ? 26 : 19);
    ctx.fillStyle = '#213239'; ctx.fillRect(margin, y, 256 - margin * 2, 13);
    ctx.fillStyle = self ? '#91d88b' : friendly ? '#59b9cc' : '#e26879'; ctx.fillRect(margin, y, (256 - margin * 2) * hp, 13);
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; for (let n = 1; n < 5; n++) { const x = margin + (256 - margin * 2) * n / 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 13); ctx.stroke(); }
    if (hero) { ctx.fillStyle = '#183548'; ctx.fillRect(margin, y + 15, 256 - margin * 2, 5); ctx.fillStyle = '#5ea7db'; ctx.fillRect(margin, y + 15, (256 - margin * 2) * mana, 5); ctx.fillStyle = '#172b33'; ctx.beginPath(); ctx.arc(14, y + 8, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e7d39b'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText(String(unit.level || 1), 14, y + 14); }
    if (unit.invulnerable) { ctx.fillStyle = '#bde4eb'; ctx.font = 'bold 17px system-ui'; ctx.textAlign = 'center'; ctx.fillText('◆', 128, y + 11); }
    label.texture.needsUpdate = true;
  }

  createEntity(unit) {
    const kind = unit.kind || 'hero';
    const model = kind === 'hero' ? this.humanoid(unit.champion, unit.team) : kind === 'minion' ? unit.minionType === 'caster' ? this.casterMinion(unit.team) : this.meleeMinion(unit.team) : this.structure(kind, unit.team);
    const group = new THREE.Group(); group.position.set(finite(unit.x), 0.9, finite(unit.z)); group.add(model); this.actors.add(group);
    const label = this.makeLabel(kind); group.add(label.sprite);
    if (kind === 'nexus') label.sprite.position.y = 6;
    const radius = kind === 'hero' ? 0.88 : kind === 'minion' ? 0.58 : kind === 'tower' ? 1.65 : 2.2;
    const teamRing = this.ring(group, radius, TEAM[unit.team] || TEAM[0], 0.05, kind === 'hero' ? 0.075 : 0.035, kind === 'hero' ? 0.8 : 0.35);
    const selfRing = kind === 'hero' ? this.ring(group, 1.08, 0xf2d88e, 0.06, 0.05, 0.9) : null;
    const shield = kind === 'hero' ? this.mesh(group, 'sphere', [1.18, 14, 10], 0x81ddeb, [0, 1.2, 0], [0, 0, 0], { glow: 0.55, opacity: 0.16, shadow: false }) : null;
    if (shield) { shield.scale.y = 1.3; shield.visible = false; }
    const recall = new THREE.Group(); group.add(recall); recall.visible = false; for (let i = 0; i < 3; i++) this.ring(recall, 1.2 - i * 0.08, 0x7ec5ed, i * 0.7 + 0.08, 0.04, 0.65);
    const pick = new THREE.Mesh(this.geometry('cylinder', radius, radius, kind === 'hero' ? 2.6 : kind === 'minion' ? 1.7 : 5.5, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    // Raycast on a separate layer: zero-opacity pick volumes still cost a draw call.
    pick.layers.set(1);
    pick.position.y = kind === 'hero' ? 1.3 : kind === 'minion' ? 0.9 : 2.7; pick.userData.entityId = unit.id; group.add(pick); this.pickTargets.push(pick);
    const entry = { group, model, label, teamRing, selfRing, shield, recall, pick, data: unit, tx: finite(unit.x), tz: finite(unit.z), px: finite(unit.x), pz: finite(unit.z), vx: 0, vz: 0, angle: 0, swing: -100, phase: Math.random() * 6 };
    this.entities.set(unit.id, entry); this.updateLabel(entry, { ...unit, kind });
    if (kind === 'hero') this.requestEntityAsset(entry);
    return entry;
  }

  requestEntityAsset(entry) {
    const champion = entry.data.champion;
    if (!hasHeroAsset(champion)) { this.assetStatus[champion] = { status: 'unconfigured' }; return; }
    this.assetStatus[champion] = { status: 'loading' };
    loadHeroModel(champion).then(asset => {
      if (this.disposed || this.entities.get(entry.data.id) !== entry) { asset.dispose(); return; }
      const model = new THREE.Group(); model.add(asset.root); model.rotation.y = entry.angle;
      entry.group.remove(entry.model); entry.model = model; entry.group.add(model); entry.asset = asset;
      asset.play('idle'); this.assetStatus[champion] = { status: 'loaded', clips: asset.clips.length };
    }).catch(error => { this.assetStatus[champion] = { status: 'error', message: error.message }; });
  }

  removeEntity(id) {
    const entry = this.entities.get(id); if (!entry) return;
    entry.asset?.dispose();
    this.actors.remove(entry.group); this.pickTargets = this.pickTargets.filter(mesh => mesh !== entry.pick);
    entry.pick.material.dispose(); entry.label.texture.dispose(); this.textures.delete(entry.label.texture); entry.label.material.dispose();
    this.entities.delete(id);
  }

  buildPreview() {
    this.preview = new THREE.Group(); this.preview.position.set(6, 0.92, 0); this.actors.add(this.preview);
    this.previewCircle = this.ring(this.preview, 3.2, 0x84cbd1, 0.01, 0.045, 0.7);
    this.setPreviewChampion(this.previewChampion);
  }

  setPreviewChampion(champion) {
    if (!CHAMPION[champion]) return;
    if (this.previewChampion === champion && this.previewModel) return;
    this.previewChampion = champion;
    if (!this.preview) return;
    const request = ++this.previewAssetRequest;
    this.previewAsset?.dispose(); this.previewAsset = null;
    if (this.previewModel) this.preview.remove(this.previewModel);
    this.previewModel = this.humanoid(champion, 0); this.previewModel.scale.setScalar(2.1); this.previewModel.rotation.y = -0.2; this.preview.add(this.previewModel);
    if (this.previewCircle) this.previewCircle.material = this.material(CHAMPION[champion], 0.6, 0.7);
    if (!hasHeroAsset(champion)) { this.assetStatus[champion] = { status: 'unconfigured' }; return; }
    this.assetStatus[champion] = { status: 'loading' };
    loadHeroModel(champion).then(asset => {
      if (this.disposed || request !== this.previewAssetRequest) { asset.dispose(); return; }
      const model = new THREE.Group(); model.add(asset.root); model.scale.setScalar(2.1); model.rotation.y = -.2;
      this.preview.remove(this.previewModel); this.previewModel = model; this.preview.add(model); this.previewAsset = asset;
      asset.play('idle'); this.assetStatus[champion] = { status: 'loaded', clips: asset.clips.length };
    }).catch(error => { this.assetStatus[champion] = { status: 'error', message: error.message }; });
  }

  setState(state, selfId) {
    if (!this.available || this.disposed) return;
    const previousPhase = this.state?.phase;
    this.selfId = selfId; this.state = state;
    const playing = state && ['playing', 'finished'].includes(state.phase);
    this.preview.visible = !playing;
    if (!playing) {
      if (state?.phase === 'preview' && state.heroes?.[0]?.champion) this.setPreviewChampion(state.heroes[0].champion);
      for (const id of [...this.entities.keys()]) this.removeEntity(id);
      for (const group of this.projectiles.values()) this.fxLayer.remove(group.group); this.projectiles.clear();
      for (const effect of this.effects.values()) this.removeEffect(effect); this.effects.clear();
      for (const effect of this.localEffects) { this.fxLayer.remove(effect.group); effect.ring.material.dispose(); } this.localEffects.length = 0;
      for (const f of this.floaters) { this.fxLayer.remove(f.sprite); f.texture.dispose(); f.material.dispose(); } this.floaters.length = 0;
      this.predictor.reset(); this.motionSampleSeen = false; this.motionTick = -1; this.snapshotTime = 0;
      return;
    }
    this.selfTeam = state.players?.find(p => p.id === selfId)?.team ?? state.heroes?.find(p => p.id === selfId)?.team ?? 0;
    const time = finite(state.time), advancingMotion = !this.motionSampleSeen || time > this.snapshotTime + 0.00001, delta = Math.max(0.03, time - this.snapshotTime), ids = new Set();
    for (const unit of [...(state.structures || []), ...(state.minions || []), ...(state.heroes || [])]) {
      if (!unit?.id || !Number.isFinite(unit.x) || !Number.isFinite(unit.z)) continue;
      ids.add(unit.id); let entry = this.entities.get(unit.id);
      if (entry && (entry.data.kind !== unit.kind || entry.data.champion !== unit.champion)) { this.removeEntity(unit.id); entry = null; }
      if (!entry) entry = this.createEntity(unit);
      const distance = Math.hypot(unit.x - entry.tx, unit.z - entry.tz);
      if (advancingMotion) { entry.vx = (unit.x - entry.tx) / delta; entry.vz = (unit.z - entry.tz) / delta; }
      // Input acknowledgements may repeat a tick. Preserve its movement sample;
      // a changed position on that same tick is an authoritative teleport.
      const expectedSpeed = finite(unit.effectiveSpeed, finite(unit.speed, unit.kind === 'minion' ? 4.2 : 7));
      const teleported = distance > Math.max(2, expectedSpeed * delta * 2.5);
      if (state.phase === 'finished' || teleported || entry.data.dead !== unit.dead || (!advancingMotion && distance > .001) || (unit.motionRevision !== undefined && entry.data.motionRevision !== undefined && unit.motionRevision !== entry.data.motionRevision)) { entry.group.position.x = unit.x; entry.group.position.z = unit.z; entry.vx = entry.vz = 0; }
      entry.tx = unit.x; entry.tz = unit.z; entry.data = unit;
      entry.selfRing && (entry.selfRing.visible = unit.id === selfId && !unit.dead);
      entry.teamRing.visible = !unit.dead;
      entry.pick.visible = !unit.dead;
      if (unit.kind === 'tower' || unit.kind === 'nexus') { entry.model.userData.body.visible = !unit.dead; entry.model.userData.ruins.visible = Boolean(unit.dead); entry.label.sprite.visible = !unit.dead; }
      else { entry.model.visible = !unit.dead || Boolean(entry.asset); entry.label.sprite.visible = !unit.dead; }
      if (entry.shield) entry.shield.visible = finite(unit.shield) > 0 && !unit.dead;
      entry.recall.visible = Boolean(unit.recalling) && !unit.dead;
      this.updateLabel(entry, unit);
      if (unit.id === selfId && state.phase === 'playing') this.predictor.receive(unit, performance.now());
    }
    for (const id of [...this.entities.keys()]) if (!ids.has(id)) this.removeEntity(id);
    if (state.phase === 'finished') this.predictor.reset();
    if (state.phase === 'playing' && previousPhase !== 'playing') {
      const own = this.entities.get(selfId);
      if (own) { this.locked = true; this.focusTarget.set(clamp(own.tx + (this.selfTeam ? -5 : 5), -28, 28), 0.7, clamp(own.tz, -3.5, 3.5)); this.focus.copy(this.focusTarget); }
    }
    this.updateProjectiles(state.projectiles || []);
    this.updateEffects(state.effects || []);
    for (const event of state.events || []) this.consumeEvent(event);
    if (this.seenEvents.size > 800) this.seenEvents = new Set([...this.seenEvents].slice(-400));
    if (advancingMotion) { this.snapshotTime = time; this.motionTick = state.tick; this.lastSnapshot = performance.now(); this.motionSampleSeen = true; }
  }

  updateProjectiles(list) {
    const ids = new Set();
    for (const data of list) {
      if (!data?.id || !Number.isFinite(data.x) || !Number.isFinite(data.z)) continue; ids.add(data.id);
      let entry = this.projectiles.get(data.id);
      if (!entry) {
        const group = new THREE.Group(), color = /arrow|ice/.test(data.kind) ? 0xa6edfa : /orb|light|lux/.test(data.kind) ? 0xf9d78c : TEAM[data.team] || 0xe5eac8;
        if (/arrow/.test(data.kind)) {
          this.mesh(group, 'cylinder', [0.04, 0.04, 1.2, 5], 0xd8f4fa, [0, 0, 0], [Math.PI / 2, 0, 0], { glow: 0.7, shadow: false });
          this.mesh(group, 'cone', [Math.max(0.15, finite(data.radius, 0.15)), 0.5, 5], color, [0, 0, 0.7], [Math.PI / 2, 0, 0], { glow: 1.2, shadow: false });
        } else this.mesh(group, 'sphere', [clamp(finite(data.radius, 0.2), 0.1, 0.65), 7, 6], color, [0, 0, 0], [0, 0, 0], { glow: 1.5, shadow: false });
        this.mesh(group, 'sphere', [0.1, 6, 4], 0xf4f6db, [0, 0, -0.4], [0, 0, 0], { glow: 1.2, opacity: 0.65, shadow: false });
        group.position.set(data.x, 1.8, data.z); this.fxLayer.add(group); entry = { group, data }; this.projectiles.set(data.id, entry);
      }
      entry.data = data;
    }
    for (const [id, entry] of this.projectiles) if (!ids.has(id)) { this.fxLayer.remove(entry.group); this.projectiles.delete(id); }
  }

  effectModel(data) {
    const group = new THREE.Group(), color = data.type === 'heal' ? 0x8ee6a2 : data.type === 'laser' ? 0xfde9a4 : data.type === 'spin' ? 0xe2d3a0 : data.type === 'flash' ? 0xd4d8ff : TEAM[data.team] || 0xcce9f0;
    const radius = Math.max(0.3, finite(data.radius, 1.5)), materials = [];
    const own = object => { object.material = object.material.clone(); materials.push(object.material); return object; };
    if (/laser|beam/.test(data.type)) {
      const dx = finite(data.toX, data.x + 12) - data.x, dz = finite(data.toZ, data.z) - data.z, length = Math.max(0.1, Math.hypot(dx, dz));
      const beam = own(this.mesh(group, 'cylinder', [0.3, 0.3, 1, 8], color, [dx / 2, 1.05, dz / 2], [0, 0, 0], { glow: 1.5, opacity: 0.7, shadow: false }));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize()); beam.scale.y = length;
      const core = own(this.mesh(group, 'cylinder', [0.075, 0.075, 1, 6], 0xffffef, [dx / 2, 1.05, dz / 2], [0, 0, 0], { glow: 2, opacity: 0.95, shadow: false })); core.quaternion.copy(beam.quaternion); core.scale.y = length;
    } else if (data.type === 'spin') {
      for (let i = 0; i < 3; i++) own(this.mesh(group, 'torus', [radius * (0.7 + i * 0.15), 0.035, 4, 40, Math.PI * 1.4], color, [0, 0.35 + i * 0.35, 0], [Math.PI / 2 + i * 0.06, 0.3 * i, 1.7 * i], { glow: 1.2, opacity: 0.7, shadow: false }));
    } else if (/shield|dome/.test(data.type)) {
      own(this.mesh(group, 'sphere', [radius, 16, 10], color, [0, 1, 0], [0, 0, 0], { glow: 0.8, opacity: 0.18, shadow: false })); own(this.ring(group, radius, color, 0.1, 0.06, 0.75));
    } else if (/heal/.test(data.type)) {
      own(this.ring(group, radius, color, 0.08, 0.08, 0.75)); own(this.mesh(group, 'box', [0.18, 1.2, 0.18], color, [0, 1.8, 0], [0, 0, 0], { glow: 1, opacity: 0.8, shadow: false })); own(this.mesh(group, 'box', [0.8, 0.18, 0.18], color, [0, 1.9, 0], [0, 0, 0], { glow: 1, opacity: 0.8, shadow: false }));
    } else if (/recall/.test(data.type)) {
      for (let n = 0; n < 4; n++) own(this.ring(group, radius, color, n * 0.6, 0.045, 0.8));
    } else {
      own(this.ring(group, radius, color, 0.08, 0.06, 0.8));
      if (/hit|flash|execute|kill|burst/.test(data.type)) for (let n = 0; n < 8; n++) { const a = n * Math.PI / 4; const ray = own(this.mesh(group, 'cone', [0.09, radius * 0.8, 4], color, [Math.cos(a) * radius * 0.4, 0.4 + (n % 3) * 0.2, Math.sin(a) * radius * 0.4], [0, 0, Math.PI / 2], { glow: 1.2, opacity: 0.8, shadow: false })); ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize()); }
      else own(this.mesh(group, 'circle', [radius * 0.96, 48], color, [0, 0.05, 0], [-Math.PI / 2, 0, 0], { glow: 0.4, opacity: 0.1, shadow: false }));
    }
    group.position.set(finite(data.x), 0.94, finite(data.z)); this.fxLayer.add(group);
    return { group, materials, data, life: finite(data.ttl, 0.7), maxLife: Math.max(0.1, finite(data.maxTtl, data.ttl || 0.7)), born: this.clock };
  }

  updateEffects(list) {
    const ids = new Set();
    for (const data of list) { if (!data?.id) continue; ids.add(data.id); let effect = this.effects.get(data.id); if (!effect) { effect = this.effectModel(data); this.effects.set(data.id, effect); } effect.data = data; effect.life = finite(data.ttl, Math.max(0, effect.maxLife - (this.clock - effect.born))); effect.group.position.set(finite(data.x), 0.94, finite(data.z)); }
    for (const [id, effect] of this.effects) if (!ids.has(id)) { this.removeEffect(effect); this.effects.delete(id); }
  }

  removeEffect(effect) { this.fxLayer.remove(effect.group); for (const material of effect.materials) material.dispose(); }

  consumeEvent(event) {
    if (!event?.id || this.seenEvents.has(event.id)) return; this.seenEvents.add(event.id);
    const actor = this.entities.get(event.actorId || event.ownerId); if (actor && /attack|cast|shoot/.test(event.type || '')) { actor.swing = this.clock; actor.asset?.play(event.type === 'cast' && event.slot ? event.slot : 'attack', { once: true, restart: true }); }
    if (Number.isFinite(event.value) && event.value !== 0 && Number.isFinite(event.x) && Number.isFinite(event.z)) {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 72; const ctx = canvas.getContext('2d');
      const heal = /heal/.test(event.type || ''); ctx.font = 'bold 38px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 7; ctx.strokeStyle = '#18232c'; const value = `${heal ? '+' : ''}${Math.round(Math.abs(event.value))}`; ctx.strokeText(value, 80, 49); ctx.fillStyle = heal ? '#a0efa5' : '#f8dfac'; ctx.fillText(value, 80, 49);
      const texture = new THREE.CanvasTexture(canvas), material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material); sprite.scale.set(2.3, 1.04, 1); sprite.position.set(event.x, 3, event.z); this.fxLayer.add(sprite); this.floaters.push({ sprite, texture, material, life: 1.1, age: 0 });
    }
  }

  buildAim() {
    this.aimGroup = new THREE.Group(); this.fxLayer.add(this.aimGroup); this.aimGroup.visible = false;
    this.aimCircle = this.ring(this.aimGroup, 1, 0x8cdce3, 0.05, 0.04, 0.7);
    this.aimLine = this.mesh(this.aimGroup, 'box', [1, 0.015, 0.055], 0xc1ecea, [0, 0.06, 0], [0, 0, 0], { glow: 0.6, opacity: 0.55, shadow: false });
    this.aimTarget = this.ring(this.aimGroup, 0.45, 0xf5dc9a, 0.07, 0.07, 0.9);
  }

  setAim(aim) { this.aim = aim; }

  pulse(point, color = 0xc3e6ba) {
    if (!this.available || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return;
    const group = new THREE.Group(); group.position.set(point.x, 0.96, point.z); this.fxLayer.add(group);
    const ring = this.ring(group, 0.85, color, 0, 0.05, 0.9); ring.material = ring.material.clone();
    for (let n = 0; n < 4; n++) { const a = n * Math.PI / 2; this.mesh(group, 'cone', [0.09, 0.28, 3], color, [Math.cos(a) * 0.55, 0.02, Math.sin(a) * 0.55], [0, a, Math.PI / 2], { glow: 0.8, shadow: false }); }
    this.localEffects.push({ group, ring, life: 0.7, age: 0 });
  }

  setCameraLock(locked) { this.locked = Boolean(locked); }

  noteInput(action, sequence, now = performance.now()) { this.predictor.input(action, sequence, now); }
  rejectInput(sequence) { this.predictor.reject(sequence); }
  setLatency(roundTripMs) { this.predictor.setLatency(roundTripMs); }

  setQuality(mode) {
    const ratio = this.frameBudget.setQuality(mode); this.renderer?.setPixelRatio(ratio); this.resize();
    return this.performance;
  }

  resize() {
    if (!this.renderer) return;
    const rect = this.canvas.getBoundingClientRect(), width = Math.max(1, rect.width || window.innerWidth), height = Math.max(1, rect.height || window.innerHeight), ratio = width / height;
    this.renderer.setSize(width, height, false);
    const half = this.state && ['playing', 'finished'].includes(this.state.phase) ? this.zoom : 11.6;
    this.camera.left = -half * ratio; this.camera.right = half * ratio; this.camera.top = half; this.camera.bottom = -half; this.camera.updateProjectionMatrix();
    this.lastWidth = width; this.lastHeight = height; this.lastOrthoHalf = half;
  }

  screenToWorld(clientX, clientY) {
    if (!this.available) return null;
    const rect = this.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return null;
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(this.ground, point)) return null;
    if (point.x < -45 || point.x > 45 || point.z < -14 || point.z > 14) return null;
    return { x: clamp(point.x, -39.5, 39.5), z: clamp(point.z, -7.7, 7.7) };
  }

  pick(clientX, clientY) {
    if (!this.available) return null;
    const rect = this.canvas.getBoundingClientRect(); this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera);
    const result = this.raycaster.intersectObjects(this.pickTargets, false).find(hit => this.entities.get(hit.object.userData.entityId)?.data && !this.entities.get(hit.object.userData.entityId).data.dead);
    return result?.object.userData.entityId || null;
  }

  render(dt = 0.016) {
    if (!this.available || this.disposed) return;
    const renderStarted = performance.now();
    dt = clamp(finite(dt, 0.016), 0, 0.1); this.clock += dt;
    const playing = this.state && ['playing', 'finished'].includes(this.state.phase);
    const half = playing ? this.zoom : 11.6; if (half !== this.lastOrthoHalf) this.resize();
    const self = this.entities.get(this.selfId);
    if (playing && this.locked && self) { this.focusTarget.x = clamp(self.group.position.x + (this.selfTeam ? -5 : 5), -28, 28); this.focusTarget.z = clamp(self.group.position.z, -3.5, 3.5); }
    else if (!playing) this.focusTarget.set(1.8, 0.7, 0);
    this.focus.lerp(this.focusTarget, 1 - Math.exp(-dt * 4.8));
    this.camera.position.set(this.focus.x, 30 + (this.zoom - 18) * 0.5, this.focus.z + 24); this.camera.lookAt(this.focus);
    if (this.waterTexture) { this.waterTexture.offset.x = this.clock * 0.008; this.waterTexture.offset.y = this.clock * 0.004; }
    if (this.dust) { this.dust.position.y = Math.sin(this.clock * 0.2) * 0.4; this.dust.rotation.y = Math.sin(this.clock * 0.025) * 0.015; }
    if (!playing && this.previewModel) { if (this.previewAsset) this.previewAsset.update(dt); else { const body = this.previewModel.userData.body; body.position.y = Math.sin(this.clock * 1.8) * 0.025; } this.previewModel.rotation.y = -0.24 + Math.sin(this.clock * 0.22) * 0.08; this.previewCircle.rotation.z = this.clock * 0.035; }
    const prediction = Math.min(0.08, Math.max(0, (performance.now() - this.lastSnapshot) / 1000));
    const predictedSelf = this.state?.phase === 'playing' && self ? this.predictor.step(dt, renderStarted) : null;
    for (const entry of this.entities.values()) {
      const unit = entry.data, alpha = 1 - Math.exp(-dt * 18), x = entry.tx + entry.vx * prediction, z = entry.tz + entry.vz * prediction;
      if (unit.id === this.selfId && predictedSelf) { entry.group.position.x = predictedSelf.x; entry.group.position.z = predictedSelf.z; }
      else { entry.group.position.x += (x - entry.group.position.x) * alpha; entry.group.position.z += (z - entry.group.position.z) * alpha; }
      const speed = Math.hypot(entry.group.position.x - entry.px, entry.group.position.z - entry.pz) / Math.max(0.001, dt); entry.px = entry.group.position.x; entry.pz = entry.group.position.z;
      const facing = unit.id === this.selfId && Number.isFinite(predictedSelf?.facing) ? predictedSelf.facing : Number.isFinite(unit.facing) ? unit.facing : Math.atan2(entry.vx, entry.vz);
      entry.angle = angleLerp(entry.angle, facing, 1 - Math.exp(-dt * 14));
      if (unit.kind === 'hero' || unit.kind === 'minion') {
        entry.model.rotation.y = entry.angle;
        if (entry.asset) {
          if (Boolean(unit.dead) !== entry.assetWasDead) { entry.asset.play(unit.dead ? 'death' : 'idle', { force: true }); entry.assetWasDead = Boolean(unit.dead); }
          if (!unit.dead) entry.asset.play(speed > .3 ? 'run' : 'idle');
          entry.asset.update(dt); continue;
        }
        const walk = clamp(speed / 5, 0, 1), phase = this.clock * (unit.kind === 'minion' ? 10 : 9) + entry.phase, limbs = entry.model.userData.limbs;
        entry.model.userData.body.position.y = Math.sin(phase * 2) * 0.035 * walk;
        if (limbs.leftLeg) { limbs.leftLeg.rotation.x = Math.sin(phase) * 0.55 * walk; limbs.rightLeg.rotation.x = -Math.sin(phase) * 0.55 * walk; }
        const swing = this.clock - entry.swing, attack = swing > 0 && swing < 0.42 ? Math.sin(swing / 0.42 * Math.PI) : 0;
        if (limbs.rightArm) limbs.rightArm.rotation.x = -Math.sin(phase) * 0.3 * walk - attack * 1.7;
        if (limbs.leftArm) limbs.leftArm.rotation.x = Math.sin(phase) * 0.24 * walk - (unit.champion === 'ashe' ? 0.4 + attack * 0.6 : attack * 0.4);
        if (limbs.cape) limbs.cape.rotation.x = -0.15 + Math.sin(phase) * 0.08 * walk;
      } else if (entry.model.userData.crystal) { entry.model.userData.crystal.rotation.y += dt * 0.45; entry.model.userData.crystal.position.y = (unit.kind === 'tower' ? 4.8 : 3.1) + Math.sin(this.clock * 1.7) * 0.08; }
      if (entry.recall.visible) { entry.recall.rotation.y += dt * 1.6; entry.recall.children.forEach((ring, n) => { ring.position.y = ((this.clock * 1.3 + n * 0.7) % 2.4) + 0.08; }); }
    }
    for (const entry of this.projectiles.values()) { const d = entry.data, alpha = 1 - Math.exp(-dt * 25); entry.group.position.x += (d.x - entry.group.position.x) * alpha; entry.group.position.z += (d.z - entry.group.position.z) * alpha; entry.group.rotation.y = Math.atan2(finite(d.dx, 1), finite(d.dz)); }
    for (const [id, effect] of this.effects) {
      effect.life -= dt; if (effect.life <= -0.2) { this.removeEffect(effect); this.effects.delete(id); continue; }
      const ratio = clamp(effect.life / effect.maxLife, 0, 1), age = this.clock - effect.born;
      if (effect.data.type === 'spin') effect.group.rotation.y = age * 14;
      if (/flash|hit|burst|execute/.test(effect.data.type)) effect.group.scale.setScalar(1 + (1 - ratio) * 0.9);
      for (const material of effect.materials) { if (material.userData.baseOpacity === undefined) material.userData.baseOpacity = material.opacity; material.opacity = material.userData.baseOpacity * Math.min(1, ratio * 3); }
    }
    for (let n = this.localEffects.length - 1; n >= 0; n--) { const effect = this.localEffects[n]; effect.age += dt; const ratio = effect.age / effect.life; effect.group.scale.setScalar(0.6 + ratio * 0.7); effect.ring.material.opacity = 1 - ratio; if (ratio >= 1) { this.fxLayer.remove(effect.group); effect.ring.material.dispose(); this.localEffects.splice(n, 1); } }
    for (let n = this.floaters.length - 1; n >= 0; n--) { const f = this.floaters[n]; f.age += dt; f.sprite.position.y += dt * 1.45; f.material.opacity = clamp((f.life - f.age) * 2, 0, 1); if (f.age >= f.life) { this.fxLayer.remove(f.sprite); f.texture.dispose(); f.material.dispose(); this.floaters.splice(n, 1); } }
    this.aimGroup.visible = Boolean(this.aim && playing && self && !self.data.dead);
    if (this.aimGroup.visible) { const a = this.aim, sx = self.group.position.x, sz = self.group.position.z, range = Math.max(0.1, finite(a.range, 6)), dx = finite(a.x, sx) - sx, dz = finite(a.z, sz) - sz, length = Math.hypot(dx, dz), distance = Math.min(range, length); this.aimGroup.position.set(sx, 0.91, sz); this.aimCircle.scale.setScalar(range); this.aimLine.scale.x = distance; this.aimLine.position.set(dx * Math.min(1, range / (length || 1)) / 2, 0.06, dz * Math.min(1, range / (length || 1)) / 2); this.aimLine.rotation.y = -Math.atan2(dz, dx); this.aimTarget.position.set(dx * Math.min(1, range / (length || 1)), 0.07, dz * Math.min(1, range / (length || 1))); }
    this.renderer.render(this.scene, this.camera);
    const nextRatio = this.frameBudget.sample(renderStarted, performance.now() - renderStarted, this.renderer.info.render, document.visibilityState !== 'hidden');
    if (nextRatio !== null) { this.renderer.setPixelRatio(nextRatio); this.resize(); }
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    window.removeEventListener('resize', this.onResize); window.removeEventListener('pointermove', this.onPanMove); window.removeEventListener('pointerup', this.onPanEnd);
    this.canvas.removeEventListener('wheel', this.onWheel); this.canvas.removeEventListener('pointerdown', this.onPanStart);
    for (const id of [...this.entities.keys()]) this.removeEntity(id);
    for (const effect of this.effects.values()) this.removeEffect(effect);
    for (const effect of this.localEffects) effect.ring.material.dispose();
    for (const f of this.floaters) { f.texture.dispose(); f.material.dispose(); }
    for (const material of this.materials.values()) material.dispose(); for (const geometry of this.geometries.values()) geometry.dispose(); for (const texture of this.textures) texture.dispose();
    for (const geometry of this.mergedGeometries || []) geometry.dispose();
    for (const geometry of this.actorBatchGeometries.values()) geometry.dispose();
    this.previewAsset?.dispose();
    this.waterMaterial?.dispose(); this.dustGeometry?.dispose(); this.dust?.material.dispose(); this.renderer?.dispose();
  }
}
