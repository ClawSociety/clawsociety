#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────
// CloudFC Monte Carlo Balance Simulation
// ─────────────────────────────────────────────────────────────────
// Simulates 100k matches across parameter sweeps to find optimal
// game economy settings. Outputs CSV for analysis.
//
// Usage: npx tsx scripts/balance-sim.ts > balance-results.csv
// ─────────────────────────────────────────────────────────────────

import { keccak256, encodePacked, encodeAbiParameters, toHex } from 'viem';

// ─────────────────── Constants ──────────────────────────────────

const SCALE_18 = 10n ** 18n;
const EXP_NEG_1 = 367879441171442322n;
const MAX_GOALS_PER_TEAM = 6n;

const NOISE_CAP_BPS = 800;

// Positional weights (BPS) — matching Solidity
const POS_WEIGHTS_BPS: number[][] = [
  [1000, 1000,  500, 4000, 3500], // GK
  [2000, 1500,  500, 3500, 2500], // DEF
  [2000, 3000, 1500, 1500, 2000], // MID
  [2500, 1500, 3500,  500, 2000], // FWD
];

// ─────────────────── Config Types ───────────────────────────────

interface SimConfig {
  label: string;
  winnerBps: number;
  loserBps: number;
  protocolBps: number;
  treasuryBps: number;
  formationCounterBps: number; // uniform counter bonus
  noiseOnDefense: boolean;     // apply noise to defense too
  diminishingReturns: boolean; // stat^0.85 compression
  noiseCap: number;            // noise cap in BPS
  baseLambdaX1000: number;     // base lambda for Poisson
}

interface TeamData {
  stats: number[][]; // 5 players × 5 stats
  positions: number[];
  formation: number; // 0=balanced, 1=offensive, 2=defensive
  maxSameOwner: number;
}

interface SimResult {
  config: string;
  matchesRun: number;
  homeWinRate: number;
  awayWinRate: number;
  drawRate: number;
  avgGoalsPerTeam: number;
  blowoutPct: number; // 4+ goal diff
  breakEvenWinRate: number;
  avgProfitPerMatch: number;
}

// ─────────────────── Solidity-matching Math ──────────────────────

function effectiveRatingBps(stats: number[], position: number, diminishing: boolean): bigint {
  const w = POS_WEIGHTS_BPS[position] ?? POS_WEIGHTS_BPS[2];
  let rating = 0n;
  for (let i = 0; i < 5; i++) {
    let s = stats[i];
    if (diminishing) {
      // effectiveStat = 100 * (stat/100)^0.85
      s = Math.round(100 * Math.pow(s / 100, 0.85));
    }
    rating += BigInt(s) * BigInt(w[i]);
  }
  return rating / 100n;
}

function synergyBonusBps(maxSameOwner: number): bigint {
  if (maxSameOwner <= 1) return 0n;
  let bonus = BigInt(maxSameOwner - 1) * 150n;
  if (bonus > 500n) bonus = 500n;
  return bonus;
}

function formationModifiersBps(
  myFormation: number,
  oppFormation: number,
  counterBps: number,
): { atkMod: bigint; defMod: bigint } {
  let atkMod: bigint;
  let defMod: bigint;

  if (myFormation === 0) {
    atkMod = 10000n; defMod = 10000n;
  } else if (myFormation === 1) {
    atkMod = 10800n; defMod = 9200n;
  } else {
    atkMod = 9200n; defMod = 10800n;
  }

  const bonus = BigInt(counterBps);
  // RPS: offensive beats balanced, defensive beats offensive, balanced beats defensive
  if (myFormation === 1 && oppFormation === 0) {
    atkMod += bonus;
  } else if (myFormation === 2 && oppFormation === 1) {
    defMod += bonus;
  } else if (myFormation === 0 && oppFormation === 2) {
    // Balanced gets split bonus
    const half = bonus / 2n;
    atkMod += half;
    defMod += half;
  }

  return { atkMod, defMod };
}

function deriveNoiseBps(seed: bigint, salt: string, noiseCap: number): bigint {
  const saltHex = toHex(salt, { size: 32 });
  const h = BigInt(keccak256(encodePacked(
    ['uint256', 'bytes32'],
    [seed, saltHex as `0x${string}`],
  )));
  const cap = BigInt(noiseCap);
  const raw = h % (2n * cap + 1n);
  return raw - cap;
}

