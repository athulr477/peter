// Particle system & Dynamic Net ripples for Beach Penalty Shootout
// Optimized for mobile: object pooling, reduced allocation, batch rendering

const MAX_PARTICLES = 150;   // Hard cap to prevent frame drops on low-end phones
const MAX_NET_RIPPLES = 4;

export class ParticleSystem {
  constructor() {
    // Pre-allocate particle pool to avoid GC pressure on mobile
    this._pool = [];
    this.particles = [];
    this.netRipples = [];

    // Detect if we should reduce particle count
    this._isLowEnd = this._detectLowEnd();
  }

  _detectLowEnd() {
    const cores = navigator.hardwareConcurrency || 2;
    const mem = navigator.deviceMemory || 4;
    return cores <= 2 || mem <= 2;
  }

  _getParticle() {
    // Reuse from pool if available
    if (this._pool.length > 0) {
      return this._pool.pop();
    }
    return {};
  }

  _returnParticle(p) {
    if (this._pool.length < MAX_PARTICLES) {
      this._pool.push(p);
    }
  }

  _getEffectiveCount(count) {
    // Reduce particle count on low-end devices
    if (this._isLowEnd) return Math.ceil(count * 0.5);
    // Also cap total active particles
    const available = MAX_PARTICLES - this.particles.length;
    return Math.min(count, available);
  }

  // Sand puff when ball is kicked
  emitSandPuff(x, y, count = 25, power = 1.0) {
    const n = this._getEffectiveCount(count);
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = (20 + Math.random() * 80) * (0.8 + power * 0.4);
      const p = this._getParticle();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 10;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2 + Math.random() * 3.5;
      p.r = Math.random() > 0.4 ? 215 : 180;
      p.g = Math.random() > 0.4 ? 185 : 150;
      p.b = Math.random() > 0.4 ? 145 : 110;
      p.alpha = 0.9;
      p.decay = 0.8 + Math.random() * 0.8;
      p.gravity = 120;
      this.particles.push(p);
    }
  }

  // Celebratory golden sparks when goal scored
  emitGoalSparks(x, y, count = 60) {
    const n = this._getEffectiveCount(count);
    const colorSet = [
      [255, 215, 0],
      [255, 165, 0],
      [0, 220, 255],
      [255, 255, 255],
      [50, 255, 120],
    ];
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      const c = colorSet[Math.floor(Math.random() * colorSet.length)];
      const p = this._getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.size = 3 + Math.random() * 4;
      p.r = c[0];
      p.g = c[1];
      p.b = c[2];
      p.alpha = 1.0;
      p.decay = 0.7 + Math.random() * 0.6;
      p.gravity = 90;
      this.particles.push(p);
    }
  }

  // Post impact shockwave & sparks
  emitPostImpact(x, y) {
    const n = this._getEffectiveCount(20);
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      const p = this._getParticle();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = 2 + Math.random() * 3;
      p.r = 255;
      p.g = 240;
      p.b = 180;
      p.alpha = 1.0;
      p.decay = 1.6;
      p.gravity = 50;
      this.particles.push(p);
    }
  }

  // Dynamic net ripple shockwave
  triggerNetRipple(targetX, targetY) {
    // Cap ripples
    if (this.netRipples.length >= MAX_NET_RIPPLES) {
      this.netRipples.shift();
    }
    this.netRipples.push({
      x: targetX,
      y: targetY,
      radius: 5,
      maxRadius: 180,
      strength: 1.0,
      speed: 380,
    });
  }

  update(dt) {
    // Update particles — iterate backwards, swap-remove for O(1) removal
    let len = this.particles.length;
    for (let i = len - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        // Swap with last element and pop (O(1) instead of splice O(n))
        this._returnParticle(p);
        this.particles[i] = this.particles[len - 1];
        this.particles.pop();
        len--;
      }
    }

    // Update net ripples
    for (let i = this.netRipples.length - 1; i >= 0; i--) {
      const r = this.netRipples[i];
      r.radius += r.speed * dt;
      r.strength = Math.max(0, 1 - r.radius / r.maxRadius);
      if (r.radius >= r.maxRadius || r.strength <= 0) {
        this.netRipples.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Batch all particles using a single path where possible
    const particles = this.particles;
    const len = particles.length;
    if (len === 0) return;

    for (let i = 0; i < len; i++) {
      const p = particles[i];
      const a = Math.max(0, p.alpha);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw net mesh ripple overlay over the goal opening
  drawNetRipples(ctx, goalRect) {
    if (this.netRipples.length === 0) return;

    ctx.save();
    // Clip to goal mouth
    ctx.beginPath();
    ctx.rect(goalRect.x, goalRect.y, goalRect.width, goalRect.height);
    ctx.clip();

    for (const r of this.netRipples) {
      const alpha = r.strength * 0.4;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = 2.5 * r.strength;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner wave
      if (r.radius > 25) {
        ctx.strokeStyle = `rgba(220, 230, 255, ${alpha * 0.6})`;
        ctx.lineWidth = 1.5 * r.strength;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius - 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  clear() {
    // Return all particles to pool
    for (let i = 0; i < this.particles.length; i++) {
      this._returnParticle(this.particles[i]);
    }
    this.particles.length = 0;
    this.netRipples.length = 0;
  }
}
