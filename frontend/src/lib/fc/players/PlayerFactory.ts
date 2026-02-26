// ─────────────────── PlayerFactory ─────────────────────────────
// Derives deterministic player appearance from team + index.
// Zero randomness — same inputs always produce same visuals.

import type { Team, Role, MatchRenderConfig } from '../types';

export interface PlayerAppearance {
  skinTone: number;
  hairType: number;      // 0=buzz, 1=short, 2=mohawk, 3=swept, 4=afro, 5=bald
  hairColor: number;
  heightRatio: number;   // 0.9–1.1
  jerseyColor: number;
  shortsColor: number;
  socksColor: number;
  bootsColor: number;
  number: number;
  isGK: boolean;
  buildType: number;     // 0=slim, 1=normal, 2=stocky
  faceType: number;      // 0-3
  accessory: number;     // 0=none, 1=headband, 2=wristband, 3=captain
  sleeveStyle: number;   // 0=short, 1=long
}

const SKIN_TONES = [0xf5d0a9, 0xddb58a, 0xc49e6c, 0x8b6914, 0x5c3317];
const HAIR_COLORS = [0x1a1a1a, 0x4a3520, 0xc9a94e, 0x8b2500, 0x6e4b2a];
const BOOT_COLORS = [0x111111, 0x222222, 0x1a1a3a];

function parseHexColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export function deriveAppearance(
  team: Team,
  index: number,
  role: Role,
  cfg: MatchRenderConfig,
): PlayerAppearance {
  const s = index * 7 + (team === 'home' ? 0 : 37);

  const jerseyColor = parseHexColor(team === 'home' ? cfg.home.primary : cfg.away.primary);
  const shortsColor = parseHexColor(team === 'home' ? cfg.home.secondary : cfg.away.secondary);

  // GK jersey: shift toward neon green for visibility
  const gkJersey = role === 'GK' ? gkJerseyColor(jerseyColor) : jerseyColor;

  return {
    skinTone: SKIN_TONES[s % 5],
    hairType: (s * 13) % 6,
    hairColor: HAIR_COLORS[(s * 7) % 5],
    heightRatio: 0.95 + (s % 5) * 0.025,
    jerseyColor: role === 'GK' ? gkJersey : jerseyColor,
    shortsColor,
    socksColor: shortsColor, // socks match shorts by default
    bootsColor: BOOT_COLORS[(s * 3) % 3],
    number: index + 1,
    isGK: role === 'GK',
    buildType: (s * 11) % 3,       // 0=slim, 1=normal, 2=stocky
    faceType: (s * 17) % 4,        // 0-3
    accessory: index === 0 ? 3 : (s * 19) % 4 > 2 ? 1 : 0, // captain gets armband
    sleeveStyle: role === 'GK' ? 1 : (s * 23) % 3 === 0 ? 1 : 0,
  };
}

function gkJerseyColor(teamPrimary: number): number {
  const r = ((teamPrimary >> 16) & 0xff);
  const g = ((teamPrimary >> 8) & 0xff);
  const b = (teamPrimary & 0xff);
  const nr = Math.round(r * 0.4 + 0x33 * 0.6);
  const ng = Math.round(g * 0.4 + 0xff * 0.6);
  const nb = Math.round(b * 0.4 + 0x33 * 0.6);
  return (nr << 16) | (ng << 8) | nb;
}