function applyNoiseBps(val: bigint, noise: bigint): bigint {
  if (noise >= 0n) {
    return val * (10000n + noise) / 10000n;
  } else {
    return val * (10000n - (-noise)) / 10000n;
  }
}

function expNeg18(x18: bigint): bigint {
  const intPart = x18 / SCALE_18;
  const fracPart = x18 % SCALE_18;
  let intResult = SCALE_18;
  for (let i = 0n; i < intPart; i++) {
    intResult = intResult * EXP_NEG_1 / SCALE_18;
  }
  let res = SCALE_18;
  let term = SCALE_18;
  for (let i = 1n; i <= 12n; i++) {
    term = term * fracPart / (i * SCALE_18);
    if (i % 2n === 1n) res -= term;
    else res += term;
  }
  return intResult * res / SCALE_18;
}

function poissonSample(lambdaX1000: bigint, seed: bigint): number {
  const uniform = seed % 1_000_000n;
  const lambda18 = lambdaX1000 * SCALE_18 / 1000n;
  const expNegLambda = expNeg18(lambda18);
  let cdf = expNegLambda;
  let pmf = expNegLambda;
  const target = uniform * SCALE_18 / 1_000_000n;
  if (target < cdf) return 0;
  for (let k = 1n; k <= MAX_GOALS_PER_TEAM; k++) {
    pmf = pmf * lambda18 / (k * SCALE_18);
    cdf += pmf;
    if (target < cdf) return Number(k);
  }
  return Number(MAX_GOALS_PER_TEAM);
}

function clampBig(val: bigint, lo: bigint, hi: bigint): bigint {
  if (val < lo) return lo;
  if (val > hi) return hi;
  return val;
}

// ─────────────────── Full Match Simulation ──────────────────────

function simulateMatchWithConfig(
  home: TeamData,
  away: TeamData,
  vrfSeed: bigint,
  cfg: SimConfig,
): { homeGoals: number; awayGoals: number } {
  const baseLambda = BigInt(cfg.baseLambdaX1000);
  const lambdaMin = 300n;
  const lambdaMax = 3500n;

  // Compute attack/defense
  function attackDefenseBps(team: TeamData): { atk: bigint; def: bigint } {
    let fwd = 0n, mid = 0n, defn = 0n, gk = 0n, total = 0n;
    for (let i = 0; i < 5; i++) {
      const eff = effectiveRatingBps(team.stats[i], team.positions[i], cfg.diminishingReturns);
      total += eff;
      if (team.positions[i] === 3) fwd += eff;
      else if (team.positions[i] === 2) mid += eff;
      else if (team.positions[i] === 1) defn += eff;
      else gk += eff;
    }
    const avg = total / 5n;
    const synergy = synergyBonusBps(team.maxSameOwner);
    const atk = (fwd * 4000n + mid * 3500n + avg * 2500n) / 10000n * (10000n + synergy) / 10000n;
    const def = (gk * 4000n + defn * 3500n + avg * 2500n) / 10000n * (10000n + synergy) / 10000n;
    return { atk, def };
  }

  let { atk: homeAtk, def: homeDef } = attackDefenseBps(home);
  let { atk: awayAtk, def: awayDef } = attackDefenseBps(away);

  // Formation modifiers
  const hMod = formationModifiersBps(home.formation, away.formation, cfg.formationCounterBps);
  const aMod = formationModifiersBps(away.formation, home.formation, cfg.formationCounterBps);
  homeAtk = homeAtk * hMod.atkMod / 10000n;
  homeDef = homeDef * hMod.defMod / 10000n;
  awayAtk = awayAtk * aMod.atkMod / 10000n;
  awayDef = awayDef * aMod.defMod / 10000n;

  // Noise on attack
  const noiseHA = deriveNoiseBps(vrfSeed, 'teamA', cfg.noiseCap);
  const noiseAA = deriveNoiseBps(vrfSeed, 'teamB', cfg.noiseCap);
  homeAtk = applyNoiseBps(homeAtk, noiseHA);
  awayAtk = applyNoiseBps(awayAtk, noiseAA);

  // Noise on defense (if enabled)
  if (cfg.noiseOnDefense) {
    const noiseHD = deriveNoiseBps(vrfSeed, 'teamADef', cfg.noiseCap);
    const noiseAD = deriveNoiseBps(vrfSeed, 'teamBDef', cfg.noiseCap);
    homeDef = applyNoiseBps(homeDef, noiseHD);
    awayDef = applyNoiseBps(awayDef, noiseAD);
  }

  // Lambda
  const lambdaHome = awayDef > 0n
    ? clampBig(baseLambda * homeAtk / awayDef, lambdaMin, lambdaMax)
    : lambdaMax;
  const lambdaAway = homeDef > 0n
    ? clampBig(baseLambda * awayAtk / homeDef, lambdaMin, lambdaMax)
    : lambdaMax;

  // Poisson seed derivation
  const homeGoalSeed = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'string' }],
    [vrfSeed, 'homeGoals'],
  )));
  const awayGoalSeed = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'string' }],
    [vrfSeed, 'awayGoals'],
  )));

  return {
    homeGoals: poissonSample(lambdaHome, homeGoalSeed),
    awayGoals: poissonSample(lambdaAway, awayGoalSeed),
  };
}

