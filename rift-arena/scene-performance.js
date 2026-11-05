const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;

/** Bounded foreground frame telemetry. Resolution changes never change model detail. */
export class FrameBudget {
  constructor(nativeRatio = 1) {
    this.nativeRatio = Math.max(1, nativeRatio); this.mode = 'auto';
    this.ratio = Math.min(this.nativeRatio, 1.7); this.frames = []; this.cpu = [];
    this.lastAt = null; this.reportAt = 0; this.slowWindows = 0; this.fastWindows = 0;
    this.metrics = { quality: 'auto', pixelRatio: this.ratio, frameP50Ms: 0, frameP95Ms: 0, frameMaxMs: 0, renderP95Ms: 0, sampleCount: 0, calls: 0, triangles: 0 };
  }
  setQuality(mode) {
    if (!['auto', 'smooth', 'high'].includes(mode)) throw new Error('Unknown graphics quality');
    this.mode = mode; this.ratio = Math.min(this.nativeRatio, mode === 'smooth' ? .85 : mode === 'high' ? 2 : 1.7);
    this.slowWindows = this.fastWindows = 0;
    Object.assign(this.metrics, { quality: mode, pixelRatio: this.ratio }); return this.ratio;
  }
  sample(now, cpuMs, info, foreground = true) {
    if (!foreground) { this.lastAt = null; this.frames.length = this.cpu.length = 0; return null; }
    const elapsed = this.lastAt === null ? null : now - this.lastAt; this.lastAt = now;
    if (elapsed !== null && elapsed > 0 && elapsed < 1000) {
      this.frames.push(elapsed); this.cpu.push(Math.max(0, cpuMs));
      if (this.frames.length > 180) { this.frames.shift(); this.cpu.shift(); }
    }
    if (now - this.reportAt < 1000 || this.frames.length < 20) return null;
    this.reportAt = now;
    const frames = [...this.frames].sort((a, b) => a - b), cpu = [...this.cpu].sort((a, b) => a - b);
    Object.assign(this.metrics, { frameP50Ms: percentile(frames, .5), frameP95Ms: percentile(frames, .95), frameMaxMs: frames[frames.length - 1], renderP95Ms: percentile(cpu, .95), sampleCount: frames.length, calls: info?.calls || 0, triangles: info?.triangles || 0 });
    const previous = this.ratio;
    if (this.mode === 'auto') {
      this.slowWindows = this.metrics.frameP95Ms > 26 && (this.metrics.frameP50Ms > 18 || this.metrics.renderP95Ms > 12) ? this.slowWindows + 1 : 0;
      this.fastWindows = this.metrics.frameP95Ms < 17 && this.metrics.frameP50Ms < 15 ? this.fastWindows + 1 : 0;
      if (this.slowWindows >= 2) { this.ratio = Math.max(.85, Math.round((this.ratio - .2) * 100) / 100); this.slowWindows = this.fastWindows = 0; }
      else if (this.fastWindows >= 5) { this.ratio = Math.min(this.nativeRatio, 1.7, Math.round((this.ratio + .1) * 100) / 100); this.fastWindows = 0; }
    }
    this.metrics.pixelRatio = this.ratio;
    return this.ratio !== previous ? this.ratio : null;
  }
}
