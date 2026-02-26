// ─────────────────── CloudFC Formulas ─────────────────────────
// TypeScript mirror of Solidity FCFormulas.sol + FCSimulation.sol
// Must produce identical results for replay fidelity.
//
// IMPORTANT: deriveNoise and poissonSample use keccak256 to exactly
// match on-chain results. Do NOT replace with non-deterministic PRNG.

import { keccak256, encodePacked, encodeAbiParameters, toHex } from 'viem';
import type { PlayerStats, Formation, TeamData } from './types';

const BPS = 10_000;
const NOISE_CAP_BPS = 800;

// Solidity-matching integer constants for Poisson
const SCALE_18 = 10n ** 18n;
const BASE_LAMBDA_X1000 = 1300n;
const LAMBDA_MIN_X1000 = 300n;
const LAMBDA_MAX_X1000 = 3500n;
const MAX_GOALS_PER_TEAM = 6n;
// e^(-1) with 18 decimals
const EXP_NEG_1 = 367879441171442322n;

// ─────────────────── Positional Weights ───────────────────────
// [SPD, PAS, SHO, DEF, STA] per position

const POS_WEIGHTS: Record<number, number[]> = {
  0: [0.10, 0.10, 0.05, 0.40, 0.35], // GK
  1: [0.20, 0.15, 0.05, 0.35, 0.25], // DEF
  2: [0.20, 0.30, 0.15, 0.15, 0.20], // MID
  3: [0.25, 0.15, 0.35, 0.05, 0.20], // FWD
};

// Solidity-matching positional weights in BPS
const POS_WEIGHTS_BPS: number[][] = [
  [1000, 1000,  500, 4000, 3500], // GK
  [2000, 1500,  500, 3500, 2500], // DEF
  [2000, 3000, 1500, 1500, 2000], // MID
  [2500, 1500, 3500,  500, 2000], // FWD
];

// ─────────────────── Effective Rating ─────────────────────────

export function effectiveRating(stats: PlayerStats, position: number): number {
  const w = POS_WEIGHTS[position] ?? POS_WEIGHTS[2];
  return (
    stats.speed * w[0] +
    stats.passing * w[1] +
    stats.shooting * w[2] +
    stats.defense * w[3] +
    stats.stamina * w[4]
  );
}

/** Solidity-matching effectiveRating returning centibps (0-10000 range) */
function effectiveRatingBps(stats: number[], position: number): bigint {
  const w = POS_WEIGHTS_BPS[position] ?? POS_WEIGHTS_BPS[2];
  let rating = 0n;
  for (let i = 0; i < 5; i++) {
    rating += BigInt(stats[i]) * BigInt(w[i]);
  }
  return rating / 100n; // range 0-10000
}

// ─────────────────── Player Rating ────────────────────────────

