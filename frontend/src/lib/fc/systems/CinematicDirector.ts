// ─────────────────── CinematicDirector ──────────────────────
// Orchestrates goal cinematics: slow-mo, zoom, celebration.
// Pure orchestration — sends commands to other systems.

import type { Vec2, MatchEvent, Team } from '../types';
import type { CameraSystem } from './CameraSystem';

// Goal sequence phases (durations in ms)
const IMPACT_DUR = 300;
const REACTION_DUR = 500;
const CELEBRATION_DUR = 1000;
const RESET_DUR = 700;
type CinematicPhase = 'none' | 'impact' | 'reaction' | 'celebration' | 'reset';

export interface CinematicState {
  timeScale: number;      // slow-mo multiplier (1.0 = normal)
  freeze: boolean;        // hit-freeze flag
  phase: CinematicPhase;
}

export class CinematicDirector {
  private phase: CinematicPhase = 'none';
  private phaseTimer = 0;
  private goalTeam: Team = 'home';
  private goalPos: Vec2 = { x: 0.5, y: 0.5 };
  private camera: CameraSystem;
  private activeGoalKey = '';

  // Callbacks for EffectsLayer commands
  onFlash?: (color: number, alpha: number) => void;
  onGoalText?: (visible: boolean, team: Team) => void;
  onHitFreeze?: (durationMs: number) => void;
  onShake?: (intensity: number) => void;

  // Track last processed event to avoid re-triggering
  private lastEventKey = '';

  constructor(camera: CameraSystem) {
    this.camera = camera;
  }

  reset() {
    this.phase = 'none';
    this.phaseTimer = 0;
    this.activeGoalKey = '';
    this.lastEventKey = '';
    this.camera.setOverride(null, 1);
  }

  /**
   * Check for goal/tackle/shot events and orchestrate cinematic effects.
   * @param current - current match event
   * @param deltaMs - frame delta (real time, before timeScale)
   * @returns CinematicState with timeScale and freeze
   */
  update(current: MatchEvent | null, deltaMs: number): CinematicState {
    // Detect new goal event
    if (current?.type === 'goal') {
      const key = `${current.team}-${current.time}`;
      if (key !== this.activeGoalKey) {
        this.activeGoalKey = key;
        this.startGoalSequence(current);
      }
    }

    // Tackle hit-freeze (40ms) and shot camera shake
    if (current) {
      const eventKey = `${current.type}-${current.team}-${current.time}`;
      if (eventKey !== this.lastEventKey) {
        this.lastEventKey = eventKey;
        if (current.type === 'tackle') {
          this.onHitFreeze?.(40);
        }
        if (current.type === 'shot') {
          this.onShake?.(0.6);
        }
      }
    }

    if (this.phase === 'none') {
      return { timeScale: 1, freeze: false, phase: 'none' };
    }

    this.phaseTimer += deltaMs;

    // Phase transitions
    if (this.phase === 'impact' && this.phaseTimer >= IMPACT_DUR) {
      this.phaseTimer -= IMPACT_DUR;
      this.enterReaction();
    }
    if (this.phase === 'reaction' && this.phaseTimer >= REACTION_DUR) {
      this.phaseTimer -= REACTION_DUR;
      this.enterCelebration();
    }
    if (this.phase === 'celebration' && this.phaseTimer >= CELEBRATION_DUR) {
      this.phaseTimer -= CELEBRATION_DUR;
      this.enterReset();
    }
    if (this.phase === 'reset' && this.phaseTimer >= RESET_DUR) {
      this.endSequence();
      return { timeScale: 1, freeze: false, phase: 'none' };
    }

    return this.getCurrentState();
  }

  // ─── Sequence Phases ──────────────────────────────────────

  private startGoalSequence(event: MatchEvent) {
    this.goalTeam = event.team;
    this.goalPos = { ...event.ballTo };
    this.phase = 'impact';
    this.phaseTimer = 0;

    // IMPACT: zoom in, flash, hit freeze
    this.camera.setOverride(this.goalPos, 1.22);
    this.onHitFreeze?.(80);
    this.onShake?.(1.0);

    const color = this.goalTeam === 'home' ? 0x00ffff : 0xff0055;
    this.onFlash?.(color, 0.5);
  }

  private enterReaction() {
    this.phase = 'reaction';
    // Show GOAL! text
    this.onGoalText?.(true, this.goalTeam);
    // Hold zoom
    this.camera.setOverride(this.goalPos, 1.25);
  }

  private enterCelebration() {
    this.phase = 'celebration';
    // Ease back toward normal
    this.camera.setOverride(this.goalPos, 1.10);
  }

  private enterReset() {
    this.phase = 'reset';
    // Hide text, release camera
    this.onGoalText?.(false, this.goalTeam);
    this.camera.setOverride(null, 1);
  }

  private endSequence() {
    this.phase = 'none';
    this.phaseTimer = 0;
  }

  private getCurrentState(): CinematicState {
    switch (this.phase) {
      case 'impact':
        return {
          timeScale: 0.3,
          freeze: this.phaseTimer < 100,
          phase: 'impact',
        };
      case 'reaction':
        return {
          timeScale: 0.6,
          freeze: false,
          phase: 'reaction',
        };
      case 'celebration':
        return {
          timeScale: 1.0,
          freeze: false,
          phase: 'celebration',
        };
      case 'reset': {
        // Ease back to normal
        const t = this.phaseTimer / RESET_DUR;
        return {
          timeScale: 1.0,
          freeze: false,
          phase: t > 0.8 ? 'none' : 'reset',
        };
      }
      default:
        return { timeScale: 1, freeze: false, phase: 'none' };
    }
  }
}
