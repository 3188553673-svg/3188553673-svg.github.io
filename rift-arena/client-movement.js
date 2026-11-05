import { MAP } from './shared/definitions.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const boundPoint = (p, marginX = .8) => ({ x: clamp(p.x, MAP.minX + marginX, MAP.maxX - marginX), z: clamp(p.z, MAP.minZ + .7, MAP.maxZ - .7) });
const now = () => globalThis.performance?.now() ?? Date.now();
const blocked = h => h.dead || h.hp <= 0 || h.stunned > 0 || h.rooted || h.recalling > 0 || h.buffs?.meditate > 0;
const PREDICTION_HORIZON_MS = 550;
const INPUT_HORIZON_MS = 700;
const MAX_REMOTE_EXTRAPOLATION = .12;

/** A monotonic playback clock shared by the remote actors in a match. */
export class SnapshotPlayback {
  constructor() { this.reset(); }

  reset() {
    this.latest = null;
    this.arrivedAt = 0;
    this.time = 0;
    this.delay = .12;
  }

  record(time, receivedAtMs) {
    if (this.latest !== null) {
      if (time <= this.latest) return;
      const gap = (receivedAtMs - this.arrivedAt) / 1000;
      // Keep a little extra history after a burst, then recover latency slowly.
      this.delay = Math.max(this.delay - .002, clamp(gap + .035, .12, .28));
    } else {
      this.time = time;
    }
    this.latest = time;
    this.arrivedAt = receivedAtMs;
  }

  advance(dt, atMs) {
    if (this.latest === null) return this.time;
    const age = clamp((atMs - this.arrivedAt) / 1000, 0, this.delay + MAX_REMOTE_EXTRAPOLATION);
    const target = this.latest + age - this.delay;
    const rate = clamp(1 + (target - this.time) * 5, .75, 1.25);
    // A multi-second outage cannot keep the opponent rendered several seconds behind.
    const earliest = this.latest - .45;
    this.time = Math.max(earliest, Math.min(this.latest + MAX_REMOTE_EXTRAPOLATION, this.time + dt * rate));
    return this.time;
  }
}

/** Sample a short history of server positions at the common render time. */
export function remotePosition(samples, time, vx, vz) {
  while (samples.length > 2 && samples[1].time <= time) samples.shift();
  const first = samples[0], second = samples[1];
  if (time <= first.time) return first;
  if (second && time <= second.time) {
    const t = (time - first.time) / (second.time - first.time);
    return { x: first.x + (second.x - first.x) * t, z: first.z + (second.z - first.z) * t };
  }
  const last = second || first;
  const ahead = Math.min(time - last.time, MAX_REMOTE_EXTRAPOLATION);
  return boundPoint({ x: last.x + vx * ahead, z: last.z + vz * ahead }, .7);
}

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
    if (Number.isFinite(rttMs) && rttMs >= 0) {
      const sample = clamp(rttMs, 0, 360);
      this.rttMs += clamp(sample - this.rttMs, -100, 100) * .2;
    }
  }

  receive(hero, receivedAtMs = now()) {
    if (!finitePoint(hero)) return false;
    const previous = this.hero, previousAt = this.receivedAt;
    this.supported = Number.isSafeInteger(hero.lastInputSeq) && hero.lastInputSeq >= 0;
    if (!this.supported) { this.reset(); return false; }
    const newLife = !previous || previous.id !== hero.id || previous.dead !== hero.dead;
    const discontinuity = newLife || previous.motionRevision !== hero.motionRevision;
    const controlled = blocked(hero);
    const comparableTicks = Number.isSafeInteger(hero.motionTick) && Number.isSafeInteger(previous?.motionTick);
    if (comparableTicks && !discontinuity && hero.motionTick < previous.motionTick) return false;
    const advancing = !previous || (comparableTicks ? hero.motionTick > previous.motionTick : receivedAtMs > previousAt);
    this.hero = hero;
    if (advancing || discontinuity) this.receivedAt = receivedAtMs;
    this.pending = this.pending.filter(input => input.seq > hero.lastInputSeq);
    // A flash can be followed by a newer move before its snapshot returns. The
    // teleport resets the position, while inputs newer than its ACK still replay.
    if (newLife || controlled) this.pending.length = 0;
    if (discontinuity || controlled) { this.stationarySnapshots = 0; this.collisionBlocked = false; }
    if (advancing && previous && !discontinuity && !controlled) {
      const moved = Math.hypot(hero.x - previous.x, hero.z - previous.z);
      if (moved >= .02 || !finitePoint(hero.moveTarget)) { this.stationarySnapshots = 0; this.collisionBlocked = false; }
      else if (!this.pending.length && Math.hypot(hero.moveTarget.x - hero.x, hero.moveTarget.z - hero.z) > .25) {
        this.stationarySnapshots++;
        if (this.stationarySnapshots >= 3) this.collisionBlocked = true;
      }
    }
    this.chooseTarget();
    const authoritative = { x: hero.x, z: hero.z, facing: hero.facing || 0 };
    if (!this.position || discontinuity || controlled) {
      this.position = authoritative; this.correction = { x: 0, z: 0 };
      return true;
    }
    const pending = this.pending.at(-1);
    // Older snapshots describe the old route. Allow a correction once the
    // server acknowledges progress, including during repeated held-click moves.
    const acknowledged = hero.lastInputSeq > (previous?.lastInputSeq ?? 0);
    if (pending && receivedAtMs - this.pending[0].at < INPUT_HORIZON_MS && (!acknowledged || pending.action.type !== 'move')) {
      this.correction = { x: 0, z: 0 };
      return true;
    }
    const serverTarget = pending ? hero.moveTarget : this.target;
    const projected = finitePoint(serverTarget) && !this.collisionBlocked
      ? advance(authoritative, boundPoint(serverTarget), this.speed() * this.rttMs / 2000)
      : authoritative;
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
    const elapsed = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const fresh = atMs - this.receivedAt <= PREDICTION_HORIZON_MS;
    const pending = this.pending.at(-1);
    const inputFresh = !pending || atMs - this.pending[0].at <= INPUT_HORIZON_MS;
    const moving = Boolean(fresh && inputFresh && this.target && !blocked(this.hero));
    const speed = this.speed();
    if (moving) this.position = advance(this.position, this.target, speed * elapsed);
    else if (Number.isFinite(this.hero.facing)) this.position.facing = this.hero.facing;
    const remaining = moving ? Math.hypot(this.target.x - this.position.x, this.target.z - this.position.z) : Infinity;
    const error = Math.hypot(this.correction.x, this.correction.z);
    if (fresh && remaining >= .05 && error > 0) {
      // Ordinary reconciliation must not create a backward step or a position jump.
      // Without a move target, authoritative attack chases can still be at full speed.
      const limit = Math.min(remaining, Math.max(.5, speed * (moving ? .45 : 1.5)) * elapsed);
      const alpha = Math.min(1 - Math.exp(-elapsed * 11), limit / error);
      const dx = this.correction.x * alpha, dz = this.correction.z * alpha;
      this.position.x = clamp(this.position.x + dx, MAP.minX + .7, MAP.maxX - .7);
      this.position.z = clamp(this.position.z + dz, MAP.minZ + .7, MAP.maxZ - .7);
      this.correction.x -= dx; this.correction.z -= dz;
    }
    return { ...this.position, predicted: moving };
  }
}
