import type {
  MatchTimeline, MatchRenderConfig, MatchEvent,
  PlayerFrame, Vec2, Team, PlayerState, Direction8,
} from './types';
import { DEFAULT_CONFIG, HOME_FORMATION, AWAY_FORMATION } from './types';
import { drawPlayer } from './playerRenderer';
import type { SpriteAtlas } from './spriteLoader';
import { angleToDir8 } from './spriteLoader';

const PADDING = 24;
const FONT = 'JetBrains Mono, monospace';

// ─────────────────── Particle System ────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  type: 'dust' | 'spark' | 'confetti';
}

// ─────────────────── Ball Trail Point ───────────────────────

interface TrailPoint {
  x: number; y: number; age: number;
}

// ─────────────────── Main Renderer ──────────────────────────

export class MatchRenderer {
  private timeline: MatchTimeline;
  private cfg: MatchRenderConfig;
  private homePower: number;
  private awayPower: number;
  private particles: Particle[] = [];
  private ballTrail: TrailPoint[] = [];
  private shakeX = 0;
  private shakeY = 0;
  private shakeDecay = 0;
  private lastEventType = '';
  private lastEventTime = -1;
  private momentum = 0.5; // 0=away dominant, 1=home dominant
  private lastBallPos: Vec2 = { x: 0.5, y: 0.5 };
  private sprites: SpriteAtlas;

  constructor(
    timeline: MatchTimeline,
    config?: Partial<MatchRenderConfig>,
    homePower = 0,
    awayPower = 0,
    sprites?: SpriteAtlas,
  ) {
    this.timeline = timeline;
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.homePower = homePower;
    this.awayPower = awayPower;
    this.sprites = sprites ?? { loaded: false, get: () => null, ball: null };
  }

  renderFrame(ctx: CanvasRenderingContext2D, w: number, h: number, elapsedMs: number): boolean {
    const progress = Math.min(1, elapsedMs / this.cfg.matchDuration);
    const pw = w - PADDING * 2;
    const ph = h - PADDING * 2;
    const dt = 16; // ~60fps frame delta

    // Screen shake
    this.updateShake(dt);

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // 1. Pitch with grass stripes
    this.drawPitch(ctx, w, h, pw, ph);

    // 2. Current event
    const { current, eventProgress } = this.findEvent(progress);

    // 3. Trigger effects on new events
    this.handleEventEffects(current);

    // 4. Count goals
    const { hg, ag } = this.countGoals(progress);

    // 5. Update momentum
    this.updateMomentum(current);

    // 6. Compute player frames
    const players = this.computePlayers(current, eventProgress, elapsedMs);
    players.sort((a, b) => a.pos.y - b.pos.y);

    // 7. Update particles
    this.updateParticles(dt);

    // 8. Draw ground-level particles (dust)
    this.drawParticles(ctx, pw, ph, 'dust');

    // 9. Draw players (NES sprites)
    const scale = Math.max(2, Math.round(pw / 16 / 14));
    for (const pf of players) {
      const px = PADDING + pf.pos.x * pw;
      const py = PADDING + pf.pos.y * ph;
      drawPlayer(ctx, px, py, this.sprites, pf.team, pf.state, pf.dir, pf.animTick, scale);
    }

    // 10. Ball with trail
    const ballPos = this.computeBall(current, eventProgress);
    this.updateBallTrail(ballPos, dt);
    this.drawBallTrail(ctx, pw, ph);
    this.drawBall(ctx, PADDING + ballPos.x * pw, PADDING + ballPos.y * ph, current);
    this.lastBallPos = ballPos;

    // 11. Air particles (sparks, confetti)
    this.drawParticles(ctx, pw, ph, 'spark');
    this.drawParticles(ctx, pw, ph, 'confetti');

    // 12. Event effects overlay
    if (current?.type === 'goal') {
      this.drawGoalEffect(ctx, w, h, current.team, eventProgress);
    } else if (current?.type === 'save' && eventProgress > 0.2) {
      this.drawEventText(ctx, w, h, 'SAVE!', '#ffd700', eventProgress);
    } else if (current?.type === 'tackle' && eventProgress > 0.15 && eventProgress < 0.85) {
      this.drawEventText(ctx, w, h, 'TACKLE', '#ff8855', eventProgress);
    }

    ctx.restore(); // end shake transform

    // 13. HUD (outside shake)
    this.drawHUD(ctx, w, h, hg, ag, progress);

    // 14. Full time
    if (progress >= 1) {
      this.drawFullTime(ctx, w, h);
      return false;
    }

    return true;
  }

