// ─────────────────── PixiMatchRenderer ───────────────────────
// Main orchestrator: connects PixiJS Application to all layers.
// Uses 5 systems: Movement, Ball, Formation, Camera, CinematicDirector.
// Uses PixiJS Ticker for proper delta-time.

import { Application, Container } from 'pixi.js';
import type { MatchTimeline, MatchRenderConfig, MatchEvent, NFTPlayerIdentity } from './types';
import { DEFAULT_CONFIG } from './types';
import { PitchLayer } from './layers/PitchLayer';
import { PlayerLayer } from './layers/PlayerLayer';
import { BallLayer } from './layers/BallLayer';
import { ParticleLayer } from './layers/ParticleLayer';
import { HUDLayer } from './layers/HUDLayer';
import { EffectsLayer } from './layers/EffectsLayer';
import { MovementSystem } from './systems/MovementSystem';
import { BallSystem } from './systems/BallSystem';
import { FormationSystem } from './systems/FormationSystem';
import { CameraSystem } from './systems/CameraSystem';
import { CinematicDirector } from './systems/CinematicDirector';
import { deriveNFTAppearance } from './players/NFTAppearanceFactory';
import type { PlayerAppearance } from './players/PlayerFactory';

export class PixiMatchRenderer {
  app: Application;
  private timeline: MatchTimeline;
  private cfg: MatchRenderConfig;
  private homePower: number;
  private awayPower: number;

  // NFT identity (optional)
  private nftHome?: NFTPlayerIdentity[];
  private nftAway?: NFTPlayerIdentity[];

  // Layers
  private gameContainer!: Container;
  private pitchLayer!: PitchLayer;
  private playerLayer!: PlayerLayer;
  private ballLayer!: BallLayer;
  private particleLayer!: ParticleLayer;
  private hudLayer!: HUDLayer;
  private effectsLayer!: EffectsLayer;

  // Systems
  private movementSystem!: MovementSystem;
  private ballSystem!: BallSystem;
  private formationSystem!: FormationSystem;
  private cameraSystem!: CameraSystem;
  private cinematicDirector!: CinematicDirector;

  // State
  private startTime = 0;
  private lastEventType = '';
  private lastEventTime = -1;
  private momentum = 0.5;
  private finished = false;
  private paused = false;
  private speed = 1;
  private screenW = 0;
  private screenH = 0;
  private onFinish?: () => void;

  constructor(
    timeline: MatchTimeline,
    config?: Partial<MatchRenderConfig>,
    homePower = 0,
    awayPower = 0,
    nftHome?: NFTPlayerIdentity[],
    nftAway?: NFTPlayerIdentity[],
  ) {
    this.app = new Application();
    this.timeline = timeline;
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.homePower = homePower;
    this.awayPower = awayPower;
    this.nftHome = nftHome;
    this.nftAway = nftAway;
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number, onFinish?: () => void) {
    this.onFinish = onFinish;
    this.screenW = width;
    this.screenH = height;

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: parseInt(this.cfg.pitchColor.replace('#', ''), 16),
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // ─── Initialize Systems ──────────────────────────────
    this.movementSystem = new MovementSystem();
    this.ballSystem = new BallSystem();
    this.formationSystem = new FormationSystem();
    this.cameraSystem = new CameraSystem();
    this.cinematicDirector = new CinematicDirector(this.cameraSystem);

    // Wire cinematic callbacks to effects layer (deferred until effectsLayer exists)

    // ─── Build Layers ────────────────────────────────────

    // Game container (receives camera transform)
    this.gameContainer = new Container();
    this.app.stage.addChild(this.gameContainer);

    // Pitch
    this.pitchLayer = new PitchLayer(this.app, this.cfg);
    this.gameContainer.addChild(this.pitchLayer);

    // Particles
    this.particleLayer = new ParticleLayer(width, height);
    this.gameContainer.addChild(this.particleLayer);

    // Players (with optional NFT appearances)
    const appearances = this.buildAppearances();
    this.playerLayer = new PlayerLayer(this.cfg, width, height, appearances);
    this.gameContainer.addChild(this.playerLayer);

    // Ball
    this.ballLayer = new BallLayer(this.cfg, width, height);
    this.gameContainer.addChild(this.ballLayer);

    // Effects (flash, text — on top of game container)
    this.effectsLayer = new EffectsLayer(this.cfg, width, height);
    this.app.stage.addChild(this.effectsLayer);

    // HUD (outside camera — always stable)
    this.hudLayer = new HUDLayer(this.cfg, width, height, this.homePower, this.awayPower);
    this.app.stage.addChild(this.hudLayer);

    // Wire cinematic director to effects layer
    this.cinematicDirector.onFlash = (color, alpha) => {
      this.effectsLayer.setFlash(color, alpha);
    };
    this.cinematicDirector.onGoalText = (visible, team) => {
      this.effectsLayer.setGoalTextVisible(visible, team);
    };
    this.cinematicDirector.onHitFreeze = (durationMs) => {
      this.effectsLayer.triggerHitFreeze(durationMs);
    };
    this.cinematicDirector.onShake = (intensity) => {
      this.effectsLayer.shake.decay = Math.max(this.effectsLayer.shake.decay, intensity * 200);
      this.effectsLayer.shake.intensity = Math.max(this.effectsLayer.shake.intensity, intensity * 5);
    };

    // Start
    this.startTime = performance.now();
    this.app.ticker.add(this.update, this);
  }

