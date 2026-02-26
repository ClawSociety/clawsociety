// ─────────────────── MovementSystem ──────────────────────────
// Steering behaviors + inertia for organic player movement.
// Replaces sine/cosine jitter with velocity-based physics.

import type { Vec2, MatchEvent, PlayerFrame, PlayerState, Direction8, Team, Role } from '../types';
import { HOME_FORMATION, AWAY_FORMATION } from '../types';
import { angleToDir8 } from '../spriteLoader';

// ─── Physics Constants ──────────────────────────────────────
const MAX_SPEED = 0.003;      // per ms in normalized coords
const ACCEL = 0.00008;        // acceleration per ms
const FRICTION = 0.92;        // velocity decay per frame
const SEP_RADIUS = 0.07;      // separation distance
const SEP_FORCE = 0.00012;    // separation push — gentle, no jitter
const ARRIVE_RADIUS = 0.04;   // deceleration zone

// ─── Off-ball behavior constants ────────────────────────────
const GOLDEN_RATIO = 1.618033988749895;
const IDLE_DRIFT_AMP = 0.006;   // subtle drift (was 0.015 — too twitchy)
const IDLE_DRIFT_FREQ = 0.0003; // slow breathing rhythm (was 0.0008)
const SUPPORT_RUN_NUDGE = 0.015; // how far support runners push forward

// ─── Animation speed ────────────────────────────────────────
const ANIM_CYCLE_MS = 350;     // was 500ms — faster leg cycle (~17fps feel)

// ─── Per-Player State ───────────────────────────────────────

interface PlayerPhysics {
  team: Team;
  index: number;
  role: Role;
  vx: number;
  vy: number;
  px: number;
  py: number;
}

export class MovementSystem {
  private players: PlayerPhysics[] = [];

  constructor() {
    for (const formation of [HOME_FORMATION, AWAY_FORMATION]) {
      for (const p of formation) {
        this.players.push({
          team: p.team,
          index: p.index,
          role: p.role,
          vx: 0,
          vy: 0,
          px: p.basePos.x,
          py: p.basePos.y,
        });
      }
    }
  }

  /** Reset positions (e.g. on seek/replay) */
  reset() {
    let i = 0;
    for (const formation of [HOME_FORMATION, AWAY_FORMATION]) {
      for (const p of formation) {
        const pp = this.players[i++];
        pp.px = p.basePos.x;
        pp.py = p.basePos.y;
        pp.vx = 0;
        pp.vy = 0;
      }
    }
  }

