import { MAP } from './shared/definitions.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const boundPoint = p => ({ x: clamp(p.x, MAP.minX + .8, MAP.maxX - .8), z: clamp(p.z, MAP.minZ + .7, MAP.maxZ - .7) });
const now = () => globalThis.performance?.now() ?? Date.now();
const blocked = h => h.dead || h.hp <= 0 || h.stunned > 0 || h.rooted || h.recalling > 0 || h.buffs?.meditate > 0;

function advance(position, target, distance) {
  const dx = target.x - position.x, dz = target.z - position.z, length = Math.hypot(dx, dz);
  if (length < .05 || distance <= 0) return { ...position };
  const amount = Math.min(length, distance);
  return { x: clamp(position.x + dx / length * amount, MAP.minX + .7, MAP.maxX - .7), z: clamp(position.z + dz / length * amount, MAP.minZ + .7, MAP.maxZ - .7), facing: Math.atan2(dx, dz) };
}

/** Predicts only the local hero's move intention. Combat and collision outcomes
 * always come from snapshots; this class never writes to a received hero. */
export class MovementPredictor {
  constructor() { this.rttMs = 80; this.reset(); }

  reset() {
    this.hero = null; this.position = null; this.target = null; this.pending = [];
    this.correction = { x: 0, z: 0 }; this.receivedAt = -Infinity; this.supported = false;
    this.stationarySnapshots = 0; this.collisionBlocked = false;
  }

  setLatency(rttMs) {
    if (Number.isFinite(rttMs) && rttMs >= 0) this.rttMs = clamp(rttMs, 0, 400);
  }

  receive(hero, receivedAtMs = now()) {
    if (!finitePoint(hero)) return false;
    const previous = this.hero, previousAt = this.receivedAt;
    this.supported = Number.isSafeInteger(hero.lastInputSeq) && hero.lastInputSeq >= 0;
    if (!this.supported) { this.reset(); return false; }
    this.hero = hero; this.receivedAt = receivedAtMs;
    this.pending = this.pending.filter(input => input.seq > hero.lastInputSeq);
    const newLife = !previous || previous.id !== hero.id || previous.dead !== hero.dead;
    const discontinuity = newLife || previous.motionRevision !== hero.motionRevision;
    const controlled = blocked(hero);
    // A flash can be followed by a newer move before its snapshot returns. The
    // teleport resets the position, while inputs newer than its ACK still replay.
    if (newLife || controlled) this.pending.length = 0;
    if (discontinuity || controlled) { this.stationarySnapshots = 0; this.collisionBlocked = false; }
    const advancing = previous && (Number.isSafeInteger(hero.motionTick) && Number.isSafeInteger(previous.motionTick)
      ? hero.motionTick > previous.motionTick : receivedAtMs > previousAt);
    if (advancing && !discontinuity && !controlled) {
      const moved = Math.hypot(hero.x - previous.x, hero.z - previous.z);
      if (moved >= .02 || !finitePoint(hero.moveTarget)) { this.stationarySnapshots = 0; this.collisionBlocked = false; }
      else if (!this.pending.length && Math.hypot(hero.moveTarget.x - hero.x, hero.moveTarget.z - hero.z) > .25) {
        this.stationarySnapshots++;
        if (this.stationarySnapshots >= 3) this.collisionBlocked = true;
      }
    }
    this.chooseTarget();
    const authoritative = { x: hero.x, z: hero.z, facing: hero.facing || 0 };
    if (!this.position || discontinuity || controlled || Math.hypot(this.position.x - hero.x, this.position.z - hero.z) > 3) {
      this.position = authoritative; this.correction = { x: 0, z: 0 };
      return true;
    }
    const pending = this.pending.at(-1);
    // An unacknowledged stop takes effect locally at once. An old moving
    // snapshot must not restart it while the command travels to the server.
    if (pending && pending.action.type !== 'move') { this.correction = { x: 0, z: 0 }; return true; }
    const lead = pending ? Math.min(.2, Math.max(0, (receivedAtMs - pending.at) / 1000)) : this.rttMs / 2000;
    const projected = this.target ? advance(authoritative, this.target, this.speed() * lead) : authoritative;
    this.correction = { x: projected.x - this.position.x, z: projected.z - this.position.z };
    return true;
  }

  chooseTarget() {
    if (!this.hero || blocked(this.hero) || this.collisionBlocked) { this.target = null; return; }
    const pending = this.pending.at(-1);
    this.target = pending ? (pending.action.type === 'move' ? pending.action.point : null) : (finitePoint(this.hero.moveTarget) ? boundPoint(this.hero.moveTarget) : null);
  }

  input(action, seq, atMs = now()) {
    if (!this.supported || !this.hero || !Number.isSafeInteger(seq) || seq <= this.hero.lastInputSeq || !action) return false;
    const interrupts = ['stop', 'attack', 'attack_move', 'recall'].includes(action.type)
      || (action.type === 'summoner' && action.slot === 'd')
      || (action.type === 'ability' && this.hero.champion === 'yi' && ['q', 'w'].includes(action.slot));
    if (action.type !== 'move' && !interrupts) return false;
    if (action.type === 'move' && !finitePoint(action)) return false;
    const latestSeq = this.pending.at(-1)?.seq ?? this.hero.lastInputSeq;
    if (seq <= latestSeq) return false;
    this.pending.push({ seq, at: atMs, action: { type: action.type, ...(action.type === 'move' ? { point: boundPoint(action) } : {}) } });
    if (this.pending.length > 128) this.pending.splice(0, this.pending.length - 128);
    this.stationarySnapshots = 0; this.collisionBlocked = false;
    this.chooseTarget(); this.correction = { x: 0, z: 0 };
    return Boolean(this.target);
  }

  reject(seq) {
    if (!Number.isSafeInteger(seq)) return;
    this.pending = this.pending.filter(input => input.seq !== seq);
    this.chooseTarget();
    // The next snapshot supplies the rejected command's authoritative position.
    this.correction = { x: 0, z: 0 };
  }

  speed() { return Math.max(0, this.hero?.effectiveSpeed ?? this.hero?.speed ?? 0); }

  step(dt, atMs = now()) {
    if (!this.supported || !this.position || !this.hero) return null;
    const elapsed = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
    const fresh = atMs - this.receivedAt <= 300;
    const moving = Boolean(fresh && this.target && !blocked(this.hero));
    if (moving) this.position = advance(this.position, this.target, this.speed() * elapsed);
    else if (Number.isFinite(this.hero.facing)) this.position.facing = this.hero.facing;
    if (fresh) {
      const alpha = 1 - Math.exp(-elapsed * 14);
      this.position.x += this.correction.x * alpha; this.position.z += this.correction.z * alpha;
      this.correction.x *= 1 - alpha; this.correction.z *= 1 - alpha;
      this.position.x = clamp(this.position.x, MAP.minX + .7, MAP.maxX - .7);
      this.position.z = clamp(this.position.z, MAP.minZ + .7, MAP.maxZ - .7);
    }
    return { ...this.position, predicted: moving };
  }
}
