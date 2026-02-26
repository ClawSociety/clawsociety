// ─────────────────── NFT Appearance Factory ──────────────────
// Derives deterministic player appearance from tokenId + stats + tier.
// Used for NFT card art — same tokenId always produces same visuals.

import type { PlayerAppearance } from './PlayerFactory';
import type { PlayerStats } from '../types';
import type { Tier } from '../playerNames';

const SKIN_TONES = [0xf5d0a9, 0xddb58a, 0xc49e6c, 0x8b6914, 0x5c3317];
const HAIR_COLORS = [0x1a1a1a, 0x4a3520, 0xc9a94e, 0x8b2500, 0x6e4b2a];
const BOOT_COLORS = [0x111111, 0x222222, 0x1a1a3a];

// Tier jersey/shorts color palettes
const TIER_JERSEY: Record<Tier, number> = {
  bronze:  0xcd7f32,
  silver:  0xc0c0c0,
  gold:    0xffd700,
  diamond: 0xb9f2ff,
};

const TIER_SHORTS: Record<Tier, number> = {
  bronze:  0x8b5a2b,
  silver:  0x808080,
  gold:    0xb8860b,
  diamond: 0x87ceeb,
};

function hash(n: number): number {
  // Simple deterministic hash
  let h = n * 31337;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return h >>> 0; // ensure unsigned
}

export function deriveNFTAppearance(
  tokenId: number,
  stats: PlayerStats,
  tier: Tier,
): PlayerAppearance {
  const s = hash(tokenId);

  // Highest stat determines heightRatio (taller = more imposing)
  const maxStat = Math.max(stats.speed, stats.passing, stats.shooting, stats.defense, stats.stamina);
  const heightRatio = 0.9 + (maxStat / 100) * 0.2; // 0.9–1.1

  // Accessories weighted by tier
  let accessory = 0;
  if (tier === 'diamond') {
    accessory = 3; // always captain armband
  } else if (tier === 'gold') {
    accessory = (s % 2 === 0) ? 1 : 0; // 50% headband
  } else {
    accessory = (s * 19) % 5; // 0-4 (none, headband, wristband, captain, goggles-as-headband)
    if (accessory > 3) accessory = 1; // wrap goggles→headband
  }

  return {
    skinTone: SKIN_TONES[s % 5],
    hairType: ((s >>> 4) * 13) % 10,  // 0-9 (10 hair types now)
    hairColor: HAIR_COLORS[((s >>> 8) * 7) % 5],
    heightRatio,
    jerseyColor: TIER_JERSEY[tier],
    shortsColor: TIER_SHORTS[tier],
    socksColor: TIER_SHORTS[tier],
    bootsColor: BOOT_COLORS[((s >>> 12) * 3) % 3],
    number: (tokenId % 99) + 1,
    isGK: false,
    buildType: ((s >>> 16) * 11) % 3,  // 0=slim, 1=normal, 2=stocky
    faceType: ((s >>> 20) * 17) % 8,   // 0-7 (8 face types now)
    accessory,
    sleeveStyle: ((s >>> 24) * 23) % 3 === 0 ? 1 : 0,
  };
}
