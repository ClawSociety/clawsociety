import { mulberry32, rngInt, rngFloat } from './prng';
import type {
  MatchEvent, MatchTimeline, Vec2, Team, PlayerStats, Formation,
} from './types';
import { HOME_FORMATION, AWAY_FORMATION, FORMATION_LAYOUTS } from './types';

// ─────────────────── Helpers ────────────────────────────────

function getFormationPlayers(team: Team, formation: Formation) {
  return FORMATION_LAYOUTS[formation]?.[team]
    ?? (team === 'home' ? HOME_FORMATION : AWAY_FORMATION);
}

function playerPos(team: Team, index: number, formation: Formation): Vec2 {
  const f = getFormationPlayers(team, formation);
  return { ...f[index].basePos };
}

function goalMouth(team: Team): Vec2 {
  return team === 'home' ? { x: 0.96, y: 0.5 } : { x: 0.04, y: 0.5 };
}

function midfield(): Vec2 {
  return { x: 0.5, y: 0.5 };
}

// ─────────────────── Stat-weighted player selection ──────────

type RNG = () => number;

/** Pick a player index weighted by a specific stat */
function weightedPickByStat(
  rng: RNG,
  stats: PlayerStats[],
  statKey: keyof PlayerStats,
  candidates: number[],
): number {
  if (candidates.length === 0) return 0;
  if (candidates.length === 1) return candidates[0];

  let totalWeight = 0;
  const weights: number[] = [];
  for (const idx of candidates) {
    const w = Math.max(1, stats[idx][statKey]);
    weights.push(w);
    totalWeight += w;
  }

  let roll = rng() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ─────────────────── Timeline Generator ─────────────────────

const NUM_PHASES = 10;
const PHASE_DUR = 1 / NUM_PHASES;

export interface GenerateTimelineOptions {
  homeGoals: number;
  awayGoals: number;
  seed: bigint;
  homeStats?: PlayerStats[];
  awayStats?: PlayerStats[];
  homeFormation?: Formation;
  awayFormation?: Formation;
  homePower?: number;
  awayPower?: number;
}

export function generateTimeline(opts: GenerateTimelineOptions): MatchTimeline;
/** Legacy signature for backwards compatibility */
export function generateTimeline(
  homeGoals: number,
  awayGoals: number,
  seed: bigint,
  homePower?: number,
  awayPower?: number,
): MatchTimeline;
export function generateTimeline(
  homeGoalsOrOpts: number | GenerateTimelineOptions,
  awayGoals?: number,
  seed?: bigint,
  homePower?: number,
  awayPower?: number,
): MatchTimeline {
  // Normalize arguments
  let opts: GenerateTimelineOptions;
  if (typeof homeGoalsOrOpts === 'object') {
    opts = homeGoalsOrOpts;
  } else {
    opts = {
      homeGoals: homeGoalsOrOpts,
      awayGoals: awayGoals!,
      seed: seed!,
      homePower,
      awayPower,
    };
  }

  const defaultStats: PlayerStats = { speed: 50, passing: 50, shooting: 50, defense: 50, stamina: 50 };
  const homeStats = opts.homeStats ?? Array(5).fill(defaultStats);
  const awayStats = opts.awayStats ?? Array(5).fill(defaultStats);
  const homeForm = opts.homeFormation ?? 'balanced';
  const awayForm = opts.awayFormation ?? 'balanced';

  const rng = mulberry32(Number(opts.seed & 0xFFFFFFFFn));

  // Possession bias from power or stats (treat 0 as unknown → compute from stats)
  const hp = opts.homePower || homeStats.reduce((s, p) => s + (p.speed + p.passing + p.shooting + p.defense + p.stamina) / 5, 0);
  const ap = opts.awayPower || awayStats.reduce((s, p) => s + (p.speed + p.passing + p.shooting + p.defense + p.stamina) / 5, 0);
  const homeChance = hp / (hp + ap + 0.001);

  // ── Distribute goals across phases ──
  const totalGoals = opts.homeGoals + opts.awayGoals;
  const goalPhases: { phase: number; team: Team }[] = [];

  if (totalGoals > 0) {
    const goalTeams: Team[] = [];
    for (let i = 0; i < opts.homeGoals; i++) goalTeams.push('home');
    for (let i = 0; i < opts.awayGoals; i++) goalTeams.push('away');

    // Bias toward later phases for drama
    const available = Array.from({ length: NUM_PHASES }, (_, i) => i);
    const candidates = available.filter(p => p >= 2);
    const used = new Set<number>();

    for (let g = 0; g < totalGoals; g++) {
      const pool = (candidates.length > 0 ? candidates : available).filter(p => !used.has(p));
      if (pool.length === 0) break;
      const idx = Math.floor(rng() * pool.length);
      const phase = pool[idx];
      used.add(phase);
      goalPhases.push({ phase, team: goalTeams[g] });
    }
    goalPhases.sort((a, b) => a.phase - b.phase);
  }

  // ── Generate events per phase ──
  const events: MatchEvent[] = [];
  let ballPos: Vec2 = midfield();

  // Kickoff
  events.push({
    time: 0,
    duration: PHASE_DUR * 0.2,
    type: 'kickoff',
    team: 'home',
    playerIndex: 3,
    ballFrom: midfield(),
    ballTo: midfield(),
    ballArc: 0,
  });

  for (let phase = 0; phase < NUM_PHASES; phase++) {
    const phaseStart = phase * PHASE_DUR;
    const goalInPhase = goalPhases.find(g => g.phase === phase);
    const possTeam: Team = rng() < homeChance ? 'home' : 'away';
    const teamStats = possTeam === 'home' ? homeStats : awayStats;
    const teamForm = possTeam === 'home' ? homeForm : awayForm;
    const oppTeam: Team = possTeam === 'home' ? 'away' : 'home';
    const oppStats = possTeam === 'home' ? awayStats : homeStats;

    let t = phaseStart + PHASE_DUR * 0.05;
    const step = PHASE_DUR / 4;

    // ── Event 1: Pass (buildup) — weighted by PAS stat ──
    const outfield = [1, 2, 3, 4];
    const passer = weightedPickByStat(rng, teamStats, 'passing', outfield);
    const receiverCandidates = outfield.filter(i => i !== passer);
    const receiver = weightedPickByStat(rng, teamStats, 'passing', receiverCandidates);

    const passFrom = ballPos;
    const passTo = playerPos(possTeam, receiver, teamForm);
    passTo.y += rngFloat(rng, -0.08, 0.08);

    events.push({
      time: t,
      duration: step * 0.8,
      type: 'pass',
      team: possTeam,
      playerIndex: passer,
      targetIndex: receiver,
      ballFrom: passFrom,
      ballTo: passTo,
      ballArc: rng() > 0.7 ? 0.5 : 0,
    });
    ballPos = passTo;
    t += step;

    // ── Event 2: Dribble or second pass — weighted by SPD ──
    if (rng() > 0.4) {
      const dribbler = receiver;
      const dribbleTo: Vec2 = {
        x: ballPos.x + (possTeam === 'home' ? rngFloat(rng, 0.05, 0.12) : rngFloat(rng, -0.12, -0.05)),
        y: ballPos.y + rngFloat(rng, -0.1, 0.1),
      };
      dribbleTo.x = Math.max(0.05, Math.min(0.95, dribbleTo.x));
      dribbleTo.y = Math.max(0.08, Math.min(0.92, dribbleTo.y));

      events.push({
        time: t,
        duration: step * 0.7,
        type: 'dribble',
        team: possTeam,
        playerIndex: dribbler,
        ballFrom: ballPos,
        ballTo: dribbleTo,
        ballArc: 0,
      });
      ballPos = dribbleTo;
    } else {
      const p2 = weightedPickByStat(rng, teamStats, 'passing', [2, 3, 4]);
      const passTo2 = playerPos(possTeam, p2, teamForm);
      passTo2.y += rngFloat(rng, -0.06, 0.06);
      events.push({
        time: t,
        duration: step * 0.8,
        type: 'pass',
        team: possTeam,
        playerIndex: receiver,
        targetIndex: p2,
        ballFrom: ballPos,
        ballTo: passTo2,
        ballArc: 0,
      });
      ballPos = passTo2;
    }
    t += step;

    // ── Event 3: Tackle or shot ──
    if (!goalInPhase && rng() > 0.5) {
      // Tackle — weighted by DEF stat
      const tackler = weightedPickByStat(rng, oppStats, 'defense', [1, 2, 3]);
      const tacklePos = { ...ballPos };
      events.push({
        time: t,
        duration: step * 0.5,
        type: 'tackle',
        team: oppTeam,
        playerIndex: tackler,
        ballFrom: ballPos,
        ballTo: tacklePos,
        ballArc: 0,
      });
      t += step;

      const oppForm = possTeam === 'home' ? awayForm : homeForm;
      const clearTo = playerPos(oppTeam, rngInt(rng, 2, 4), oppForm);
      events.push({
        time: t,
        duration: step * 0.6,
        type: 'pass',
        team: oppTeam,
        playerIndex: tackler,
        targetIndex: 3,
        ballFrom: tacklePos,
        ballTo: clearTo,
        ballArc: 0.3,
      });
      ballPos = clearTo;
    } else {
      // Shot — weighted by SHO stat
      const shooter = weightedPickByStat(rng, teamStats, 'shooting', [3, 4]);
      const target = goalMouth(possTeam);
      target.y += rngFloat(rng, -0.15, 0.15);

      if (goalInPhase && goalInPhase.team === possTeam) {
        // GOAL
        events.push({
          time: t,
          duration: step * 0.6,
          type: 'shot',
          team: possTeam,
          playerIndex: shooter,
          ballFrom: ballPos,
          ballTo: target,
          ballArc: rng() > 0.5 ? 0.4 : 0.1,
        });
        t += step * 0.6;

        events.push({
          time: t,
          duration: step * 1.2,
          type: 'goal',
          team: possTeam,
          playerIndex: shooter,
          ballFrom: target,
          ballTo: target,
          ballArc: 0,
        });
        ballPos = midfield();
      } else if (goalInPhase && goalInPhase.team !== possTeam) {
        // Counter-attack goal
        const tackler2 = weightedPickByStat(rng, oppStats, 'defense', [1, 2, 3]);
        events.push({
          time: t,
          duration: step * 0.4,
          type: 'tackle',
          team: goalInPhase.team,
          playerIndex: tackler2,
          ballFrom: ballPos,
          ballTo: ballPos,
          ballArc: 0,
        });
        t += step * 0.5;

        const counterStats = goalInPhase.team === 'home' ? homeStats : awayStats;
        const counterForm = goalInPhase.team === 'home' ? homeForm : awayForm;
        const counterShooter = weightedPickByStat(rng, counterStats, 'shooting', [3, 4]);
        const counterTarget = goalMouth(goalInPhase.team);
        counterTarget.y += rngFloat(rng, -0.12, 0.12);

        events.push({
          time: t,
          duration: step * 0.5,
          type: 'shot',
          team: goalInPhase.team,
          playerIndex: counterShooter,
          ballFrom: playerPos(goalInPhase.team, counterShooter, counterForm),
          ballTo: counterTarget,
          ballArc: 0.3,
        });
        t += step * 0.5;

        events.push({
          time: t,
          duration: step * 1.0,
          type: 'goal',
          team: goalInPhase.team,
          playerIndex: counterShooter,
          ballFrom: counterTarget,
          ballTo: counterTarget,
          ballArc: 0,
        });
        ballPos = midfield();
      } else {
        // Shot → save
        events.push({
          time: t,
          duration: step * 0.6,
          type: 'shot',
          team: possTeam,
          playerIndex: shooter,
          ballFrom: ballPos,
          ballTo: target,
          ballArc: rng() > 0.6 ? 0.5 : 0.1,
        });
        t += step * 0.7;

        events.push({
          time: t,
          duration: step * 0.5,
          type: 'save',
          team: oppTeam,
          playerIndex: 0, // GK
          ballFrom: target,
          ballTo: { x: target.x + (oppTeam === 'home' ? -0.1 : 0.1), y: target.y + rngFloat(rng, -0.1, 0.1) },
          ballArc: 0.2,
        });
        ballPos = playerPos(oppTeam, 0, possTeam === 'home' ? awayForm : homeForm);
      }
    }
  }

  return { events, homeGoals: opts.homeGoals, awayGoals: opts.awayGoals };
}