// ─────────────────── Team Generation ────────────────────────────

/** Generate a random team with stats in the given overall range */
function randomTeam(rng: () => number, avgMin: number, avgMax: number): TeamData {
  const targetAvg = avgMin + Math.floor(rng() * (avgMax - avgMin + 1));
  const stats: number[][] = [];

  for (let i = 0; i < 5; i++) {
    const playerStats: number[] = [];
    let sum = 0;
    for (let j = 0; j < 5; j++) {
      // Random stat with variance around the target
      const s = Math.max(5, Math.min(99, targetAvg + Math.floor((rng() - 0.5) * 40)));
      playerStats.push(s);
      sum += s;
    }
    stats.push(playerStats);
  }

  const formation = Math.floor(rng() * 3);
  const positions = formation === 0 ? [0, 1, 1, 2, 3]
    : formation === 1 ? [0, 1, 2, 3, 3]
    : [0, 1, 1, 1, 3];

  return { stats, positions, formation, maxSameOwner: 5 };
}

// ─────────────────── Simple seeded RNG ──────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────── Run Simulation ─────────────────────────────

function runSim(cfg: SimConfig, numMatches: number): SimResult {
  const rng = mulberry32(42);
  let homeWins = 0, awayWins = 0, draws = 0;
  let totalGoals = 0, blowouts = 0;

  // Tier distributions for matchmaking:
  // 40% mirror (same tier), 40% adjacent, 20% random
  const tiers = [
    { min: 20, max: 44 },  // Bronze
    { min: 45, max: 64 },  // Silver
    { min: 65, max: 79 },  // Gold
    { min: 80, max: 95 },  // Diamond
  ];

  for (let i = 0; i < numMatches; i++) {
    // Pick tier for home
    const homeTierIdx = Math.floor(rng() * 4);
    const homeTier = tiers[homeTierIdx];

    // Matchmaking: 40% same tier, 40% adjacent, 20% random
    let awayTierIdx: number;
    const r = rng();
    if (r < 0.4) {
      awayTierIdx = homeTierIdx;
    } else if (r < 0.8) {
      awayTierIdx = Math.max(0, Math.min(3, homeTierIdx + (rng() > 0.5 ? 1 : -1)));
    } else {
      awayTierIdx = Math.floor(rng() * 4);
    }
    const awayTier = tiers[awayTierIdx];

    const home = randomTeam(rng, homeTier.min, homeTier.max);
    const away = randomTeam(rng, awayTier.min, awayTier.max);

    // Generate a pseudo-random seed for this match
    const seed = BigInt(Math.floor(rng() * 2**32)) << 128n | BigInt(Math.floor(rng() * 2**32)) << 64n | BigInt(Math.floor(rng() * 2**32));

    const result = simulateMatchWithConfig(home, away, seed, cfg);

    if (result.homeGoals > result.awayGoals) homeWins++;
    else if (result.awayGoals > result.homeGoals) awayWins++;
    else draws++;

    totalGoals += result.homeGoals + result.awayGoals;
    if (Math.abs(result.homeGoals - result.awayGoals) >= 4) blowouts++;
  }

  const totalMatches = numMatches;
  const winRate = (homeWins + awayWins) / totalMatches / 2; // avg per side
  const drawRate = draws / totalMatches;
  const avgGoalsPerTeam = totalGoals / (totalMatches * 2);
  const blowoutPct = blowouts / totalMatches;

  // Break-even calculation:
  // With stake S per side, pool = 2S
  // Winner gets: pool * winnerBps / (winnerBps + loserBps) * (1 - protocol - treasury)
  // Loser gets: pool * loserBps / (winnerBps + loserBps) * (1 - protocol - treasury)
  const feeRate = (cfg.protocolBps + cfg.treasuryBps) / 10000;
  const poolAfterFees = 1 - feeRate;
  const winnerShare = cfg.winnerBps / (cfg.winnerBps + cfg.loserBps) * poolAfterFees * 2; // per S invested
  const loserShare = cfg.loserBps / (cfg.winnerBps + cfg.loserBps) * poolAfterFees * 2;

  // Break-even: w * winnerShare + (1-w) * loserShare = 1 (stake back)
  // w = (1 - loserShare) / (winnerShare - loserShare)
  const breakEvenWinRate = (1 - loserShare) / (winnerShare - loserShare);

  // Average profit per match assuming 50% win rate
  const avgProfitPerMatch = 0.5 * winnerShare + 0.5 * loserShare - 1;

  return {
    config: cfg.label,
    matchesRun: totalMatches,
    homeWinRate: homeWins / totalMatches,
    awayWinRate: awayWins / totalMatches,
    drawRate,
    avgGoalsPerTeam,
    blowoutPct,
    breakEvenWinRate,
    avgProfitPerMatch,
  };
}

