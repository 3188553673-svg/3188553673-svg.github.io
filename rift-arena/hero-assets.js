import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';

// Only register assets the project is allowed to use. No third-party character
// models or remote asset hosts are configured implicitly by this module.
const registry = new Map();
const templates = new Map();
const loader = new GLTFLoader();
const locomotionStates = new Set(['idle', 'run']);
const automaticNames = {
  idle: /(?:^idle(?:1)?(?:_|$)|idle1)/i,
  run: /^run(?:_|$)/i,
  attack: /attack1/i,
  q: /spell1/i,
  w: /spell2/i,
  e: /spell3/i,
  r: /spell4/i,
  death: /^death$/i,
};

/** Register a locally owned or separately licensed model and its clip names. */
export function registerHeroAsset(champion, descriptor) {
  if (!descriptor?.url) throw new TypeError('A licensed model URL is required.');
  registry.set(champion, { ...descriptor, clips: { ...(descriptor.clips || {}) } });
}

export function hasHeroAsset(champion) {
  return registry.has(champion);
}

async function getTemplate(url) {
  if (!templates.has(url)) {
    const promise = loader.loadAsync(url).catch(error => {
      templates.delete(url);
      throw error;
    });
    templates.set(url, promise);
  }
  return templates.get(url);
}

/**
 * Load an independently animated actor from a registered or explicit GLB.
 *
 * @param {string} champion project character key
 * @param {object} options optional url, clips map, height (world units),
 *   forwardRotation (radians), castShadow, centerXZ, anisotropy
 * @returns {Promise<{root: THREE.Group, mixer: THREE.AnimationMixer,
 *   clips: THREE.AnimationClip[], play: Function, update: Function,
 *   dispose: Function, state: string|null}>}
 *
 * Call update(dt) once per frame. play('idle'|'run') requests locomotion;
 * attack/q/w/e/r default to one shot then return to locomotion. A locomotion
 * request during a one shot is queued until it finishes. play('death') freezes
 * the final pose; pass {force:true} when playing idle to reset after respawn.
 * Actor disposal releases its own skeleton; cached geometry/textures are shared.
 */
export async function loadHeroModel(champion, options = {}) {
  const descriptor = { ...(registry.get(champion) || {}), ...options };
  if (!descriptor.url) throw new Error(`No licensed 3D asset is configured for ${champion}.`);
  const url = new URL(descriptor.url, import.meta.url).href;
  const gltf = await getTemplate(url);
  const model = cloneSkeleton(gltf.scene);
  const root = new THREE.Group();
  root.name = `${champion}-animated-model`;
  const pivot = new THREE.Group();
  root.add(pivot);
  pivot.add(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error(`Empty 3D geometry for ${champion}.`);
  const scale = (descriptor.height ?? 3.2) / size.y;
  pivot.scale.setScalar(scale);
  pivot.position.y = -bounds.min.y * scale;
  if (descriptor.centerXZ !== false) {
    const center = bounds.getCenter(new THREE.Vector3());
    pivot.position.x = -center.x * scale;
    pivot.position.z = -center.z * scale;
  }
  root.rotation.y = descriptor.forwardRotation ?? 0;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = descriptor.castShadow !== false;
    object.receiveShadow = false;
    // Clones share materials/geometry. These settings are asset-level settings.
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.isMeshBasicMaterial) material.toneMapped = false;
      if (material.map) material.map.anisotropy = Math.max(material.map.anisotropy, descriptor.anisotropy ?? 2);
    }
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });

  const mixer = new THREE.AnimationMixer(model);
  const clips = gltf.animations;
  const clipMap = {};
  const explicit = descriptor.clips || {};
  for (const state of Object.keys(automaticNames)) {
    const names = explicit[state] == null ? [] : [].concat(explicit[state]);
    clipMap[state] = names.map(name => clips.find(clip => clip.name === name)).find(Boolean)
      || clips.find(clip => automaticNames[state].test(clip.name));
  }
  const actions = new Map();
  let current = null;
  let currentState = null;
  let locomotion = 'idle';
  let oneShot = false;
  let dead = false;
  let disposed = false;
  const actor = {
    root, mixer, clips,
    get state() { return currentState; },
    play(state, settings = {}) {
      if (disposed) return false;
      const requestedLocomotion = locomotionStates.has(state);
      if (requestedLocomotion) locomotion = state;
      if ((dead || (oneShot && requestedLocomotion)) && !settings.force) return false;
      const clip = clipMap[state];
      if (!clip) return false;
      if (currentState === state && !settings.restart) return true;
      let action = actions.get(clip);
      if (!action) {
        action = mixer.clipAction(clip);
        actions.set(clip, action);
      }
      const once = settings.once ?? !requestedLocomotion;
      action.reset();
      action.enabled = true;
      action.clampWhenFinished = once;
      action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      action.setEffectiveTimeScale(settings.timeScale ?? 1);
      action.setEffectiveWeight(1);
      const fade = Math.max(0, settings.fade ?? 0.12);
      if (current && current !== action && fade > 0) {
        current.fadeOut(fade);
        action.fadeIn(fade);
      } else if (current && current !== action) current.stop();
      current = action;
      currentState = state;
      oneShot = once;
      dead = state === 'death';
      action.play();
      return true;
    },
    update(dt) {
      if (!disposed && Number.isFinite(dt)) mixer.update(Math.max(0, Math.min(dt, 0.1)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.removeEventListener('finished', onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      const skeletons = new Set();
      model.traverse(object => { if (object.isSkinnedMesh) skeletons.add(object.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
      root.removeFromParent();
    },
  };
  function onFinished(event) {
    if (event.action !== current || dead) return;
    oneShot = false;
    actor.play(locomotion, { force: true });
  }
  mixer.addEventListener('finished', onFinished);
  actor.play('idle');
  return actor;
}
