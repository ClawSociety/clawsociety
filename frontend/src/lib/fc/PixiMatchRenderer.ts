// ─────────────────── PixiMatchRenderer ───────────────────────
// Main orchestrator: connects PixiJS Application to all layers.
// Replaces the old Canvas 2D MatchRenderer.
// Uses PixiJS Ticker for proper delta-time (fixes 16ms hardcode bug).

import { Application, Container } from 'pixi.js';
import type { MatchTimeline, MatchRenderConfig, MatchEvent, PlayerFrame, Vec2, PlayerState, Direction8 } from './types';
import { DEFAULT_CONFIG, HOME_FORMATION, AWAY_FORMATION } from './types';
import { angleToDir8 } from './spriteLoader';
import { PitchLayer } from './layers/PitchLayer';
import { PlayerLayer } from './layers/PlayerLayer';
import { BallLayer } from './layers/BallLayer';
import { ParticleLayer } from './layers/ParticleLayer';
import { HUDLayer } from './layers/HUDLayer';
import { EffectsLayer } from './layers/EffectsLayer';

export class PixiMatchRenderer {
  app: Application;
  private timeline: MatchTimeline;
  private cfg: MatchRenderConfig;
  private homePower: number;
  private awayPower: number;

  // Layers
  private gameContainer!: Container; // applies shake + zoom
  private pitchLayer!: PitchLayer;
  private playerLayer!: PlayerLayer;
  private ballLayer!: BallLayer;
  private particleLayer!: ParticleLayer;
  private hudLayer!: HUDLayer;
  private effectsLayer!: EffectsLayer;

  // State
  private startTime = 0;
  private lastEventType = '';
  private lastEventTime = -1;
  private momentum = 0.5;
  private finished = false;
  private paused = false;
  private speed = 1;
  private onFinish?: () => void;

  constructor(
    timeline: MatchTimeline,
    config?: Partial<MatchRenderConfig>,
    homePower = 0,
    awayPower = 0,
  ) {
    this.app = new Application();
    this.timeline = timeline;
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.homePower = homePower;
    this.awayPower = awayPower;
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number, onFinish?: () => void) {
    this.onFinish = onFinish;

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: parseInt(this.cfg.pitchColor.replace('#', ''), 16),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Game container (receives shake + zoom transforms)
    this.gameContainer = new Container();
    this.app.stage.addChild(this.gameContainer);

    // Build layers bottom-to-top
    this.pitchLayer = new PitchLayer(this.app, this.cfg);
    this.gameContainer.addChild(this.pitchLayer);

    this.particleLayer = new ParticleLayer(width, height);
    this.gameContainer.addChild(this.particleLayer);

    this.playerLayer = new PlayerLayer(this.cfg, width, height);
    this.gameContainer.addChild(this.playerLayer);

    this.ballLayer = new BallLayer(this.cfg, width, height);
    this.gameContainer.addChild(this.ballLayer);

    // Effects layer (flash, text — on top of game container)
    this.effectsLayer = new EffectsLayer(this.cfg, width, height);
    this.app.stage.addChild(this.effectsLayer);

    // HUD layer (outside shake — always stable)
    this.hudLayer = new HUDLayer(this.cfg, width, height, this.homePower, this.awayPower);
    this.app.stage.addChild(this.hudLayer);

    // Start
    this.startTime = performance.now();
    this.app.ticker.add(this.update, this);
  }

  private update = () => {
    if (this.finished || this.paused) return;

    const now = performance.now();
    const elapsed = (now - this.startTime) * this.speed;
    const deltaMs = this.app.ticker.deltaMS * this.speed;
    const progress = Math.min(1, elapsed / this.cfg.matchDuration);

    // Find current event
    const { current, eventProgress } = this.findEvent(progress);

    // Trigger effects on new events
    this.handleEventEffects(current);

    // Count goals
    const { hg, ag } = this.countGoals(progress);

    // Update momentum
    this.updateMomentum(current);

    // Compute player frames
    const players = this.computePlayers(current, eventProgress, elapsed);

    // Compute ball position
    const ballPos = this.computeBall(current, eventProgress);

    // Update layers
    this.effectsLayer.update(current, eventProgress, deltaMs);
    this.playerLayer.update(players, elapsed);
    this.ballLayer.update(ballPos, current, deltaMs);
    this.particleLayer.update(deltaMs);
    this.hudLayer.update(progress, hg, ag, this.momentum);

    // Apply shake + zoom to game container
    this.gameContainer.x = this.effectsLayer.shakeX;
    this.gameContainer.y = this.effectsLayer.shakeY;

    const zoom = this.effectsLayer.zoom;
    if (zoom !== 1) {
      const cx = this.app.screen.width / 2;
      const cy = this.app.screen.height / 2;
      this.gameContainer.scale.set(zoom);
      this.gameContainer.pivot.set(cx, cy);
      this.gameContainer.position.set(cx + this.effectsLayer.shakeX, cy + this.effectsLayer.shakeY);
    } else {
      this.gameContainer.scale.set(1);
      this.gameContainer.pivot.set(0, 0);
      this.gameContainer.position.set(this.effectsLayer.shakeX, this.effectsLayer.shakeY);
    }

    // Full time
    if (progress >= 1 && !this.finished) {
      this.finished = true;
      this.effectsLayer.showFullTime(this.timeline.homeGoals, this.timeline.awayGoals);
      this.onFinish?.();
    }
  };

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

