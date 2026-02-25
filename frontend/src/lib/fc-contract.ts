export const FC_ADDRESS = (process.env.NEXT_PUBLIC_FC_ADDRESS?.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// Position mapping: building type → football role
export const POSITION_MAP: Record<number, { role: string; short: string; color: string }> = {
  0: { role: 'Goalkeeper',          short: 'GK',  color: '#ff0055' },
  1: { role: 'Striker',             short: 'ST',  color: '#ffd700' },
  2: { role: 'Attacking Mid',       short: 'AM',  color: '#00ffff' },
  3: { role: 'Box-to-Box',          short: 'CM',  color: '#ff6600' },
  4: { role: 'Winger',              short: 'WG',  color: '#00ff88' },
  5: { role: 'Defensive Mid',       short: 'DM',  color: '#8855ff' },
  6: { role: 'Full Back',           short: 'FB',  color: '#ff8855' },
  7: { role: 'Center Back',         short: 'CB',  color: '#ff44ff' },
  8: { role: 'Utility',             short: 'UT',  color: '#4488ff' },
  9: { role: 'Sub',                 short: 'SUB', color: '#44cc44' },
};

export const FC_ABI = [
  // ─────────────────── Constants ──────────────────
  { type: 'function', name: 'TEAM_SIZE',       inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'NUM_PLAYS',       inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'GOAL_CHANCE_BPS', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'FEE_BPS',         inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  // ─────────────────── View: Matches ──────────────
  {
    type: 'function', name: 'totalMatches',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [
      { name: 'home',        type: 'address' },
      { name: 'away',        type: 'address' },
      { name: 'homeSeatIds', type: 'uint256[5]' },
      { name: 'awaySeatIds', type: 'uint256[5]' },
      { name: 'stake',       type: 'uint256' },
      { name: 'seed',        type: 'uint256' },
      { name: 'homeGoals',   type: 'uint8' },
      { name: 'awayGoals',   type: 'uint8' },
      { name: 'status',      type: 'uint8' },
      { name: 'createdAt',   type: 'uint64' },
    ],
    stateMutability: 'view',
  },
  // ─────────────────── View: Records ──────────────
  {
    type: 'function', name: 'getRecord',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'wins',          type: 'uint32' },
      { name: 'losses',        type: 'uint32' },
      { name: 'draws',         type: 'uint32' },
      { name: 'gf',            type: 'uint32' },
      { name: 'ga',            type: 'uint32' },
      { name: 'mp',            type: 'uint32' },
    ],
    stateMutability: 'view',
  },
  // ─────────────────── Write ──────────────────────
  {
    type: 'function', name: 'createMatch',
    inputs: [{ name: 'seatIds', type: 'uint256[5]' }],
    outputs: [{ name: 'matchId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function', name: 'acceptMatch',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'seatIds', type: 'uint256[5]' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function', name: 'cancelMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ─────────────────── Events ─────────────────────
  {
    type: 'event', name: 'MatchCreated',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'home',    type: 'address', indexed: true },
      { name: 'stake',   type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'MatchResolved',
    inputs: [
      { name: 'matchId',   type: 'uint256', indexed: true },
      { name: 'winner',    type: 'address', indexed: true },
      { name: 'homeGoals', type: 'uint8',   indexed: false },
      { name: 'awayGoals', type: 'uint8',   indexed: false },
      { name: 'homePower', type: 'uint256', indexed: false },
      { name: 'awayPower', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'MatchCancelled',
    inputs: [{ name: 'matchId', type: 'uint256', indexed: true }],
  },
  // ─────────────────── Errors ─────────────────────
  { type: 'error', name: 'NotHolder',         inputs: [] },
  { type: 'error', name: 'OnlyOwner',         inputs: [] },
  { type: 'error', name: 'InvalidMatch',      inputs: [] },
  { type: 'error', name: 'InvalidTeam',       inputs: [] },
  { type: 'error', name: 'DuplicateSeat',     inputs: [] },
  { type: 'error', name: 'InsufficientStake', inputs: [] },
  { type: 'error', name: 'MatchNotOpen',      inputs: [] },
  { type: 'error', name: 'CantPlayYourself',  inputs: [] },
  { type: 'error', name: 'TransferFailed',    inputs: [] },
] as const;