  /**
   * Compute smooth player frames from target positions + event context.
   * @param targets - 10 target positions from FormationSystem
   * @param current - current match event (for actor/target overrides)
   * @param eventProgress - 0..1 within current event
   * @param deltaMs - frame delta in milliseconds
   * @param elapsedMs - total elapsed for anim tick
   */
  update(
    targets: Vec2[],
    current: MatchEvent | null,
    eventProgress: number,
    deltaMs: number,
    elapsedMs: number,
  ): PlayerFrame[] {
    const frames: PlayerFrame[] = [];
    const animTick = (elapsedMs % ANIM_CYCLE_MS) / ANIM_CYCLE_MS;
    const dt = Math.min(deltaMs, 32); // cap delta to prevent physics explosion

    // Ball position for facing + support runs
    const ballPos: Vec2 | null = current
      ? { x: current.ballFrom.x + (current.ballTo.x - current.ballFrom.x) * eventProgress,
          y: current.ballFrom.y + (current.ballTo.y - current.ballFrom.y) * eventProgress }
      : null;

    for (let i = 0; i < this.players.length; i++) {
      const pp = this.players[i];
      const target = targets[i];
      let state: PlayerState = 'idle';
      let overridePos: Vec2 | null = null;
      let facingTarget: Vec2 | null = null;
      let hasEventRole = false;

      // Check if this player has an event-driven override
      if (current) {
        const override = this.getEventOverride(pp, current, eventProgress);
        if (override) {
          hasEventRole = true;
          state = override.state;
          if (override.pos) overridePos = override.pos;
          if (override.facingTarget) facingTarget = override.facingTarget;
        }
      }

      if (overridePos) {
        // Smoothly steer toward event-driven position
        this.steerArrive(pp, overridePos.x, overridePos.y, dt);
      } else {
        // Off-ball behaviors: idle drift + support runs
        let tx = target.x;
        let ty = target.y;

        if (!hasEventRole && pp.role !== 'GK') {
          // 1. Gentle deterministic drift around target (sine wave keyed to index)
          const driftPhase = elapsedMs * IDLE_DRIFT_FREQ + i * GOLDEN_RATIO;
          const driftX = Math.sin(driftPhase * 2.3) * IDLE_DRIFT_AMP;
          const driftY = Math.cos(driftPhase * 1.7) * IDLE_DRIFT_AMP * 0.7;
          tx += driftX;
          ty += driftY;

          // 2. Support runs: when teammate has ball, push forward
          if (current && current.team === pp.team &&
              (current.type === 'pass' || current.type === 'dribble')) {
            const nudgeDir = pp.team === 'home' ? 1 : -1;
            if (pp.role === 'FWD' || pp.role === 'MID') {
              tx += nudgeDir * SUPPORT_RUN_NUDGE;
            }
          }
        }

        this.steerArrive(pp, tx, ty, dt);
      }

      // Separation from nearby players
      this.applySeparation(pp, i, dt);

      // Apply friction
      pp.vx *= FRICTION;
      pp.vy *= FRICTION;

      // Integrate position
      pp.px += pp.vx * dt;
      pp.py += pp.vy * dt;

      // Clamp to pitch
      pp.px = Math.max(0.02, Math.min(0.98, pp.px));
      pp.py = Math.max(0.05, Math.min(0.95, pp.py));

      // Determine animation state from velocity if not overridden
      // Threshold at 0.45 so idle drift doesn't trigger running bounce
      const speed = Math.sqrt(pp.vx * pp.vx + pp.vy * pp.vy);
      if (state === 'idle' && speed > MAX_SPEED * 0.45) {
        state = 'running';
      }

      // Facing direction: ball-aware when idle (not just default east/west)
      let dir: Direction8;
      if (facingTarget) {
        dir = angleToDir8(facingTarget.x - pp.px, facingTarget.y - pp.py);
      } else if (speed > MAX_SPEED * 0.1) {
        dir = angleToDir8(pp.vx, pp.vy);
      } else if (ballPos && !hasEventRole) {
        // Face the ball when idle — much more alive than staring east/west
        dir = angleToDir8(ballPos.x - pp.px, ballPos.y - pp.py);
      } else {
        dir = pp.team === 'home' ? 'east' : 'west';
      }

      frames.push({
        pos: { x: pp.px, y: pp.py },
        state,
        dir,
        animTick,
        team: pp.team,
        role: pp.role,
        index: pp.index,
      });
    }

    return frames;
  }

  // ─── Steering Behaviors ───────────────────────────────────

  /** Arrive: seek with deceleration near target */
  private steerArrive(pp: PlayerPhysics, tx: number, ty: number, dt: number) {
    const dx = tx - pp.px;
    const dy = ty - pp.py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.001) return; // close enough

    // Desired velocity direction
    const nx = dx / dist;
    const ny = dy / dist;

    // Speed ramps down inside arrive radius
    let desiredSpeed = MAX_SPEED;
    if (dist < ARRIVE_RADIUS) {
      desiredSpeed = MAX_SPEED * (dist / ARRIVE_RADIUS);
    }

    // Steering force = desired - current
    const steerX = nx * desiredSpeed - pp.vx;
    const steerY = ny * desiredSpeed - pp.vy;

    // Apply acceleration (clamped)
    const steerMag = Math.sqrt(steerX * steerX + steerY * steerY);
    if (steerMag > 0) {
      const scale = Math.min(ACCEL * dt, steerMag) / steerMag;
      pp.vx += steerX * scale;
      pp.vy += steerY * scale;
    }

