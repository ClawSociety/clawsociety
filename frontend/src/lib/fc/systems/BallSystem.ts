// ─────────────────── BallSystem ──────────────────────────────
// Ball state machine with bezier trajectories.
// States: HELD, IN_FLIGHT, LOOSE, IN_NET.

import type { Vec2, MatchEvent, EventType } from '../types';

export type BallState = 'held' | 'in_flight' | 'loose' | 'in_net';

// Feet offset when ball is held by carrier (normalized coords)
const CARRY_OFFSET_X = 0.02;
const CARRY_OFFSET_Y = 0.008;

// Loose ball deceleration
const LOOSE_FRICTION = 0.96;

// Events where ball is in flight
const FLIGHT_EVENTS: EventType[] = ['pass', 'shot', 'save'];
// Events where ball is held by actor
const HELD_EVENTS: EventType[] = ['dribble', 'kickoff'];

export interface BallFrame {
  pos: Vec2;
  state: BallState;
  speed: number; // 0..1 normalized speed for visual effects
}

export class BallSystem {
  private pos: Vec2 = { x: 0.5, y: 0.5 };
  private prevPos: Vec2 = { x: 0.5, y: 0.5 };
  private looseVx = 0;
  private looseVy = 0;
  private state: BallState = 'held';

  reset() {
    this.pos = { x: 0.5, y: 0.5 };
    this.prevPos = { x: 0.5, y: 0.5 };
    this.looseVx = 0;
    this.looseVy = 0;
    this.state = 'held';
  }

  /**
   * Compute ball position + state for this frame.
   * @param current - current match event
   * @param eventProgress - 0..1 within event
   * @param carrierPos - position of the ball carrier (actor) if relevant
   * @param deltaMs - frame delta
   */
  update(
    current: MatchEvent | null,
    eventProgress: number,
    carrierPos: Vec2 | null,
    deltaMs: number,
  ): BallFrame {
    this.prevPos = { ...this.pos };

    if (!current) {
      return { pos: { ...this.pos }, state: this.state, speed: 0 };
    }

    const ep = eventProgress;

    if (current.type === 'goal') {
      // Ball stays at goal mouth
      this.state = 'in_net';
      this.pos = { ...current.ballTo };
    } else if (current.type === 'tackle') {
      // Ball becomes loose after tackle
      if (ep < 0.4) {
        // Still held by original carrier
        this.state = 'held';
        if (carrierPos) {
          this.pos = this.carriedPos(carrierPos, current.team === 'home');
        }
      } else {
        // Loose: decelerate from tackle position
        this.state = 'loose';
        if (ep < 0.45) {
          // Initialize loose velocity from tackle direction
          const dx = current.ballTo.x - current.ballFrom.x;
          const dy = current.ballTo.y - current.ballFrom.y;
          this.looseVx = dx * 0.003;
          this.looseVy = dy * 0.003;
          this.pos = { ...current.ballFrom };
        }
        this.pos.x += this.looseVx * deltaMs;
        this.pos.y += this.looseVy * deltaMs;
        this.looseVx *= LOOSE_FRICTION;
        this.looseVy *= LOOSE_FRICTION;
      }
    } else if (HELD_EVENTS.includes(current.type)) {
      // Ball follows carrier
      this.state = 'held';
      if (carrierPos) {
        this.pos = this.carriedPos(carrierPos, current.team === 'home');
      } else {
        // Fallback: lerp
        this.pos = this.lerpPos(current.ballFrom, current.ballTo, this.easeInOut(ep));
      }
    } else if (FLIGHT_EVENTS.includes(current.type)) {
      // Quadratic bezier trajectory with gravity curve
      this.state = 'in_flight';
      const t = this.gravityEase(Math.min(1, ep));
      this.pos = this.bezierPos(current.ballFrom, current.ballTo, current.ballArc, t, current.type === 'shot');
    } else if (current.type === 'transition') {
      // During transition, ball drifts toward new position
      this.state = 'loose';
      this.pos = this.lerpPos(current.ballFrom, current.ballTo, this.easeInOut(ep));
    } else {
      // Default: lerp
      this.pos = this.lerpPos(current.ballFrom, current.ballTo, this.easeInOut(ep));
    }

    // Clamp (allow ball to go into goal area beyond pitch boundary)
    this.pos.x = Math.max(-0.05, Math.min(1.05, this.pos.x));
    this.pos.y = Math.max(0.03, Math.min(0.97, this.pos.y));

    // Compute speed for visual effects
    const dx = this.pos.x - this.prevPos.x;
    const dy = this.pos.y - this.prevPos.y;
    const rawSpeed = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.min(1, rawSpeed / 0.02); // normalize

    return { pos: { ...this.pos }, state: this.state, speed };
  }

  // ─── Trajectories ────────────────────────────────────────

  /** Quadratic bezier with arc control point */
  private bezierPos(from: Vec2, to: Vec2, arc: number, t: number, isShot: boolean): Vec2 {
    // Control point: midpoint raised by arc amount
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;

    // Arc lifts control point perpendicular to travel direction
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    // Perpendicular direction (choose upward for lobs)
    let perpX = 0;
    let perpY = -1;
    if (len > 0.001) {
      perpX = -dy / len;
      perpY = dx / len;
      // Ensure arc goes upward (negative y in screen space)
      if (perpY > 0) {
        perpX = -perpX;
        perpY = -perpY;
      }
    }

    const arcHeight = arc * 0.15 * (isShot ? 0.6 : 1.0);
    const cx = mx + perpX * arcHeight;
    const cy = my + perpY * arcHeight;

    // B(t) = (1-t)^2 * P0 + 2(1-t)t * C + t^2 * P1
    const omt = 1 - t;
    return {
      x: omt * omt * from.x + 2 * omt * t * cx + t * t * to.x,
      y: omt * omt * from.y + 2 * omt * t * cy + t * t * to.y,
    };
  }

  /** Position at carrier's feet */
  private carriedPos(carrier: Vec2, isHome: boolean): Vec2 {
    return {
      x: carrier.x + (isHome ? CARRY_OFFSET_X : -CARRY_OFFSET_X),
      y: carrier.y + CARRY_OFFSET_Y,
    };
  }

  private lerpPos(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /** Asymmetric gravity curve: fast launch (kick), slow apex, accelerate into landing */
  private gravityEase(t: number): number {
    if (t < 0.5) {
      // easeOutQuad: fast start (ball leaves foot quickly)
      const t2 = t * 2;
      return (1 - (1 - t2) * (1 - t2)) * 0.5;
    } else {
      // easeInQuad: gravity pulls ball down into target
      const t2 = (t - 0.5) * 2;
      return 0.5 + t2 * t2 * 0.5;
    }
  }
}