export function playerRating(stats: PlayerStats): number {
  return (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5;
}

// ─────────────────── Synergy ──────────────────────────────────

export function synergyBonusPct(maxSameOwnerCount: number): number {
  if (maxSameOwnerCount <= 1) return 0;
  return Math.min(5, 1.5 * (maxSameOwnerCount - 1));
}

function synergyBonusBps(maxSameOwnerCount: number): bigint {
  if (maxSameOwnerCount <= 1) return 0n;
  let bonus = BigInt(maxSameOwnerCount - 1) * 150n;
  if (bonus > 500n) bonus = 500n;
  return bonus;
}

// ─────────────────── VRF Noise (Solidity-matching) ───────────

export function deriveNoise(seed: bigint, salt: string): number {
  // Exact mirror of Solidity FCFormulas.deriveNoise(uint256, bytes32)
  // Solidity: keccak256(abi.encodePacked(seed, salt))
  // where salt is a string literal implicitly converted to bytes32
  const saltHex = toHex(salt, { size: 32 });
  const h = BigInt(keccak256(encodePacked(
    ['uint256', 'bytes32'],
    [seed, saltHex as `0x${string}`],
  )));
  const raw = Number(h % BigInt(2 * NOISE_CAP_BPS + 1)) - NOISE_CAP_BPS;
  return raw / BPS; // as decimal: -0.08 to +0.08
}

// ─────────────────── Formation Modifiers ──────────────────────

export function formationModifiers(
  myFormation: Formation,
  oppFormation: Formation,
): { atkMod: number; defMod: number } {
  let atkMod = 1.0;
  let defMod = 1.0;

  if (myFormation === 'offensive') {
    atkMod = 1.08;
    defMod = 0.92;
  } else if (myFormation === 'defensive') {
    atkMod = 0.92;
    defMod = 1.08;
  }

  // RPS counters
  if (myFormation === 'offensive' && oppFormation === 'balanced') {
    atkMod += 0.05;
  } else if (myFormation === 'defensive' && oppFormation === 'offensive') {
    defMod += 0.05;
  } else if (myFormation === 'balanced' && oppFormation === 'defensive') {
    atkMod += 0.03;
    defMod += 0.03;
  }

  return { atkMod, defMod };
}

/** Solidity-matching formation modifiers in BPS */
function formationModifiersBps(
  myFormation: number,
  oppFormation: number,
): { atkMod: bigint; defMod: bigint } {
  let atkMod: bigint;
  let defMod: bigint;

  if (myFormation === 0) {
    atkMod = 10000n;
    defMod = 10000n;
  } else if (myFormation === 1) {
    atkMod = 10800n;
    defMod = 9200n;
  } else {
    atkMod = 9200n;
    defMod = 10800n;
  }

  if (myFormation === 1 && oppFormation === 0) {
    atkMod += 500n;
  } else if (myFormation === 2 && oppFormation === 1) {
    defMod += 500n;
  } else if (myFormation === 0 && oppFormation === 2) {
    atkMod += 300n;
    defMod += 300n;
  }

  return { atkMod, defMod };
}

// ─────────────────── Fatigue ──────────────────────────────────

export function fatigueMultiplier(phase: number, stamina: number): number {
  return 1 - (phase / 10) * (1 - stamina / 120);
}

// ─────────────────── Team Power ───────────────────────────────

export function teamPower(team: TeamData): number {
  let power = 0;
  for (let i = 0; i < 5; i++) {
    power += effectiveRating(team.players[i].stats, team.positions[i]);
  }
  const synergy = synergyBonusPct(team.maxSameOwner) / 100;
  return power * (1 + synergy);
}

// ─────────────────── Attack/Defense Split ─────────────────────

export function attackDefense(team: TeamData): { attack: number; defense: number } {
  let fwdEff = 0, midEff = 0, defEff = 0, gkEff = 0, totalEff = 0;

  for (let i = 0; i < 5; i++) {
    const eff = effectiveRating(team.players[i].stats, team.positions[i]);
    totalEff += eff;
    if (team.positions[i] === 3) fwdEff += eff;
    else if (team.positions[i] === 2) midEff += eff;
    else if (team.positions[i] === 1) defEff += eff;
    else gkEff += eff;
  }

  const avgEff = totalEff / 5;
  const synergy = synergyBonusPct(team.maxSameOwner) / 100;

  const attack = (fwdEff * 0.40 + midEff * 0.35 + avgEff * 0.25) * (1 + synergy);
  const defense = (gkEff * 0.40 + defEff * 0.35 + avgEff * 0.25) * (1 + synergy);

  return { attack, defense };
}

// ─────────────────── Poisson Sampler (Solidity-matching) ──────

/** Approximate e^(-x) matching Solidity's _expNeg with 18-decimal precision */
function expNeg18(x18: bigint): bigint {
  const intPart = x18 / SCALE_18;
  const fracPart = x18 % SCALE_18;

  // e^(-intPart) via repeated multiplication
  let intResult = SCALE_18;
  for (let i = 0n; i < intPart; i++) {
    intResult = intResult * EXP_NEG_1 / SCALE_18;
  }

  // e^(-fracPart) via Taylor series (12 terms, matching Solidity)
  let res = SCALE_18;
  let term = SCALE_18;
  for (let i = 1n; i <= 12n; i++) {
    term = term * fracPart / (i * SCALE_18);
    if (i % 2n === 1n) {
      res -= term;
    } else {
      res += term;
    }
  }

  return intResult * res / SCALE_18;
}

/** Poisson sample matching Solidity FCSimulation._poissonSample exactly */
function poissonSampleSolidity(lambdaX1000: bigint, seed: bigint): number {
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

// ─────────────────── Full Match Simulation (Solidity-matching) ─

export interface SimulationResult {
  homeGoals: number;
  awayGoals: number;
  homePower: number;
  awayPower: number;
  homeAttack: number;
  homeDefense: number;
  awayAttack: number;
  awayDefense: number;
}

/**
 * Simulate a match using Solidity-matching arithmetic.
 * deriveNoise and Poisson sampling produce identical results to on-chain.
 */
export function simulateMatch(
  home: TeamData,
  away: TeamData,
  vrfSeed: bigint,
): SimulationResult {
  // ── Compute attack/defense in BPS (matching Solidity integer math) ──
  const homeStats = home.players.map(p => [p.stats.speed, p.stats.passing, p.stats.shooting, p.stats.defense, p.stats.stamina]);
  const awayStats = away.players.map(p => [p.stats.speed, p.stats.passing, p.stats.shooting, p.stats.defense, p.stats.stamina]);

  const formationToUint8 = (f: Formation): number => f === 'balanced' ? 0 : f === 'offensive' ? 1 : 2;
  const homeFormNum = formationToUint8(home.formation);
  const awayFormNum = formationToUint8(away.formation);

  // Attack/Defense split matching Solidity
  let homeFwd = 0n, homeMid = 0n, homeDef = 0n, homeGk = 0n, homeTotal = 0n;
  let awayFwd = 0n, awayMid = 0n, awayDef = 0n, awayGk = 0n, awayTotal = 0n;

  for (let i = 0; i < 5; i++) {
    const hEff = effectiveRatingBps(homeStats[i], home.positions[i]);
    homeTotal += hEff;
    if (home.positions[i] === 3) homeFwd += hEff;
    else if (home.positions[i] === 2) homeMid += hEff;
    else if (home.positions[i] === 1) homeDef += hEff;
    else homeGk += hEff;

    const aEff = effectiveRatingBps(awayStats[i], away.positions[i]);
    awayTotal += aEff;
    if (away.positions[i] === 3) awayFwd += aEff;
    else if (away.positions[i] === 2) awayMid += aEff;
    else if (away.positions[i] === 1) awayDef += aEff;
    else awayGk += aEff;
  }

  const homeAvg = homeTotal / 5n;
  const awayAvg = awayTotal / 5n;
  const homeSynergy = synergyBonusBps(home.maxSameOwner);
  const awaySynergy = synergyBonusBps(away.maxSameOwner);

  let homeAtk = (homeFwd * 4000n + homeMid * 3500n + homeAvg * 2500n) / 10000n;
  let homeDefBps = (homeGk * 4000n + homeDef * 3500n + homeAvg * 2500n) / 10000n;
  homeAtk = homeAtk * (10000n + homeSynergy) / 10000n;
  homeDefBps = homeDefBps * (10000n + homeSynergy) / 10000n;

  let awayAtk = (awayFwd * 4000n + awayMid * 3500n + awayAvg * 2500n) / 10000n;
  let awayDefBps = (awayGk * 4000n + awayDef * 3500n + awayAvg * 2500n) / 10000n;
  awayAtk = awayAtk * (10000n + awaySynergy) / 10000n;
  awayDefBps = awayDefBps * (10000n + awaySynergy) / 10000n;

  // Formation modifiers
  const homeFormMod = formationModifiersBps(homeFormNum, awayFormNum);
  const awayFormMod = formationModifiersBps(awayFormNum, homeFormNum);
  homeAtk = homeAtk * homeFormMod.atkMod / 10000n;
  homeDefBps = homeDefBps * homeFormMod.defMod / 10000n;
  awayAtk = awayAtk * awayFormMod.atkMod / 10000n;
  awayDefBps = awayDefBps * awayFormMod.defMod / 10000n;

  // VRF noise on attack (matching Solidity deriveNoise exactly)
  const noiseHomeBps = deriveNoiseBps(vrfSeed, 'teamA');
  const noiseAwayBps = deriveNoiseBps(vrfSeed, 'teamB');
  homeAtk = applyNoiseBps(homeAtk, noiseHomeBps);
  awayAtk = applyNoiseBps(awayAtk, noiseAwayBps);

  // Lambda for Poisson (integer math matching Solidity)
  const lambdaHome = awayDefBps > 0n
    ? clampBig(BASE_LAMBDA_X1000 * homeAtk / awayDefBps, LAMBDA_MIN_X1000, LAMBDA_MAX_X1000)
    : LAMBDA_MAX_X1000;
  const lambdaAway = homeDefBps > 0n
    ? clampBig(BASE_LAMBDA_X1000 * awayAtk / homeDefBps, LAMBDA_MIN_X1000, LAMBDA_MAX_X1000)
    : LAMBDA_MAX_X1000;

  // Poisson seed derivation matching Solidity: keccak256(abi.encode(vrfSeed, "homeGoals"))
  const homeGoalSeed = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'string' }],
    [vrfSeed, 'homeGoals'],
  )));
  const awayGoalSeed = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'string' }],
    [vrfSeed, 'awayGoals'],
  )));

  const homeGoals = poissonSampleSolidity(lambdaHome, homeGoalSeed);
  const awayGoals = poissonSampleSolidity(lambdaAway, awayGoalSeed);

  return {
    homeGoals,
    awayGoals,
    homePower: teamPower(home),
    awayPower: teamPower(away),
    homeAttack: Number(homeAtk) / 100, // convert from centibps to readable
    homeDefense: Number(homeDefBps) / 100,
    awayAttack: Number(awayAtk) / 100,
    awayDefense: Number(awayDefBps) / 100,
  };
}