  // ─────────────── Main Update Loop ───────────────────────

  private update = () => {
    if (this.finished || this.paused) return;

    const now = performance.now();
    const elapsed = (now - this.startTime) * this.speed;
    const rawDeltaMs = this.app.ticker.deltaMS * this.speed;
    const progress = Math.min(1, elapsed / this.cfg.matchDuration);

    // 1. Find current event (unchanged)
    const { current, eventProgress } = this.findEvent(progress);

    // 2. CinematicDirector — check for goal sequences
    const cinematic = this.cinematicDirector.update(current, rawDeltaMs);
    const deltaMs = cinematic.freeze ? 0 : rawDeltaMs * cinematic.timeScale;

    // 3. Trigger particle/shake effects on new events
    this.handleEventEffects(current);

    // 4. Count goals
    const { hg, ag } = this.countGoals(progress);

    // 5. Update momentum
    this.updateMomentum(current);

    // 6. FormationSystem → 10 target positions
    const targets = this.formationSystem.update(current, eventProgress, deltaMs);

    // 7. MovementSystem → 10 smooth PlayerFrames
    const players = this.movementSystem.update(targets, current, eventProgress, deltaMs, elapsed);

    // 8. BallSystem → ball position + state
    //    Find carrier position (actor of current event)
    const carrierPos = this.findCarrierPos(current, players);
    const ballFrame = this.ballSystem.update(current, eventProgress, carrierPos, deltaMs);

    // 9. CameraSystem → viewport transform
    const camera = this.cameraSystem.update(ballFrame.pos, this.screenW, this.screenH, deltaMs);

    // 10. Update layers with computed data
    this.effectsLayer.update(current, eventProgress, deltaMs);
    this.playerLayer.update(players, elapsed);
    this.ballLayer.update(ballFrame.pos, current, deltaMs, ballFrame.state, ballFrame.speed);
    this.particleLayer.update(deltaMs);
    this.hudLayer.update(progress, hg, ag, this.momentum);

    // 11. Apply camera + shake to game container
    const shakeX = this.effectsLayer.shakeX;
    const shakeY = this.effectsLayer.shakeY;

    if (camera.zoom !== 1) {
      const cx = this.screenW / 2;
      const cy = this.screenH / 2;
      this.gameContainer.scale.set(camera.zoom);
      this.gameContainer.pivot.set(cx, cy);
      this.gameContainer.position.set(
        cx + camera.offsetX + shakeX,
        cy + camera.offsetY + shakeY,
      );
    } else {
      this.gameContainer.scale.set(1);
      this.gameContainer.pivot.set(0, 0);
      this.gameContainer.position.set(
        camera.offsetX + shakeX,
        camera.offsetY + shakeY,
      );
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
        // Don't call triggerGoal directly — CinematicDirector handles the sequence
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

  // ─────────────── Helpers ──────────────────────────────────

  /** Find the screen position of the ball carrier (actor) from computed player frames */
  private findCarrierPos(current: MatchEvent | null, players: { pos: { x: number; y: number }; team: string; index: number }[]): { x: number; y: number } | null {
    if (!current) return null;
    const actor = players.find(p => p.team === current.team && p.index === current.playerIndex);
    return actor ? { ...actor.pos } : null;
  }

  /** Build PlayerAppearance[] from NFT identity data */
  private buildAppearances(): PlayerAppearance[] | undefined {
    if (!this.nftHome && !this.nftAway) return undefined;

    const appearances: PlayerAppearance[] = [];

    // Home team (5 players)
    for (let i = 0; i < 5; i++) {
      if (this.nftHome?.[i]) {
        const nft = this.nftHome[i];
        appearances.push(deriveNFTAppearance(nft.tokenId, nft.stats, nft.tier));
      } else {
        // Will be filled by PlayerLayer's fallback
        appearances.push(undefined as unknown as PlayerAppearance);
      }
    }

    // Away team (5 players)
    for (let i = 0; i < 5; i++) {
      if (this.nftAway?.[i]) {
        const nft = this.nftAway[i];
        appearances.push(deriveNFTAppearance(nft.tokenId, nft.stats, nft.tier));
      } else {
        appearances.push(undefined as unknown as PlayerAppearance);
      }
    }

    // Only return if at least one is defined
    return appearances.some(a => a) ? appearances : undefined;
  }

  // ─────────────── Controls ─────────────────────────────────

  setSpeed(speed: number) {
    this.speed = speed;
  }

  togglePause() {
    if (this.paused) {
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
    // Reset systems on seek
    this.movementSystem.reset();
    this.ballSystem.reset();
    this.formationSystem.reset();
    this.cameraSystem.reset();
    this.cinematicDirector.reset();
    this.lastEventType = '';
    this.lastEventTime = -1;
  }

  // ─────────────── Cleanup ──────────────────────────────────

  destroy() {
    this.app.ticker.remove(this.update, this);
    this.app.destroy(true, { children: true, texture: true });
  }
}
