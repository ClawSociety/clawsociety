export const CLOUDFC_ADDRESS = (process.env.NEXT_PUBLIC_CLOUDFC_ADDRESS?.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const CLOUDFC_PLAYERS_ADDRESS = (process.env.NEXT_PUBLIC_CLOUDFC_PLAYERS_ADDRESS?.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const CLOUDFC_LOOTBOX_ADDRESS = (process.env.NEXT_PUBLIC_CLOUDFC_LOOTBOX_ADDRESS?.trim() || '0x0000000000000000000000000000000000000000') as `0x${string}`;

// ─────────────────── CloudFCPlayers ABI ──────────────────────

export const PLAYERS_ABI = [
  // View
  {
    type: 'function', name: 'getStats',
    inputs: [{ name: 'playerId', type: 'uint256' }],
    outputs: [
      { name: 'spd', type: 'uint8' },
      { name: 'pas', type: 'uint8' },
      { name: 'sho', type: 'uint8' },
      { name: 'def', type: 'uint8' },
      { name: 'sta', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getStatsArray',
    inputs: [{ name: 'playerId', type: 'uint256' }],
    outputs: [{ name: 'stats', type: 'uint8[5]' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'playerRating',
    inputs: [{ name: 'playerId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'locked',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'nextId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'tokenOfOwnerByIndex',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write
  {
    type: 'function', name: 'setApprovalForAll',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'isApprovedForAll',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event', name: 'PlayerMinted',
    inputs: [
      { name: 'playerId', type: 'uint256', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'spd', type: 'uint8', indexed: false },
      { name: 'pas', type: 'uint8', indexed: false },
      { name: 'sho', type: 'uint8', indexed: false },
      { name: 'def', type: 'uint8', indexed: false },
      { name: 'sta', type: 'uint8', indexed: false },
    ],
  },
] as const;

// ─────────────────── CloudFC ABI ─────────────────────────────

export const CLOUDFC_ABI = [
  // Constants
  { type: 'function', name: 'TEAM_SIZE', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'WINNER_BPS', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'LOSER_BPS', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  // View: Matches
  {
    type: 'function', name: 'totalMatches',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalSquads',
    inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getMatch',
    inputs: [{ name: 'matchId', type: 'uint256' }],
    outputs: [
      { name: 'homeSquadId', type: 'uint256' },
      { name: 'awaySquadId', type: 'uint256' },
      { name: 'stake', type: 'uint128' },
      { name: 'seed', type: 'uint256' },
      { name: 'homeGoals', type: 'uint8' },
      { name: 'awayGoals', type: 'uint8' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'totalPool', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getSquad',
    inputs: [{ name: 'squadId', type: 'uint256' }],
    outputs: [
      { name: 'playerIds', type: 'uint256[5]' },
      { name: 'owners', type: 'address[5]' },
      { name: 'formation', type: 'uint8' },
      { name: 'creator', type: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getRecord',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'wins', type: 'uint32' },
      { name: 'losses', type: 'uint32' },
      { name: 'draws', type: 'uint32' },
      { name: 'gf', type: 'uint32' },
      { name: 'ga', type: 'uint32' },
      { name: 'mp', type: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getSquadPower',
    inputs: [{ name: 'squadId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'claimable',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write: Squad
  {
    type: 'function', name: 'createSquad',
    inputs: [
      { name: 'playerIds', type: 'uint256[5]' },
      { name: 'formation', type: 'uint8' },
    ],
    outputs: [{ name: 'squadId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Write: Match
  {
    type: 'function', name: 'createMatch',
    inputs: [{ name: 'squadId', type: 'uint256' }],
    outputs: [{ name: 'matchId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function', name: 'acceptMatch',
    inputs: [
      { name: 'matchId', type: 'uint256' },
      { name: 'squadId', type: 'uint256' },
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
  {
    type: 'function', name: 'claimRewards',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event', name: 'SquadCreated',
    inputs: [
      { name: 'squadId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'playerIds', type: 'uint256[5]', indexed: false },
      { name: 'formation', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event', name: 'MatchCreated',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'homeSquadId', type: 'uint256', indexed: true },
      { name: 'stake', type: 'uint128', indexed: false },
    ],
  },
  {
    type: 'event', name: 'MatchResolved',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'homeGoals', type: 'uint8', indexed: false },
      { name: 'awayGoals', type: 'uint8', indexed: false },
      { name: 'homePower', type: 'uint256', indexed: false },
      { name: 'awayPower', type: 'uint256', indexed: false },
      { name: 'seed', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'MatchAccepted',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'awaySquadId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event', name: 'MatchCancelled',
    inputs: [{ name: 'matchId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event', name: 'RewardClaimed',
    inputs: [
      { name: 'matchId', type: 'uint256', indexed: true },
      { name: 'claimer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Errors
  { type: 'error', name: 'OnlyOwner', inputs: [] },
  { type: 'error', name: 'InvalidSquad', inputs: [] },
  { type: 'error', name: 'NotPlayerOwner', inputs: [] },
  { type: 'error', name: 'PlayerInActiveMatch', inputs: [] },
  { type: 'error', name: 'DuplicatePlayer', inputs: [] },
  { type: 'error', name: 'InvalidFormation', inputs: [] },
  { type: 'error', name: 'MatchNotPending', inputs: [] },
  { type: 'error', name: 'InsufficientStake', inputs: [] },
  { type: 'error', name: 'CantPlayYourself', inputs: [] },
  { type: 'error', name: 'NotMatchParticipant', inputs: [] },
  { type: 'error', name: 'NotMatchCreator', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  { type: 'error', name: 'InvalidMatch', inputs: [] },
  { type: 'error', name: 'SamePlayerBothTeams', inputs: [] },
] as const;

// ─────────────────── CloudFCLootbox ABI ──────────────────────

export const LOOTBOX_ABI = [
  // View
  {
    type: 'function', name: 'packPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalPacks',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getPackRecord',
    inputs: [{ name: 'packId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'buyer', type: 'address' },
          { name: 'playerIds', type: 'uint256[5]' },
          { name: 'timestamp', type: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'tierWeights',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'pendingRevenue',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write
  {
    type: 'function', name: 'openPack',
    inputs: [],
    outputs: [{ name: 'playerIds', type: 'uint256[5]' }],
    stateMutability: 'payable',
  },
  {
    type: 'function', name: 'withdrawRevenue',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event', name: 'PackOpened',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'packId', type: 'uint256', indexed: true },
      { name: 'playerIds', type: 'uint256[5]', indexed: false },
      { name: 'tiers', type: 'uint8[5]', indexed: false },
    ],
  },
  // Errors
  { type: 'error', name: 'OnlyOwner', inputs: [] },
  { type: 'error', name: 'InsufficientPayment', inputs: [] },
  { type: 'error', name: 'TransferFailed', inputs: [] },
  { type: 'error', name: 'PackNotFound', inputs: [] },
  { type: 'error', name: 'NothingToWithdraw', inputs: [] },
] as const;

// ─────────────────── Helpers ─────────────────────────────────

export const FORMATION_NAMES = ['Balanced (1-2-2)', 'Offensive (1-1-3)', 'Defensive (1-3-1)'] as const;

export function formationFromUint8(val: number): 'balanced' | 'offensive' | 'defensive' {
  if (val === 1) return 'offensive';
  if (val === 2) return 'defensive';
  return 'balanced';
}

export function formationToUint8(val: 'balanced' | 'offensive' | 'defensive'): number {
  if (val === 'offensive') return 1;
  if (val === 'defensive') return 2;
  return 0;
}