/** deriveNoise returning raw BPS (int256 in Solidity) */
function deriveNoiseBps(seed: bigint, salt: string): bigint {
  const saltHex = toHex(salt, { size: 32 });
  const h = BigInt(keccak256(encodePacked(
    ['uint256', 'bytes32'],
    [seed, saltHex as `0x${string}`],
  )));
  const raw = h % BigInt(2 * NOISE_CAP_BPS + 1);
  return raw - BigInt(NOISE_CAP_BPS); // can be negative (stored as bigint)
}

function applyNoiseBps(atk: bigint, noise: bigint): bigint {
  if (noise >= 0n) {
    return atk * (10000n + noise) / 10000n;
  } else {
    return atk * (10000n - (-noise)) / 10000n;
  }
}

function clampBig(val: bigint, lo: bigint, hi: bigint): bigint {
  if (val < lo) return lo;
  if (val > hi) return hi;
  return val;
}

// ─────────────────── Formation Positions ──────────────────────

export function formationPositions(formation: Formation): number[] {
  switch (formation) {
    case 'balanced':  return [0, 1, 1, 2, 3]; // 1-2-2
    case 'offensive': return [0, 1, 2, 3, 3]; // 1-1-3
    case 'defensive': return [0, 1, 1, 1, 3]; // 1-3-1
  }
}