  // ─────────────── Pitch with grass stripes ─────────────────

  private drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, pw: number, ph: number) {
    // Dark border
    ctx.fillStyle = this.cfg.pitchColor;
    ctx.fillRect(0, 0, w, h);

    // Grass with alternating stripes
    const stripeCount = 12;
    const stripeW = pw / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0d2d0d' : '#0f330f';
      ctx.fillRect(PADDING + i * stripeW, PADDING, stripeW + 1, ph);
    }

    // Neon pitch lines with glow
    ctx.shadowColor = 'rgba(255,255,255,0.15)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = this.cfg.lineColor;
    ctx.lineWidth = 1.2;

    // Outline
    ctx.strokeRect(PADDING, PADDING, pw, ph);

    // Center line
    ctx.beginPath();
    ctx.moveTo(w / 2, PADDING);
    ctx.lineTo(w / 2, PADDING + ph);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, ph * 0.15, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Goals with neon glow
    const goalW = pw * 0.025;
    const goalH = ph * 0.28;

    // Left goal (home defends)
    ctx.shadowColor = this.cfg.home.primary;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = this.cfg.home.primary + '66';
    ctx.lineWidth = 2;
    ctx.strokeRect(PADDING - goalW, h / 2 - goalH / 2, goalW, goalH);

    // Right goal (away defends)
    ctx.shadowColor = this.cfg.away.primary;
    ctx.strokeStyle = this.cfg.away.primary + '66';
    ctx.strokeRect(PADDING + pw, h / 2 - goalH / 2, goalW, goalH);

    // Goal nets (subtle crosshatch)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    const netStep = goalH / 6;
    for (let i = 1; i < 6; i++) {
      const ny = h / 2 - goalH / 2 + i * netStep;
      // Left net
      ctx.beginPath();
      ctx.moveTo(PADDING - goalW, ny);
      ctx.lineTo(PADDING, ny);
      ctx.stroke();
      // Right net
      ctx.beginPath();
      ctx.moveTo(PADDING + pw, ny);
      ctx.lineTo(PADDING + pw + goalW, ny);
      ctx.stroke();
    }

    // Penalty areas
    ctx.shadowBlur = 0;
    ctx.strokeStyle = this.cfg.lineColor;
    ctx.lineWidth = 1.2;
    const penW = pw * 0.13;
    const penH = ph * 0.45;
    ctx.strokeRect(PADDING, h / 2 - penH / 2, penW, penH);
    ctx.strokeRect(PADDING + pw - penW, h / 2 - penH / 2, penW, penH);

    // 6-yard boxes
    const sixW = pw * 0.05;
    const sixH = ph * 0.22;
    ctx.strokeRect(PADDING, h / 2 - sixH / 2, sixW, sixH);
    ctx.strokeRect(PADDING + pw - sixW, h / 2 - sixH / 2, sixW, sixH);

    // Corner arcs
    const cornerR = pw * 0.025;
    ctx.beginPath();
    ctx.arc(PADDING, PADDING, cornerR, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PADDING + pw, PADDING, cornerR, Math.PI / 2, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PADDING, PADDING + ph, cornerR, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(PADDING + pw, PADDING + ph, cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    // Penalty spots
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(PADDING + penW * 0.75, h / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PADDING + pw - penW * 0.75, h / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // ─────────────── Particles ────────────────────────────────

  private spawnParticles(
    x: number, y: number, count: number,
    type: Particle['type'], color: string, speed: number, life: number,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - (type === 'confetti' ? speed * 0.5 : 0),
        life, maxLife: life,
        color, size: type === 'confetti' ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
        type,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      if (p.type === 'confetti') p.vy += 0.15; // gravity
      if (p.type === 'dust') p.vy -= 0.02; // rise
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, pw: number, ph: number, type: Particle['type']) {
    for (const p of this.particles) {
      if (p.type !== type) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;

      if (p.type === 'confetti') {
        // Rotating rectangle
        ctx.save();
        ctx.translate(PADDING + p.x * pw, PADDING + p.y * ph);
        ctx.rotate(p.life * 0.02);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(PADDING + p.x * pw, PADDING + p.y * ph, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dust — soft circle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(PADDING + p.x * pw, PADDING + p.y * ph, p.size * (1 + (1 - alpha) * 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ─────────────── Event Effects Trigger ────────────────────

  private handleEventEffects(current: MatchEvent | null) {
    if (!current || (current.type === this.lastEventType && current.time === this.lastEventTime)) return;
    this.lastEventType = current.type;
    this.lastEventTime = current.time;

    const bx = current.ballTo.x;
    const by = current.ballTo.y;

    switch (current.type) {
      case 'goal':
        // Screen shake
        this.shakeDecay = 400;
        // Confetti burst
        this.spawnParticles(bx, by, 30, 'confetti',
          current.team === 'home' ? this.cfg.home.primary : this.cfg.away.primary,
          0.08, 1200);
        this.spawnParticles(bx, by, 20, 'confetti', '#ffd700', 0.06, 1000);
        // Sparks at goal
        this.spawnParticles(bx, by, 15, 'spark', '#ffffff', 0.05, 500);
        break;
      case 'shot':
        this.spawnParticles(current.ballFrom.x, current.ballFrom.y, 6, 'spark', '#ffd700', 0.04, 400);
        this.shakeDecay = 100;
        break;
      case 'tackle':
        this.spawnParticles(bx, by, 8, 'dust', 'rgba(180,160,120,0.6)', 0.03, 600);
        this.spawnParticles(bx, by, 4, 'spark', '#ff8855', 0.03, 300);
        this.shakeDecay = 60;
        break;
      case 'save':
        this.spawnParticles(bx, by, 5, 'spark', '#ffd700', 0.04, 400);
        this.shakeDecay = 80;
        break;
    }
  }

  // ─────────────── Screen Shake ─────────────────────────────

  private updateShake(dt: number) {
    if (this.shakeDecay > 0) {
      const intensity = this.shakeDecay / 400 * 4;
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
      this.shakeDecay = Math.max(0, this.shakeDecay - dt);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  // ─────────────── Ball Trail ───────────────────────────────

  private updateBallTrail(pos: Vec2, dt: number) {
    this.ballTrail.push({ x: pos.x, y: pos.y, age: 0 });
    for (let i = this.ballTrail.length - 1; i >= 0; i--) {
      this.ballTrail[i].age += dt;
      if (this.ballTrail[i].age > 300) {
        this.ballTrail.splice(i, 1);
      }
    }
  }

  private drawBallTrail(ctx: CanvasRenderingContext2D, pw: number, ph: number) {
    for (const tp of this.ballTrail) {
      const alpha = Math.max(0, 1 - tp.age / 300) * 0.3;
      const size = 2 * (1 - tp.age / 300);
      ctx.beginPath();
      ctx.arc(PADDING + tp.x * pw, PADDING + tp.y * ph, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,215,0,${alpha})`;
      ctx.fill();
    }
  }

  // ─────────────── Momentum ─────────────────────────────────

  private updateMomentum(current: MatchEvent | null) {
    if (!current) return;
    const target = current.team === 'home' ? 0.7 : 0.3;
    this.momentum += (target - this.momentum) * 0.05;
  }

  // ─────────────── Event lookup ─────────────────────────────

  private findEvent(progress: number): { current: MatchEvent | null; eventProgress: number } {
    const events = this.timeline.events;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (progress >= ev.time && progress < ev.time + ev.duration) {
        return { current: ev, eventProgress: (progress - ev.time) / ev.duration };
      }
    }
    let last: MatchEvent | null = null;
    for (const ev of events) {
      if (ev.time + ev.duration <= progress) last = ev;
    }
    return { current: last, eventProgress: 1 };
  }

  private countGoals(progress: number): { hg: number; ag: number } {
    let hg = 0, ag = 0;
    for (const ev of this.timeline.events) {
      if (ev.type === 'goal' && ev.time <= progress) {
        if (ev.team === 'home') hg++; else ag++;
      }
    }
    return { hg, ag };
  }

  // ─────────────── Players ──────────────────────────────────

  private computePlayers(
    current: MatchEvent | null, eventProgress: number, elapsedMs: number,
  ): PlayerFrame[] {
    const frames: PlayerFrame[] = [];
    const animTick = (elapsedMs % 500) / 500;

    for (const formation of [HOME_FORMATION, AWAY_FORMATION]) {
      for (const player of formation) {
        const base = { ...player.basePos };
        let state: PlayerState = 'idle';
        let pos: Vec2 = base;
        let dir: Direction8 = player.team === 'home' ? 'east' : 'west';
        let targetPos: Vec2 | null = null; // for computing 8-dir from movement

        const jx = Math.sin(elapsedMs * 0.002 + player.index * 3.7) * 0.012;
        const jy = Math.cos(elapsedMs * 0.0015 + player.index * 2.3) * 0.016;

        if (current) {
          const isActor = current.team === player.team && current.playerIndex === player.index;
          const isTarget = current.team === player.team && current.targetIndex === player.index;
          const isOppGK = player.team !== current.team && player.role === 'GK';

          if (current.type === 'goal' && current.team === player.team) {
            state = 'celebrating';
            pos = { x: base.x + jx, y: base.y + jy };
            dir = 'south';
          } else if (current.type === 'goal' && current.team !== player.team) {
            state = 'idle';
            pos = { x: base.x + jx, y: base.y + jy };
          } else if (isActor && current.type === 'shot') {
            state = eventProgress > 0.4 ? 'kicking' : 'running';
            pos = this.lerp(base, current.ballFrom, this.easeOut(Math.min(1, eventProgress * 1.5)));
            targetPos = current.ballTo;
          } else if (isActor && (current.type === 'pass' || current.type === 'dribble')) {
            state = 'running';
            if (current.type === 'dribble') {
              pos = this.lerp(current.ballFrom, current.ballTo, this.easeInOut(eventProgress));
            } else {
              pos = this.lerp(base, current.ballFrom, this.easeOut(Math.min(1, eventProgress * 2)));
            }
            targetPos = current.ballTo;
          } else if (isTarget && current.type === 'pass') {
            state = 'running';
            pos = this.lerp(base, current.ballTo, this.easeInOut(eventProgress));
            targetPos = current.ballTo;
          } else if (isActor && current.type === 'tackle') {
            state = 'running';
            pos = this.lerp(base, current.ballFrom, this.easeOut(Math.min(1, eventProgress * 2)));
            targetPos = current.ballFrom;
          } else if (isOppGK && (current.type === 'shot' || current.type === 'save')) {
            if (current.type === 'save' && eventProgress > 0.3) {
              state = 'diving';
              pos = {
                x: base.x,
                y: this.lerpN(base.y, current.ballTo.y, this.easeOut((eventProgress - 0.3) / 0.7)),
              };
              targetPos = current.ballTo;
            } else {
              state = 'idle';
              pos = {
                x: base.x,
                y: this.lerpN(base.y, current.ballTo.y, eventProgress * 0.5),
              };
            }
          } else {
            pos = { x: base.x + jx, y: base.y + jy };
          }
        } else {
          pos = { x: base.x + jx, y: base.y + jy };
        }

        // Compute 8-directional facing from movement
        if (targetPos) {
          dir = angleToDir8(targetPos.x - pos.x, targetPos.y - pos.y);
        }

        pos.x = Math.max(0.02, Math.min(0.98, pos.x));
        pos.y = Math.max(0.05, Math.min(0.95, pos.y));

        frames.push({
          pos, state, dir, animTick,
          team: player.team, role: player.role, index: player.index,
        });
      }
    }
    return frames;
  }

  // ─────────────── Ball ─────────────────────────────────────

  private computeBall(current: MatchEvent | null, ep: number): Vec2 {
    if (!current) return { x: 0.5, y: 0.5 };
    const from = current.ballFrom;
    const to = current.ballTo;
    const t = this.easeInOut(Math.min(1, ep));
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - current.ballArc * Math.sin(t * Math.PI) * 0.12,
    };
  }

  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, event: MatchEvent | null) {
    // Outer glow
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 12);
    grd.addColorStop(0, 'rgba(255,215,0,0.4)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 12, y - 12, 24, 24);

    // Ball shadow
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 5, 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Ball body
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Ball pattern (pentagons suggestion)
    ctx.beginPath();
    ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#333333';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 0.5, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#333333';
    ctx.fill();

    // Bright highlight
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 1.5, 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // Speed lines on shots
    if (event && (event.type === 'shot' || event.type === 'goal')) {
      const dx = event.ballTo.x - event.ballFrom.x;
      const dy = event.ballTo.y - event.ballFrom.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const nx = -dx / len;
        const ny = -dy / len;
        ctx.strokeStyle = 'rgba(255,215,0,0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const offset = (i - 1) * 3;
          ctx.beginPath();
          ctx.moveTo(x + nx * 6 + ny * offset, y + ny * 6 - nx * offset);
          ctx.lineTo(x + nx * 14 + ny * offset, y + ny * 14 - nx * offset);
          ctx.stroke();
        }
      }
    }
  }

  // ─────────────── Effects ──────────────────────────────────

  private drawGoalEffect(ctx: CanvasRenderingContext2D, w: number, h: number, team: Team, ep: number) {
    const color = team === 'home' ? this.cfg.home.primary : this.cfg.away.primary;

    // Full screen flash
    if (ep > 0.05 && ep < 0.5) {
      const alpha = (1 - Math.abs(ep - 0.25) / 0.25) * 0.2;
      ctx.fillStyle = team === 'home'
        ? `rgba(0,255,255,${alpha})`
        : `rgba(255,0,85,${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Vignette flash on edges
    if (ep < 0.4) {
      const vigAlpha = (1 - ep / 0.4) * 0.15;
      const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
      vigGrad.addColorStop(0, 'transparent');
      vigGrad.addColorStop(1, `rgba(255,255,255,${vigAlpha})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // GOAL! text with neon glow
    if (ep > 0.1) {
      const textAlpha = Math.min(1, (ep - 0.1) / 0.15) * Math.max(0, 1 - (ep - 0.6) / 0.4);
      const sc = 1 + Math.max(0, (0.3 - ep)) * 2;

      ctx.save();
      ctx.translate(w / 2, h / 2 - 10);
      ctx.scale(sc, sc);

      // Glow layers
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.font = `bold 32px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,255,255,${textAlpha * 0.3})`;
      ctx.fillText('GOAL!', 0, 0);

      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.globalAlpha = textAlpha;
      ctx.fillText('GOAL!', 0, 0);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.restore();
    }
  }

  private drawEventText(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    text: string, color: string, ep: number,
  ) {
    const fadeIn = Math.min(1, ep * 4);
    const fadeOut = Math.max(0, 1 - (ep - 0.5) * 4);
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) return;

    const yOff = (1 - this.easeOut(fadeIn)) * 10;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 50 - yOff);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ─────────────── HUD ──────────────────────────────────────

  private drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number, hg: number, ag: number, progress: number) {
    // Score background bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, w, 36);

    // Team color accents on edges
    ctx.fillStyle = this.cfg.home.primary + '33';
    ctx.fillRect(0, 0, 4, 36);
    ctx.fillStyle = this.cfg.away.primary + '33';
    ctx.fillRect(w - 4, 0, 4, 36);

    // HOME label
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = this.cfg.home.primary;
    ctx.fillText('HOME', 10, 13);

    // Home power
    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const hpEth = this.homePower > 0 ? (this.homePower / 1e18).toFixed(2) + ' ETH' : '';
    ctx.fillText(hpEth, 10, 25);

    // AWAY label
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = this.cfg.away.primary;
    ctx.fillText('AWAY', w - 10, 13);

    // Away power
    ctx.font = `8px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const apEth = this.awayPower > 0 ? (this.awayPower / 1e18).toFixed(2) + ' ETH' : '';
    ctx.fillText(apEth, w - 10, 25);

    // Score
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${hg}`, w / 2 - 20, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('-', w / 2, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${ag}`, w / 2 + 20, 22);

    // Match minute
    const minute = Math.min(90, Math.floor(progress * 90));
    ctx.font = `9px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${minute}'`, w / 2, 33);

    // Momentum bar at bottom
    const barY = h - 6;
    const barH = 3;
    const barW = w * 0.5;
    const barX = (w - barW) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, barW, barH);

    // Home portion
    const homeW = barW * this.momentum;
    ctx.fillStyle = this.cfg.home.primary + '88';
    ctx.fillRect(barX, barY, homeW, barH);

    // Away portion
    ctx.fillStyle = this.cfg.away.primary + '88';
    ctx.fillRect(barX + homeW, barY, barW - homeW, barH);

    // Progress bar (thin line under HUD)
    const progW = (w - 20) * progress;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(10, 36, w - 20, 1);
    ctx.fillStyle = 'rgba(255,215,0,0.3)';
    ctx.fillRect(10, 36, progW, 1);
  }

  private drawFullTime(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, h / 2 - 35, w, 70);

    // Border lines
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h / 2 - 35);
    ctx.lineTo(w * 0.85, h / 2 - 35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h / 2 + 35);
    ctx.lineTo(w * 0.85, h / 2 + 35);
    ctx.stroke();

    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('FULL TIME', w / 2, h / 2 - 14);

    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(
      `${this.timeline.homeGoals}  -  ${this.timeline.awayGoals}`,
      w / 2, h / 2 + 18,
    );
  }

  // ─────────────── Util ─────────────────────────────────────

  private lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  private lerpN(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }
}
