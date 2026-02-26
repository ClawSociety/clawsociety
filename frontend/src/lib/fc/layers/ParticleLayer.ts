// ─────────────────── ParticleLayer ───────────────────────────
// GPU-friendly particle system using object pool.
// No Math.random() — uses deterministic counter for visual spread.
// Swap-and-pop instead of splice for O(1) removal.

import { Container, Graphics } from 'pixi.js';

const PADDING = 60;
const POOL_SIZE = 250;
const DRAG = 0.98;
const GRAVITY = 0.05;

type ParticleType = 'dust' | 'spark' | 'confetti' | 'grass';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  alpha: number;
  size: number;
  type: ParticleType;
  rotation: number;
  active: boolean;
  gfx: Graphics;
}

export class ParticleLayer extends Container {
  private pool: Particle[] = [];
  private activeCount = 0;
  private spawnCounter = 0; // deterministic spread counter
  private pw = 0;
  private ph = 0;

  constructor(screenW: number, screenH: number) {
    super();
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;

    // Pre-allocate particle pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const gfx = new Graphics();
      gfx.visible = false;
      this.addChild(gfx);
      this.pool.push({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1,
        color: 0xffffff, alpha: 1, size: 2,
        type: 'dust', rotation: 0,
        active: false, gfx,
      });
    }
  }

  /** Deterministic angle spread — no Math.random() */
  private nextAngle(): number {
    this.spawnCounter++;
    // Golden angle for even distribution
    return this.spawnCounter * 2.399963; // golden angle in radians
  }

  private nextSpread(): number {
    // Deterministic 0-1 spread using counter
    return ((this.spawnCounter * 0.618033988) % 1);
  }

  spawn(
    normX: number, normY: number, count: number,
    type: ParticleType, color: number, speed: number, lifeMs: number,
  ) {
    const screenX = normX; // already in normalized coords
    const screenY = normY;

    for (let i = 0; i < count; i++) {
      if (this.activeCount >= POOL_SIZE) break;

      // Find inactive particle
      const p = this.findInactive();
      if (!p) break;

      const angle = this.nextAngle();
      const v = speed * (0.3 + this.nextSpread() * 0.7);

      p.x = screenX;
      p.y = screenY;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v - (type === 'confetti' ? speed * 0.5 : 0);
      p.life = lifeMs;
      p.maxLife = lifeMs;
      p.color = color;
      p.size = type === 'confetti' ? 2 + this.nextSpread() * 3 : 1 + this.nextSpread() * 2;
      p.type = type;
      p.rotation = this.nextAngle();
      p.active = true;
      p.gfx.visible = true;
      this.activeCount++;
    }
  }

  private findInactive(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }

  update(deltaMs: number) {
    for (const p of this.pool) {
      if (!p.active) continue;

      // Physics
      p.x += p.vx * deltaMs * 0.06;
      p.y += p.vy * deltaMs * 0.06;
      p.vx *= DRAG;
      p.vy *= DRAG;

      if (p.type === 'confetti') p.vy += GRAVITY;
      if (p.type === 'dust') p.vy -= 0.02;
      if (p.type === 'grass') p.vy += 0.02;

      p.rotation += deltaMs * 0.003;
      p.life -= deltaMs;

      if (p.life <= 0) {
        p.active = false;
        p.gfx.visible = false;
        this.activeCount--;
        continue;
      }

      // Render
      const alpha = Math.max(0, p.life / p.maxLife);
      const sx = PADDING + p.x * this.pw;
      const sy = PADDING + p.y * this.ph;

      p.gfx.clear();

      if (p.type === 'confetti') {
        p.gfx.x = sx;
        p.gfx.y = sy;
        p.gfx.rotation = p.rotation;
        p.gfx.rect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
          .fill({ color: p.color, alpha });
      } else if (p.type === 'spark') {
        p.gfx.x = 0;
        p.gfx.y = 0;
        p.gfx.rotation = 0;
        p.gfx.circle(sx, sy, p.size * alpha)
          .fill({ color: p.color, alpha });
      } else {
        // Dust / grass — expanding soft circle
        p.gfx.x = 0;
        p.gfx.y = 0;
        p.gfx.rotation = 0;
        const expandSize = p.size * (1 + (1 - alpha) * 2);
        p.gfx.circle(sx, sy, expandSize)
          .fill({ color: p.color, alpha: alpha * 0.6 });
      }
    }
  }

  resize(screenW: number, screenH: number) {
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;
  }
}
