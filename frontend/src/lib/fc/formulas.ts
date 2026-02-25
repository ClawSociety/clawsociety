// ─────────────────── CloudFC Formulas ─────────────────────────
// TypeScript mirror of Solidity FCFormulas.sol + FCSimulation.sol
// Must produce identical results for replay fidelity.

import { mulberry32 } from './prng';
import type { PlayerStats, Formation, TeamData } from './types';

const BPS = 10_000;
const NOISE_CAP_BPS = 800;
const BASE_LAMBDA = 1.3;
const LAMBDA_MIN = 0.3;
const LAMBDA_MAX = 3.5;
const MAX_GOALS = 6;

// ─────────────────── Positional Weights ───────────────────────
// [SPD, PAS, SHO, DEF, STA] per position

const POS_WEIGHTS: Record<number, number[]> = {
  0: [0.10, 0.10, 0.05, 0.40, 0.35], // GK
  1: [0.20, 0.15, 0.05, 0.35, 0.25], // DEF
  2: [0.20, 0.30, 0.15, 0.15, 0.20], // MID
  3: [0.25, 0.15, 0.35, 0.05, 0.20], // FWD
};

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

// ─────────────────── Player Rating ────────────────────────────

export function playerRating(stats: PlayerStats): number {
  return (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5;
}

// ─────────────────── Synergy ──────────────────────────────────

export function synergyBonusPct(maxSameOwnerCount: number): number {
  if (maxSameOwnerCount <= 1) return 0;
  return Math.min(5, 1.5 * (maxSameOwnerCount - 1));
}

// ─────────────────── VRF Noise ────────────────────────────────

export function deriveNoise(seed: bigint, salt: string): number {
  // Mirror Solidity: keccak hash, mod range, subtract cap
  // In TypeScript we approximate using mulberry32 from seed+salt hash
  const combined = Number(seed & 0xFFFFFFFFn) ^ hashString(salt);
  const rng = mulberry32(combined);
  const raw = Math.floor(rng() * (2 * NOISE_CAP_BPS + 1)) - NOISE_CAP_BPS;
  return raw / BPS; // as decimal: -0.08 to +0.08
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
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

// ─────────────────── Poisson Sampler ──────────────────────────

export function poissonSample(lambda: number, seed: number): number {
  const rng = mulberry32(seed);
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return Math.min(k - 1, MAX_GOALS);
}

// ─────────────────── Full Match Simulation ────────────────────

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

export function simulateMatch(
  home: TeamData,
  away: TeamData,
  vrfSeed: bigint,
): SimulationResult {
  const { attack: homeAtk, defense: homeDef } = attackDefense(home);
  const { attack: awayAtk, defense: awayDef } = attackDefense(away);

  const homeFormMod = formationModifiers(home.formation, away.formation);
  const awayFormMod = formationModifiers(away.formation, home.formation);

  let effHomeAtk = homeAtk * homeFormMod.atkMod;
  const effHomeDef = homeDef * homeFormMod.defMod;
  let effAwayAtk = awayAtk * awayFormMod.atkMod;
  const effAwayDef = awayDef * awayFormMod.defMod;

  // Apply noise
  const noiseH = deriveNoise(vrfSeed, 'teamA');
  const noiseA = deriveNoise(vrfSeed, 'teamB');
  effHomeAtk *= (1 + noiseH);
  effAwayAtk *= (1 + noiseA);

  // Lambda for Poisson
  const lambdaHome = clamp(BASE_LAMBDA * effHomeAtk / Math.max(effAwayDef, 0.01), LAMBDA_MIN, LAMBDA_MAX);
  const lambdaAway = clamp(BASE_LAMBDA * effAwayAtk / Math.max(effHomeDef, 0.01), LAMBDA_MIN, LAMBDA_MAX);

  // Sample goals
  const seedNum = Number(vrfSeed & 0xFFFFFFFFn);
  const homeGoals = poissonSample(lambdaHome, seedNum ^ 0x48474F4D); // "homeGoals"
  const awayGoals = poissonSample(lambdaAway, seedNum ^ 0x41574159); // "awayGoals"

  return {
    homeGoals,
    awayGoals,
    homePower: teamPower(home),
    awayPower: teamPower(away),
    homeAttack: effHomeAtk,
    homeDefense: effHomeDef,
    awayAttack: effAwayAtk,
    awayDefense: effAwayDef,
  };
}

function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

// ─────────────────── Formation Positions ──────────────────────

export function formationPositions(formation: Formation): number[] {
  switch (formation) {
    case 'balanced':  return [0, 1, 1, 2, 3]; // 1-2-2
    case 'offensive': return [0, 1, 2, 3, 3]; // 1-1-3
    case 'defensive': return [0, 1, 1, 1, 3]; // 1-3-1
  }
}