    // Clamp velocity
    const vMag = Math.sqrt(pp.vx * pp.vx + pp.vy * pp.vy);
    if (vMag > MAX_SPEED) {
      pp.vx = (pp.vx / vMag) * MAX_SPEED;
      pp.vy = (pp.vy / vMag) * MAX_SPEED;
    }
  }

  /** Push away from nearby players */
  private applySeparation(pp: PlayerPhysics, selfIdx: number, dt: number) {
    for (let j = 0; j < this.players.length; j++) {
      if (j === selfIdx) continue;
      const other = this.players[j];
      const dx = pp.px - other.px;
      const dy = pp.py - other.py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < SEP_RADIUS && dist > 0.001) {
        const overlap = SEP_RADIUS - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        pp.vx += nx * overlap * SEP_FORCE * dt;
        pp.vy += ny * overlap * SEP_FORCE * dt;
      }
    }
  }

  // ─── Event Overrides ──────────────────────────────────────

  private getEventOverride(
    pp: PlayerPhysics,
    ev: MatchEvent,
    ep: number,
  ): { state: PlayerState; pos?: Vec2; facingTarget?: Vec2 } | null {
    const isActor = ev.team === pp.team && ev.playerIndex === pp.index;
    const isTarget = ev.team === pp.team && ev.targetIndex === pp.index;
    const isOppGK = pp.team !== ev.team && pp.role === 'GK';

    switch (ev.type) {
      case 'goal':
        if (ev.team === pp.team) {
          return { state: 'celebrating', facingTarget: { x: 0.5, y: 1.0 } };
        }
        return { state: 'idle' };

      case 'shot':
        if (isActor) {
          const t = this.easeOut(Math.min(1, ep * 1.5));
          return {
            state: ep > 0.4 ? 'kicking' : 'running',
            pos: this.lerp(this.getBase(pp), ev.ballFrom, t),
            facingTarget: ev.ballTo,
          };
        }
        if (isOppGK) {
          if (ep > 0.3) {
            return {
              state: 'diving',
              pos: { x: this.getBase(pp).x, y: this.lerpN(this.getBase(pp).y, ev.ballTo.y, this.easeOut((ep - 0.3) / 0.7)) },
              facingTarget: ev.ballTo,
            };
          }
          return {
            state: 'idle',
            pos: { x: this.getBase(pp).x, y: this.lerpN(this.getBase(pp).y, ev.ballTo.y, ep * 0.5) },
          };
        }
        break;

      case 'save':
        if (isOppGK) {
          if (ep > 0.3) {
            return {
              state: 'diving',
              pos: { x: this.getBase(pp).x, y: this.lerpN(this.getBase(pp).y, ev.ballTo.y, this.easeOut((ep - 0.3) / 0.7)) },
              facingTarget: ev.ballTo,
            };
          }
          return {
            state: 'idle',
            pos: { x: this.getBase(pp).x, y: this.lerpN(this.getBase(pp).y, ev.ballTo.y, ep * 0.5) },
          };
        }
        break;

      case 'pass':
        if (isActor) {
          const t = this.easeOut(Math.min(1, ep * 2));
          return {
            state: 'running',
            pos: this.lerp(this.getBase(pp), ev.ballFrom, t),
            facingTarget: ev.ballTo,
          };
        }
        if (isTarget) {
          const t = this.easeInOut(ep);
          return {
            state: 'running',
            pos: this.lerp(this.getBase(pp), ev.ballTo, t),
            facingTarget: ev.ballTo,
          };
        }
        break;

      case 'dribble':
        if (isActor) {
          const t = this.easeInOut(ep);
          return {
            state: 'running',
            pos: this.lerp(ev.ballFrom, ev.ballTo, t),
            facingTarget: ev.ballTo,
          };
        }
        break;

      case 'tackle':
        if (isActor) {
          const t = this.easeOut(Math.min(1, ep * 2));
          return {
            state: 'running',
            pos: this.lerp(this.getBase(pp), ev.ballFrom, t),
            facingTarget: ev.ballFrom,
          };
        }
        break;
    }

    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private getBase(pp: PlayerPhysics): Vec2 {
    const formations = pp.team === 'home' ? HOME_FORMATION : AWAY_FORMATION;
    const p = formations[pp.index];
    return p ? { ...p.basePos } : { x: 0.5, y: 0.5 };
  }

  private lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  private lerpN(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}