  // ─────────────── Event Effects Trigger ────────────────────

  private handleEventEffects(current: MatchEvent | null) {
    if (!current || (current.type === this.lastEventType && current.time === this.lastEventTime)) return;
    this.lastEventType = current.type;
    this.lastEventTime = current.time;

    const bx = current.ballTo.x;
    const by = current.ballTo.y;
    const homeColor = parseInt(this.cfg.home.primary.replace('#', ''), 16);
    const awayColor = parseInt(this.cfg.away.primary.replace('#', ''), 16);

    switch (current.type) {
      case 'goal': {
        const teamColor = current.team === 'home' ? homeColor : awayColor;
        this.effectsLayer.triggerGoal(current.team);
        this.particleLayer.spawn(bx, by, 50, 'confetti', teamColor, 0.08, 1200);
        this.particleLayer.spawn(bx, by, 35, 'confetti', 0xffd700, 0.06, 1000);
        this.particleLayer.spawn(bx, by, 25, 'spark', 0xffffff, 0.05, 500);
        break;
      }
      case 'shot':
        this.particleLayer.spawn(current.ballFrom.x, current.ballFrom.y, 12, 'spark', 0xffd700, 0.04, 400);
        this.effectsLayer.triggerShot();
        break;
      case 'tackle':
        this.particleLayer.spawn(bx, by, 15, 'dust', 0xb4a078, 0.03, 600);
        this.particleLayer.spawn(bx, by, 8, 'spark', 0xff8855, 0.03, 300);
        this.effectsLayer.triggerTackle();
        break;
      case 'save':
        this.particleLayer.spawn(bx, by, 5, 'spark', 0xffd700, 0.04, 400);
        this.effectsLayer.triggerSave();
        break;
    }
  }

  // ─────────────── Momentum ─────────────────────────────────

  private updateMomentum(current: MatchEvent | null) {
    if (!current) return;
    const target = current.team === 'home' ? 0.7 : 0.3;
    this.momentum += (target - this.momentum) * 0.05;
  }

  // ─────────────── Players ──────────────────────────────────

  private computePlayers(current: MatchEvent | null, eventProgress: number, elapsedMs: number): PlayerFrame[] {
    const frames: PlayerFrame[] = [];
    const animTick = (elapsedMs % 500) / 500;

    for (const formation of [HOME_FORMATION, AWAY_FORMATION]) {
      for (const player of formation) {
        const base = { ...player.basePos };
        let state: PlayerState = 'idle';
        let pos: Vec2 = base;
        let dir: Direction8 = player.team === 'home' ? 'east' : 'west';
        let targetPos: Vec2 | null = null;

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

  // ─────────────── Controls ─────────────────────────────────

  setSpeed(speed: number) {
    this.speed = speed;
  }

  togglePause() {
    if (this.paused) {
      // Resume — adjust startTime to account for paused duration
      this.startTime = performance.now() - (this.cfg.matchDuration * this.getProgress());
      this.paused = false;
    } else {
      this.paused = true;
    }
  }

  isPaused() {
    return this.paused;
  }

  getProgress(): number {
    if (this.finished) return 1;
    const elapsed = (performance.now() - this.startTime) * this.speed;
    return Math.min(1, elapsed / this.cfg.matchDuration);
  }

  seek(progress: number) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.startTime = performance.now() - (clampedProgress * this.cfg.matchDuration) / this.speed;
    if (this.finished && clampedProgress < 1) {
      this.finished = false;
      this.effectsLayer.visible = true;
    }
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

  // ─────────────── Cleanup ──────────────────────────────────

  destroy() {
    this.app.ticker.remove(this.update, this);
    this.app.destroy(true, { children: true, texture: true });
  }
}
