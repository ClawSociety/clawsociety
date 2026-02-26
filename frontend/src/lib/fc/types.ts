// ─────────────────── Core Types ──────────────────────────────

export interface Vec2 {
  x: number; // 0..1 normalized pitch coordinates
  y: number;
}

export type Team = 'home' | 'away';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

export type Direction8 = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';

export type PlayerState =
  | 'idle'
  | 'running'
  | 'kicking'
  | 'celebrating'
  | 'diving';

export interface Player {
  index: number; // 0-4
  team: Team;
  role: Role;
  basePos: Vec2;
}

export interface PlayerFrame {
  pos: Vec2;
  state: PlayerState;
  dir: Direction8;        // 8-directional facing
  animTick: number; // 0..1 within current anim
  team: Team;
  role: Role;
  index: number;
}

// ─────────────────── Events ─────────────────────────────────

export type EventType =
  | 'kickoff'
  | 'pass'
  | 'dribble'
  | 'tackle'
  | 'shot'
  | 'save'
  | 'goal'
  | 'transition';

export interface MatchEvent {
  time: number;       // 0..1 normalized match time
  duration: number;   // fraction of match time this event spans
  type: EventType;
  team: Team;
  playerIndex: number;  // primary actor (0-4)
  targetIndex?: number; // pass receiver / tackler
  ballFrom: Vec2;
  ballTo: Vec2;
  ballArc: number;      // 0=flat, 1=high lob
  intensity?: number;   // 0..1, event importance for cinematic scaling
}

export interface MatchTimeline {
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
}

// ─────────────────── Rendering Config ───────────────────────

export interface TeamConfig {
  primary: string;
  secondary: string;
  glow: string;
}

export interface MatchRenderConfig {
  home: TeamConfig;
  away: TeamConfig;
  matchDuration: number; // ms
  pitchColor: string;
  grassColor: string;
  lineColor: string;
  ballColor: string;
  ballGlow: string;
}

export const DEFAULT_HOME: TeamConfig = {
  primary: '#00ffff',
  secondary: '#007a7a',
  glow: 'rgba(0,255,255,0.25)',
};

export const DEFAULT_AWAY: TeamConfig = {
  primary: '#ff0055',
  secondary: '#7a002a',
  glow: 'rgba(255,0,85,0.25)',
};

export const DEFAULT_CONFIG: MatchRenderConfig = {
  home: DEFAULT_HOME,
  away: DEFAULT_AWAY,
  matchDuration: 45000,
  pitchColor: '#0a1a0a',
  grassColor: '#0d2d0d',
  lineColor: 'rgba(255,255,255,0.15)',
  ballColor: '#ffd700',
  ballGlow: 'rgba(255,215,0,0.5)',
};

// ─────────────────── CloudFC Player Stats ─────────────────────

export interface PlayerStats {
  speed: number;    // 0-100
  passing: number;
  shooting: number;
  defense: number;
  stamina: number;
}

export type Formation = 'balanced' | 'offensive' | 'defensive';

export interface CloudFCPlayer {
  id: number;
  owner: string;
  stats: PlayerStats;
  locked: boolean;
}

export interface TeamData {
  players: { stats: PlayerStats; owner: string }[];
  positions: number[];   // 0=GK, 1=DEF, 2=MID, 3=FWD
  formation: Formation;
  maxSameOwner: number;
}

export interface CloudFCSquad {
  id: number;
  playerIds: number[];
  owners: string[];
  formation: Formation;
  creator: string;
}

export interface CloudFCMatch {
  id: number;
  homeSquadId: number;
  awaySquadId: number;
  stake: bigint;
  seed: bigint;
  homeGoals: number;
  awayGoals: number;
  status: number; // 0=pending, 1=resolved, 2=cancelled
  createdAt: number;
  totalPool: bigint;
}

// ─────────────────── NFT Player Identity ─────────────────────

