import { BuildingConfig } from './types';

export const TOTAL_SEATS = 100;
export const GRID_SIZE = 10;
export const USDC_DECIMALS = 6;
export const ONE_WEEK = 604800;
export const TAX_RATE_BPS = 500;
export const BUYOUT_FEE_BPS = 2000;

export const BUILDING_CONFIGS: Record<number, BuildingConfig> = {
  0: { name: 'Server Farm', emoji: '\u{1F5A5}\uFE0F', color: '#ff0055', borderColor: '#ff3377', multiplier: 2.0, glowColor: 'rgba(255,0,85,0.5)' },
  1: { name: 'Bank', emoji: '\u{1F3E6}', color: '#ffd700', borderColor: '#ffed4a', multiplier: 1.8, glowColor: 'rgba(255,215,0,0.5)' },
  2: { name: 'AI Lab', emoji: '\u{1F9E0}', color: '#00ffff', borderColor: '#33ffff', multiplier: 1.5, glowColor: 'rgba(0,255,255,0.5)' },
  3: { name: 'Arena', emoji: '\u2694\uFE0F', color: '#ff6600', borderColor: '#ff8833', multiplier: 1.3, glowColor: 'rgba(255,102,0,0.5)' },
  4: { name: 'Market', emoji: '\u{1F3EA}', color: '#00ff88', borderColor: '#33ffaa', multiplier: 1.2, glowColor: 'rgba(0,255,136,0.5)' },
  5: { name: 'Factory', emoji: '\u{1F3ED}', color: '#8855ff', borderColor: '#aa77ff', multiplier: 1.1, glowColor: 'rgba(136,85,255,0.5)' },
  6: { name: 'Cafe', emoji: '\u2615', color: '#ff8855', borderColor: '#ffaa77', multiplier: 1.0, glowColor: 'rgba(255,136,85,0.4)' },
  7: { name: 'Club', emoji: '\u{1F3B5}', color: '#ff44ff', borderColor: '#ff77ff', multiplier: 0.9, glowColor: 'rgba(255,68,255,0.4)' },
  8: { name: 'Quarters', emoji: '\u{1F3E0}', color: '#4488ff', borderColor: '#66aaff', multiplier: 0.8, glowColor: 'rgba(68,136,255,0.3)' },
  9: { name: 'Park', emoji: '\u{1F333}', color: '#44cc44', borderColor: '#66ee66', multiplier: 0.7, glowColor: 'rgba(68,204,68,0.3)' },
};

export const BUILDING_NAMES = Object.fromEntries(
  Object.entries(BUILDING_CONFIGS).map(([k, v]) => [k, v.name])
);
