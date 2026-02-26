// ─────────────────── FormationSystem ────────────────────────
// Tactical phase positioning. Detects game phase from current
// event and shifts formation targets accordingly.

import type { Vec2, MatchEvent, Team } from '../types';
import { HOME_FORMATION, AWAY_FORMATION } from '../types';

export type GamePhase = 'attacking' | 'defending' | 'transition' | 'set_piece';

// Phase shift amounts (in normalized coords)
const ATTACK_PUSH_X = 0.08;
const ATTACK_COMPRESS_Y = 0.6;  // compress toward ball y
const DEFEND_DROP_X = 0.06;
const DEFEND_SPREAD_Y = 1.15;   // spread y wider

// Transition interpolation speed
const TRANSITION_SPEED = 0.004; // per ms

export class FormationSystem {
  private currentTargets: Vec2[] = [];
  private desiredTargets: Vec2[] = [];
  private homePhase: GamePhase = 'set_piece';
  private awayPhase: GamePhase = 'set_piece';

  constructor() {
    // Initialize to base positions
    const all = [...HOME_FORMATION, ...AWAY_FORMATION];
    for (const p of all) {
      const base = { ...p.basePos };
      this.currentTargets.push(base);
      this.desiredTargets.push({ ...base });
    }
  }

  reset() {
    const all = [...HOME_FORMATION, ...AWAY_FORMATION];
    for (let i = 0; i < all.length; i++) {
      this.currentTargets[i] = { ...all[i].basePos };
      this.desiredTargets[i] = { ...all[i].basePos };
    }
    this.homePhase = 'set_piece';
    this.awayPhase = 'set_piece';
  }

  /**
   * Compute 10 target positions based on current event context.
   * @param current - current match event
   * @param eventProgress - 0..1 within event
   * @param deltaMs - frame delta
   * @returns 10 Vec2 target positions (5 home + 5 away)
   */
  update(current: MatchEvent | null, eventProgress: number, deltaMs: number): Vec2[] {
    // Detect phases
    if (!current || current.type === 'kickoff') {
      this.homePhase = 'set_piece';
      this.awayPhase = 'set_piece';
    } else if (current.type === 'goal') {
      this.homePhase = 'set_piece';
      this.awayPhase = 'set_piece';
    } else if (current.type === 'transition') {
      this.homePhase = 'transition';
      this.awayPhase = 'transition';
    } else {
      const possTeam = current.team;
      if (possTeam === 'home') {
        this.homePhase = 'attacking';
        this.awayPhase = 'defending';
      } else {
        this.homePhase = 'defending';
        this.awayPhase = 'attacking';
      }
    }

    // Compute desired targets
    const ballY = current ? (current.ballFrom.y + current.ballTo.y) / 2 : 0.5;

    for (let i = 0; i < 5; i++) {
      this.desiredTargets[i] = this.computeTarget(
        HOME_FORMATION[i].basePos,
        HOME_FORMATION[i].role,
        'home',
        this.homePhase,
        ballY,
      );
    }
    for (let i = 0; i < 5; i++) {
      this.desiredTargets[5 + i] = this.computeTarget(
        AWAY_FORMATION[i].basePos,
        AWAY_FORMATION[i].role,
        'away',
        this.awayPhase,
        ballY,
      );
    }

    // Phase-specific pressing: closest non-GK defender drifts toward ball
    if (current && current.type !== 'kickoff' && current.type !== 'goal') {
      const ballX = (current.ballFrom.x + current.ballTo.x) / 2;
      const ballYPos = ballY;

      // Find defending team's outfield player closest to ball → press
      const defendingTeam: Team | null =
        this.homePhase === 'defending' ? 'home' :
        this.awayPhase === 'defending' ? 'away' : null;

      if (defendingTeam) {
        const offset = defendingTeam === 'home' ? 0 : 5;
        const formation = defendingTeam === 'home' ? HOME_FORMATION : AWAY_FORMATION;
        let closestIdx = -1;
        let closestDist = Infinity;
        for (let j = 0; j < 5; j++) {
          if (formation[j].role === 'GK') continue;
          const dx = this.desiredTargets[offset + j].x - ballX;
          const dy = this.desiredTargets[offset + j].y - ballYPos;
          const d = dx * dx + dy * dy;
          if (d < closestDist) {
            closestDist = d;
            closestIdx = offset + j;
          }
        }
        if (closestIdx >= 0) {
          // Drift 40% toward ball position (pressing)
          const pressStrength = 0.4;
          this.desiredTargets[closestIdx].x += (ballX - this.desiredTargets[closestIdx].x) * pressStrength;
          this.desiredTargets[closestIdx].y += (ballYPos - this.desiredTargets[closestIdx].y) * pressStrength;
        }
      }
    }

    // Interpolate current toward desired
    const t = Math.min(1, TRANSITION_SPEED * deltaMs);
    for (let i = 0; i < 10; i++) {
      this.currentTargets[i].x += (this.desiredTargets[i].x - this.currentTargets[i].x) * t;
      this.currentTargets[i].y += (this.desiredTargets[i].y - this.currentTargets[i].y) * t;
    }

    // Return copies
    return this.currentTargets.map(p => ({ ...p }));
  }

  private computeTarget(
    base: Vec2,
    role: string,
    team: Team,
    phase: GamePhase,
    ballY: number,
  ): Vec2 {
    const target = { ...base };

    switch (phase) {
      case 'attacking': {
        // Push forward toward opponent goal
        const pushDir = team === 'home' ? 1 : -1;
        const pushAmount = role === 'GK' ? 0.02 : // GK barely moves
          role === 'DEF' ? ATTACK_PUSH_X * 0.5 :
          role === 'MID' ? ATTACK_PUSH_X * 0.8 :
          ATTACK_PUSH_X; // FWD pushes most

        target.x += pushDir * pushAmount;

        // Compress y toward ball
        if (role !== 'GK') {
          target.y = base.y + (ballY - base.y) * (1 - ATTACK_COMPRESS_Y);
        }
        break;
      }
      case 'defending': {
        // Drop back toward own goal
        const dropDir = team === 'home' ? -1 : 1;
        const dropAmount = role === 'GK' ? 0 : // GK stays
          role === 'FWD' ? DEFEND_DROP_X * 0.4 :
          role === 'MID' ? DEFEND_DROP_X * 0.7 :
          DEFEND_DROP_X; // DEF drops most

        target.x += dropDir * dropAmount;

        // Spread y to cover width
        if (role !== 'GK') {
          const centerY = 0.5;
          target.y = centerY + (base.y - centerY) * DEFEND_SPREAD_Y;
        }
        break;
      }
      case 'transition':
        // Stay near base positions, slight drift toward center
        target.x += (0.5 - base.x) * 0.05;
        break;

      case 'set_piece':
        // Use base positions directly
        break;
    }

    // Clamp GK near goal line
    if (role === 'GK') {
      if (team === 'home') {
        target.x = Math.min(0.12, Math.max(0.05, target.x));
      } else {
        target.x = Math.max(0.88, Math.min(0.95, target.x));
      }
    }

    // General clamp
    target.x = Math.max(0.03, Math.min(0.97, target.x));
    target.y = Math.max(0.06, Math.min(0.94, target.y));

    return target;
  }
}