export interface NFTPlayerIdentity {
  tokenId: number;
  stats: PlayerStats;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

// ─────────────────── Formations ─────────────────────────────

// Default balanced formation (1-2-2) layout positions
export const HOME_FORMATION: Player[] = [
  { index: 0, team: 'home', role: 'GK',  basePos: { x: 0.08, y: 0.50 } },
  { index: 1, team: 'home', role: 'DEF', basePos: { x: 0.22, y: 0.25 } },
  { index: 2, team: 'home', role: 'DEF', basePos: { x: 0.22, y: 0.75 } },
  { index: 3, team: 'home', role: 'MID', basePos: { x: 0.40, y: 0.50 } },
  { index: 4, team: 'home', role: 'FWD', basePos: { x: 0.55, y: 0.40 } },
];

export const AWAY_FORMATION: Player[] = [
  { index: 0, team: 'away', role: 'GK',  basePos: { x: 0.92, y: 0.50 } },
  { index: 1, team: 'away', role: 'DEF', basePos: { x: 0.78, y: 0.25 } },
  { index: 2, team: 'away', role: 'DEF', basePos: { x: 0.78, y: 0.75 } },
  { index: 3, team: 'away', role: 'MID', basePos: { x: 0.60, y: 0.50 } },
  { index: 4, team: 'away', role: 'FWD', basePos: { x: 0.45, y: 0.60 } },
];

// Formation-specific layouts
export const FORMATION_LAYOUTS: Record<Formation, { home: Player[]; away: Player[] }> = {
  balanced: {
    home: HOME_FORMATION,
    away: AWAY_FORMATION,
  },
  offensive: {
    // 1-1-3
    home: [
      { index: 0, team: 'home', role: 'GK',  basePos: { x: 0.08, y: 0.50 } },
      { index: 1, team: 'home', role: 'DEF', basePos: { x: 0.22, y: 0.50 } },
      { index: 2, team: 'home', role: 'MID', basePos: { x: 0.38, y: 0.50 } },
      { index: 3, team: 'home', role: 'FWD', basePos: { x: 0.52, y: 0.25 } },
      { index: 4, team: 'home', role: 'FWD', basePos: { x: 0.55, y: 0.70 } },
    ],
    away: [
      { index: 0, team: 'away', role: 'GK',  basePos: { x: 0.92, y: 0.50 } },
      { index: 1, team: 'away', role: 'DEF', basePos: { x: 0.78, y: 0.50 } },
      { index: 2, team: 'away', role: 'MID', basePos: { x: 0.62, y: 0.50 } },
      { index: 3, team: 'away', role: 'FWD', basePos: { x: 0.48, y: 0.25 } },
      { index: 4, team: 'away', role: 'FWD', basePos: { x: 0.45, y: 0.70 } },
    ],
  },
  defensive: {
    // 1-3-1
    home: [
      { index: 0, team: 'home', role: 'GK',  basePos: { x: 0.08, y: 0.50 } },
      { index: 1, team: 'home', role: 'DEF', basePos: { x: 0.20, y: 0.20 } },
      { index: 2, team: 'home', role: 'DEF', basePos: { x: 0.22, y: 0.50 } },
      { index: 3, team: 'home', role: 'DEF', basePos: { x: 0.20, y: 0.80 } },
      { index: 4, team: 'home', role: 'FWD', basePos: { x: 0.50, y: 0.50 } },
    ],
    away: [
      { index: 0, team: 'away', role: 'GK',  basePos: { x: 0.92, y: 0.50 } },
      { index: 1, team: 'away', role: 'DEF', basePos: { x: 0.80, y: 0.20 } },
      { index: 2, team: 'away', role: 'DEF', basePos: { x: 0.78, y: 0.50 } },
      { index: 3, team: 'away', role: 'DEF', basePos: { x: 0.80, y: 0.80 } },
      { index: 4, team: 'away', role: 'FWD', basePos: { x: 0.50, y: 0.50 } },
    ],
  },
};