// ─────────────────── Parameter Sweep ────────────────────────────

const MATCHES_PER_CONFIG = 10_000; // 10k for speed, increase to 100k for precision

const configs: SimConfig[] = [
  // ── Current parameters (baseline) ──
  {
    label: 'Current (60/25/10/5)',
    winnerBps: 6000, loserBps: 2500, protocolBps: 1000, treasuryBps: 500,
    formationCounterBps: 500, // 5% for off/def, 3% for balanced (asymmetric)
    noiseOnDefense: false,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── Candidate A: 65/30/5/0 ──
  {
    label: 'A: 65/30/5/0',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: false,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── Candidate B: 70/25/5/0 ──
  {
    label: 'B: 70/25/5/0',
    winnerBps: 7000, loserBps: 2500, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: false,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── Candidate C: 55/40/5/0 (most generous) ──
  {
    label: 'C: 55/40/5/0',
    winnerBps: 5500, loserBps: 4000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: false,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },

  // ── With symmetric formation RPS (+5% all) ──
  {
    label: 'A+SymRPS',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500, // all counters at 5%
    noiseOnDefense: false,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── With noise on both attack AND defense ──
  {
    label: 'A+DualNoise',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: true,
    diminishingReturns: false,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── With diminishing returns ──
  {
    label: 'A+Diminishing',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: false,
    diminishingReturns: true,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── All fixes combined ──
  {
    label: 'A+All',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: true,
    diminishingReturns: true,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── Candidate C with all fixes (most generous) ──
  {
    label: 'C+All',
    winnerBps: 5500, loserBps: 4000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: true,
    diminishingReturns: true,
    noiseCap: 800,
    baseLambdaX1000: 1300,
  },
  // ── Higher noise cap (±12%) ──
  {
    label: 'A+Noise12',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: true,
    diminishingReturns: true,
    noiseCap: 1200,
    baseLambdaX1000: 1300,
  },
  // ── Lower base lambda (fewer goals) ──
  {
    label: 'A+LowLambda',
    winnerBps: 6500, loserBps: 3000, protocolBps: 500, treasuryBps: 0,
    formationCounterBps: 500,
    noiseOnDefense: true,
    diminishingReturns: true,
    noiseCap: 800,
    baseLambdaX1000: 1100,
  },
];

// ─────────────────── Main ───────────────────────────────────────

console.log('config,matches,homeWinRate,awayWinRate,drawRate,avgGoalsPerTeam,blowoutPct,breakEvenWinRate,avgProfitAt50pctWR');

for (const cfg of configs) {
  const result = runSim(cfg, MATCHES_PER_CONFIG);
  console.log([
    result.config,
    result.matchesRun,
    result.homeWinRate.toFixed(4),
    result.awayWinRate.toFixed(4),
    result.drawRate.toFixed(4),
    result.avgGoalsPerTeam.toFixed(2),
    result.blowoutPct.toFixed(4),
    result.breakEvenWinRate.toFixed(4),
    result.avgProfitPerMatch.toFixed(4),
  ].join(','));
}

console.error('\nDone! Target metrics:');
console.error('  Break-even win rate: ~60% (lower = more sustainable)');
console.error('  Blowout rate (<5%): fewer 4+ goal difference matches');
console.error('  Draw rate (15-25%): draws are interesting but not dominant');
console.error('  Avg goals/team (2.0-2.5): exciting but not silly');
console.error('  Profit at 50% WR: closer to 0 = healthier economy');
