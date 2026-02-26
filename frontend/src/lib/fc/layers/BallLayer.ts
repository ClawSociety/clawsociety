// ─────────────────── BallLayer ───────────────────────────────
// Ball with rotation, trail, glow, speed lines.
// Trail uses ring buffer (no splice). Glow cached.

import { Container, Graphics, BlurFilter } from 'pixi.js';
import type { MatchEvent, MatchRenderConfig, Vec2 } from '../types';

const PADDING = 24;
const TRAIL_LENGTH = 20; // ring buffer size
const TRAIL_MAX_AGE = 600; // ms
const BALL_RADIUS = 10;

interface TrailPoint {
  x: number;
  y: number;
  age: number;
  active: boolean;
}

export class BallLayer extends Container {
  private ballGfx: Graphics;
  private glowGfx: Graphics;
  private trailGfx: Graphics;
  private speedLinesGfx: Graphics;
  private shadowGfx: Graphics;
  private trail: TrailPoint[];
  private trailHead = 0;
  private cfg: MatchRenderConfig;
  private pw = 0;
  private ph = 0;
  private lastBallScreen = { x: 0, y: 0 };
  private spinAngle = 0;

  constructor(cfg: MatchRenderConfig, screenW: number, screenH: number) {
    super();
    this.cfg = cfg;
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;
    this.sortableChildren = true;

    // Pre-allocate trail ring buffer
    this.trail = Array.from({ length: TRAIL_LENGTH }, () => ({
      x: 0, y: 0, age: TRAIL_MAX_AGE + 1, active: false,
    }));

    // Shadow
    this.shadowGfx = new Graphics();
    this.shadowGfx.zIndex = 0;
    this.addChild(this.shadowGfx);

    // Trail
    this.trailGfx = new Graphics();
    this.trailGfx.zIndex = 1;
    this.addChild(this.trailGfx);

    // Glow (cached with blur)
    this.glowGfx = new Graphics();
    this.glowGfx.circle(0, 0, BALL_RADIUS * 4).fill({ color: 0xffd700, alpha: 0.3 });
    this.glowGfx.filters = [new BlurFilter({ strength: 12 })];
    this.glowGfx.zIndex = 2;
    this.addChild(this.glowGfx);

    // Speed lines
    this.speedLinesGfx = new Graphics();
    this.speedLinesGfx.zIndex = 3;
    this.addChild(this.speedLinesGfx);

    // Ball body
    this.ballGfx = new Graphics();
    this.ballGfx.zIndex = 4;
    this.drawBallBody();
    this.addChild(this.ballGfx);
  }

  private drawBallBody() {
    const g = this.ballGfx;
    g.clear();

    // Main body
    g.circle(0, 0, BALL_RADIUS).fill(0xffffff);

    // Pentagon pattern
    g.circle(-3, -3, 4).fill(0x333333);
    g.circle(4, 1, 3).fill(0x333333);

    // Highlight
    g.circle(-4, -4, 2.5).fill({ color: 0xffffff, alpha: 0.7 });
  }

  update(ballPos: Vec2, event: MatchEvent | null, deltaMs: number) {
    const bx = PADDING + ballPos.x * this.pw;
    const by = PADDING + ballPos.y * this.ph;

    // Update trail
    this.addTrailPoint(bx, by);
    this.ageTrail(deltaMs);
    this.drawTrail();

    // Position ball + glow
    this.ballGfx.x = bx;
    this.ballGfx.y = by;
    this.glowGfx.x = bx;
    this.glowGfx.y = by;

    // Shadow
    this.shadowGfx.clear();
    this.shadowGfx.ellipse(bx + 2, by + 10, BALL_RADIUS * 0.9, BALL_RADIUS * 0.3)
      .fill({ color: 0x000000, alpha: 0.35 });

    // Rotation based on movement
    const dx = bx - this.lastBallScreen.x;
    const dy = by - this.lastBallScreen.y;
    const speed = Math.sqrt(dx * dx + dy * dy);
    this.spinAngle += speed * 0.05;
    this.ballGfx.rotation = this.spinAngle;

    // Speed lines on shots/goals
    this.speedLinesGfx.clear();
    if (event && (event.type === 'shot' || event.type === 'goal')) {
      const edx = event.ballTo.x - event.ballFrom.x;
      const edy = event.ballTo.y - event.ballFrom.y;
      const len = Math.sqrt(edx * edx + edy * edy);
      if (len > 0) {
        const nx = -edx / len;
        const ny = -edy / len;
        for (let i = 0; i < 3; i++) {
          const offset = (i - 1) * 4;
          const sx = bx + nx * 8 + ny * offset;
          const sy = by + ny * 8 - nx * offset;
          const ex = bx + nx * 18 + ny * offset;
          const ey = by + ny * 18 - nx * offset;
          this.speedLinesGfx.moveTo(sx, sy).lineTo(ex, ey)
            .stroke({ width: 2, color: 0xffd700, alpha: 0.6 });
        }
      }
    }

    this.lastBallScreen = { x: bx, y: by };
  }

  private addTrailPoint(x: number, y: number) {
    this.trail[this.trailHead] = { x, y, age: 0, active: true };
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
  }

  private ageTrail(deltaMs: number) {
    for (const point of this.trail) {
      if (point.active) {
        point.age += deltaMs;
        if (point.age > TRAIL_MAX_AGE) point.active = false;
      }
    }
  }

  private drawTrail() {
    this.trailGfx.clear();
    for (const point of this.trail) {
      if (!point.active) continue;
      const alpha = Math.max(0, 1 - point.age / TRAIL_MAX_AGE) * 0.35;
      const size = BALL_RADIUS * 0.5 * (1 - point.age / TRAIL_MAX_AGE);
      if (size > 0) {
        this.trailGfx.circle(point.x, point.y, size).fill({ color: 0xffd700, alpha });
      }
    }
  }

  resize(screenW: number, screenH: number) {
    this.pw = screenW - PADDING * 2;
    this.ph = screenH - PADDING * 2;
  }
}
