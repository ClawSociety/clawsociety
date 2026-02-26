'use client';

import { useState, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { formatETH } from '@/lib/utils';
import { FORMATION_NAMES, CLOUDFC_ABI } from '@/lib/cloudfc-contract';
import {
  useMyPlayers, useCloudFCMatches, useCloudFCRecord,
  useClaimable, useCloudFCActions,
} from '@/hooks/useCloudFC';
import type { CloudFCMatch, CloudFCPlayer, Formation } from '@/lib/fc/types';
import { playerRating } from '@/lib/fc/formulas';
import { PlayerAvatar } from './PlayerAvatar';
import { PitchCanvas } from './PitchCanvas';
import { LootboxPanel } from './LootboxPanel';
import { PlayerCreator } from './PlayerCreator';

// ─────────────────── Stat Colors ─────────────────────────────

function statColor(val: number): string {
  if (val >= 85) return '#00ff88';
  if (val >= 70) return '#00ffff';
  if (val >= 50) return '#ffd700';
  if (val >= 30) return '#ff8855';
  return '#ff0055';
}

// ─────────────────── Sub-components ──────────────────────────

function PlayerCard({
  player,
  selected,
  onToggle,
}: {
  player: CloudFCPlayer;
  selected: boolean;
  onToggle: () => void;
}) {
  const rating = Math.round(playerRating(player.stats));
  const s = player.stats;

  return (
    <button
      onClick={onToggle}
      disabled={player.locked}
      className={`fc-card-hover flex items-center gap-2 rounded border px-2 py-2 font-mono text-xs transition-all sm:py-1.5 ${
        player.locked
          ? 'cursor-not-allowed border-red-500/30 bg-red-500/5 opacity-50'
          : selected
            ? 'border-cyan-400 bg-cyan-400/10'
            : 'border-white/10 bg-white/5 hover:bg-white/10'
      }`}
    >
      <PlayerAvatar tokenId={player.id} stats={player.stats} size={28} />
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold" style={{ color: statColor(rating) }}>
          {rating}
        </span>
        <span className="text-[8px] text-gray-500">OVR</span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <span className="block truncate text-gray-300">#{player.id}</span>
        <div className="flex gap-1 text-[8px]">
          <span style={{ color: statColor(s.speed) }}>SPD {s.speed}</span>
          <span style={{ color: statColor(s.shooting) }}>SHO {s.shooting}</span>
          <span style={{ color: statColor(s.defense) }}>DEF {s.defense}</span>
        </div>
      </div>
      {player.locked && (
        <span className="text-[8px] text-red-400">LOCKED</span>
      )}
    </button>
  );
}

function RecordBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <span className="block font-mono text-lg font-bold" style={{ color }}>{value}</span>
      <span className="font-mono text-[10px] uppercase text-gray-500">{label}</span>
    </div>
  );
}

function MatchRow({
  match,
  onAccept,
  onCancel,
  onView,
}: {
  match: CloudFCMatch;
  onAccept?: (m: CloudFCMatch) => void;
  onCancel?: (m: CloudFCMatch) => void;
  onView?: (m: CloudFCMatch) => void;
}) {
  const isOpen = match.status === 0;
  const isResolved = match.status === 1;

  return (
    <div
      className={`flex items-center gap-2 rounded border px-2 py-2 font-mono text-xs sm:py-1.5 ${
        isOpen ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/5'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-gray-400">Match #{match.id}</span>
          {isResolved && (
            <span className="font-bold text-white">
              {match.homeGoals} - {match.awayGoals}
            </span>
          )}
          {isOpen && <span className="text-yellow-500">Open</span>}
        </div>
        {match.stake > 0n && (
          <span className="text-[10px] text-yellow-500">
            Stake: {formatETH(match.stake)}
          </span>
        )}
      </div>

      {isOpen && onAccept && (
        <button
          onClick={() => onAccept(match)}
          className="rounded bg-cyan-500 px-2 py-1 text-[10px] font-bold uppercase text-black hover:bg-cyan-400"
        >
          Accept
        </button>
      )}
      {isOpen && onCancel && (
        <button
          onClick={() => onCancel(match)}
          className="rounded border border-red-500/30 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10"
        >
          Cancel
        </button>
      )}
      {isResolved && onView && (
        <button
          onClick={() => onView(match)}
          className="rounded border border-white/20 px-2 py-1 text-[10px] font-bold uppercase text-gray-400 hover:bg-white/10"
        >
          Replay
        </button>
      )}
    </div>
  );
}

// ─────────────────── Main Panel ──────────────────────────────

type Tab = 'squad' | 'matches' | 'packs' | 'standings' | 'creator';

export function FCPanel() {
  const { address } = useAccount();
  const [tab, setTab] = useState<Tab>('squad');
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [formation, setFormation] = useState<Formation>('balanced');
  const [stakeInput, setStakeInput] = useState('');
  const [viewingMatch, setViewingMatch] = useState<CloudFCMatch | null>(null);
  const [error, setError] = useState('');
  const [matchStep, setMatchStep] = useState<'' | 'squad' | 'match'>('');
  const [pendingAcceptMatch, setPendingAcceptMatch] = useState<CloudFCMatch | null>(null);
  const publicClient = usePublicClient();
  const { players: myPlayers } = useMyPlayers(address);
  const { openMatches, resolvedMatches, refetch } = useCloudFCMatches();
  const record = useCloudFCRecord(address);
  const { claimable, refetchClaimable } = useClaimable(address);
  const {
    createSquad, createMatch, acceptMatch, cancelMatch, claimRewards, isPending,
  } = useCloudFCActions();

  // Average squad rating
  const squadRating = useMemo(() => {
    if (selectedPlayers.length === 0) return 0;
    const selected = selectedPlayers
      .map(id => myPlayers.find(p => p.id === id))
      .filter((p): p is CloudFCPlayer => !!p);
    return Math.round(
      selected.reduce((sum, p) => sum + playerRating(p.stats), 0) / selected.length
    );
  }, [selectedPlayers, myPlayers]);

  const togglePlayer = (playerId: number) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
      if (prev.length >= 5) return prev;
      return [...prev, playerId];
    });
  };

  const waitForSquadId = async (txHash: `0x${string}`): Promise<bigint> => {
    if (!publicClient) throw new Error('No public client');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 2 });
    // Extract squadId from SquadCreated event in tx receipt
    const { parseEventLogs } = await import('viem');
    const logs = parseEventLogs({ abi: CLOUDFC_ABI, logs: receipt.logs, eventName: 'SquadCreated' });
    if (logs.length === 0) throw new Error('SquadCreated event not found in tx receipt');
    return (logs[0].args as { squadId: bigint }).squadId;
  };

  const friendlyError = (e: unknown): string => {
    const err = e as { shortMessage?: string; message?: string };
    const raw = err?.shortMessage || err?.message || 'Transaction failed';
    if (raw.includes('NotPlayerOwner')) return 'You don\'t own one or more of the selected players. Try refreshing.';
    if (raw.includes('PlayerInActiveMatch')) return 'One or more players are in an active match.';
    if (raw.includes('InsufficientStake')) return 'You need to send at least the match stake amount.';
    if (raw.includes('CantPlayYourself')) return 'You can\'t accept your own match.';
    if (raw.includes('User rejected')) return 'Transaction cancelled.';
    if (raw.includes('User denied')) return 'Transaction cancelled.';
    return raw;
  };

  const handleCreateSquadAndMatch = async () => {
    if (selectedPlayers.length !== 5) return;
    setError('');
    try {
      setMatchStep('squad');
      const squadHash = await createSquad(selectedPlayers.map(id => BigInt(id)), formation);
      const squadId = await waitForSquadId(squadHash);
      setMatchStep('match');
      await createMatch(squadId, stakeInput);
      setSelectedPlayers([]);
      setStakeInput('');
      setMatchStep('');
      refetch();
    } catch (e: unknown) {
      console.error('createSquadAndMatch failed:', e);
      setMatchStep('');
      setError(friendlyError(e));
    }
  };

  const handleAcceptClick = (match: CloudFCMatch) => {
    setPendingAcceptMatch(match);
    if (selectedPlayers.length !== 5) {
      setTab('squad');
      setError('Select 5 players and pick a formation to accept Match #' + match.id);
      return;
    }
    doAcceptMatch(match);
  };

  const doAcceptMatch = async (match: CloudFCMatch) => {
    if (selectedPlayers.length !== 5) return;
    setError('');
    try {
      setMatchStep('squad');
      const squadHash = await createSquad(selectedPlayers.map(id => BigInt(id)), formation);
      const squadId = await waitForSquadId(squadHash);
      setMatchStep('match');
      await acceptMatch(BigInt(match.id), squadId, match.stake);
      setSelectedPlayers([]);
      setMatchStep('');
      setPendingAcceptMatch(null);
      refetch();
    } catch (e: unknown) {
      console.error('acceptMatch failed:', e);
      setMatchStep('');
      setError(friendlyError(e));
    }
  };

  const handleCancel = async (match: CloudFCMatch) => {
    try {
      await cancelMatch(BigInt(match.id));
      setPendingAcceptMatch(null);
      refetch();
    } catch (e: unknown) {
      console.error('cancelMatch failed:', e);
      setError(friendlyError(e));
    }
  };

  const handleClaim = async () => {
    try {
      await claimRewards();
      refetchClaimable();
    } catch (e) {
      console.error('claimRewards failed:', e);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Header */}
      <div className="rounded-xl border border-white/[0.08] bg-[#1a1a2e]/80 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
              Manager Hub
            </h2>
            <p className="text-[10px] text-gray-500">Season 01</p>
          </div>
          {myPlayers.length > 0 && (
            <span className="ml-auto rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] text-cyan-400">
              {myPlayers.length} Players
            </span>
          )}
        </div>

        {/* Record */}
        {address && record.matchesPlayed > 0 && (
          <div className="flex justify-around rounded border border-white/10 bg-black/30 py-2">
            <RecordBadge label="W" value={record.wins} color="#00ff88" />
            <RecordBadge label="D" value={record.draws} color="#ffd700" />
            <RecordBadge label="L" value={record.losses} color="#ff0055" />
            <RecordBadge label="GF" value={record.goalsFor} color="#00ffff" />
            <RecordBadge label="GA" value={record.goalsAgainst} color="#ff8855" />
          </div>
        )}

        {/* Claimable */}
        {claimable > 0n && (
          <div className="mt-2 flex items-center justify-between rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
            <span className="text-xs text-yellow-400">
              Claimable: {formatETH(claimable)}
            </span>
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="rounded bg-yellow-500 px-3 py-1 text-[10px] font-bold uppercase text-black hover:bg-yellow-400 disabled:opacity-40"
            >
              Claim
            </button>
          </div>
        )}
      </div>

      {/* Match Replay Viewer */}
      {viewingMatch && (
        <div className="rounded-xl border border-cyan-500/30 bg-[#1a1a2e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">Match #{viewingMatch.id}</span>
            <button
              onClick={() => setViewingMatch(null)}
              className="text-xs text-gray-500 hover:text-white"
            >
              Close
            </button>
          </div>
          <PitchCanvas
            homeGoals={viewingMatch.homeGoals}
            awayGoals={viewingMatch.awayGoals}
            seed={viewingMatch.seed}
            width={540}
            height={340}
          />
        </div>
      )}

      {/* Tabs */}
      {(() => {
        const tabs: { key: Tab; icon: string; label: string }[] = [
          { key: 'squad', icon: '\u{1F6E1}', label: 'Squad' },
          { key: 'matches', icon: '\u{2694}', label: 'Matches' },
          { key: 'packs', icon: '\u{1F4E6}', label: 'Packs' },
          { key: 'standings', icon: '\u{1F3C6}', label: 'Standings' },
          { key: 'creator', icon: '\u{1F3A8}', label: 'Creator' },
        ];
        const tabIndex = tabs.findIndex(t => t.key === tab);
        return (
          <div className="relative rounded-lg border border-white/[0.08] bg-[#0d0d1a]/80 p-1">
            <div className="relative flex">
              {/* Animated underline */}
              <div
                className="absolute bottom-0 h-[2px] bg-cyan-400 transition-all duration-300"
                style={{
                  width: '20%',
                  transform: `translateX(${tabIndex * 100}%)`,
                  boxShadow: '0 0 8px rgba(0, 255, 255, 0.5)',
                }}
              />
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    tab === t.key
                      ? 'bg-cyan-400/5 text-cyan-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="text-sm leading-none">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ─── Squad Builder ─── */}
      {tab === 'squad' && (
        <div className="fc-tab-fade rounded-lg border border-white/10 bg-[#0d0d1a]/80 p-3 backdrop-blur-sm" key="squad">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">
            Build Your Squad <span className="fc-count-pop" key={selectedPlayers.length}>({selectedPlayers.length}/5)</span>
          </h3>

          {!address ? (
            <p className="text-xs text-gray-500">Connect wallet to build squad.</p>
          ) : myPlayers.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              {/* Mini pitch silhouette */}
              <div className="relative mb-4 h-[160px] w-[280px] rounded-lg border border-green-900/40 bg-gradient-to-b from-green-950/30 to-green-950/10">
                {/* Center line */}
                <div className="absolute left-0 right-0 top-1/2 h-px bg-green-800/30" />
                {/* Center circle */}
                <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-green-800/30" />
                {/* Position markers */}
                {[
                  { left: '50%', top: '85%', label: 'GK' },
                  { left: '25%', top: '60%', label: 'DEF' },
                  { left: '75%', top: '60%', label: 'DEF' },
                  { left: '50%', top: '40%', label: 'MID' },
                  { left: '50%', top: '15%', label: 'FWD' },
                ].map(pos => (
                  <div
                    key={pos.label + pos.left}
                    className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-gray-600/50 bg-gray-800/30"
                    style={{ left: pos.left, top: pos.top }}
                  >
                    <span className="text-[6px] text-gray-600">{pos.label}</span>
                  </div>
                ))}
              </div>
              <p className="mb-1 text-xs text-gray-400">No players yet</p>
              <p className="mb-3 text-[10px] text-gray-600">Open a pack to recruit your first squad</p>
              <button
                onClick={() => setTab('packs')}
                className="fc-pulse-cta rounded bg-cyan-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-cyan-400"
              >
                Open a Pack
              </button>
            </div>
          ) : (() => {
            const unlockedCount = myPlayers.filter(p => !p.locked).length;
            const allLocked = unlockedCount === 0;
            return allLocked ? (
              <div className="text-center py-4">
                <p className="text-xs text-red-400 mb-2">
                  All your players are locked in active matches.
                </p>
                <p className="text-[10px] text-gray-500 mb-3">
                  Cancel your open match in the MATCHES tab to unlock them.
                </p>
                <button
                  onClick={() => { setPendingAcceptMatch(null); setTab('matches'); }}
                  className="rounded bg-yellow-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-yellow-400"
                >
                  Go to Matches
                </button>
              </div>
            ) : (
            <>
              {/* Player Selection */}
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {myPlayers.map(player => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    selected={selectedPlayers.includes(player.id)}
                    onToggle={() => togglePlayer(player.id)}
                  />
                ))}
              </div>

              {unlockedCount < 5 && (
                <div className="mb-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                  Only {unlockedCount} unlocked player{unlockedCount !== 1 ? 's' : ''} available.
                  Cancel open matches or open more packs to get 5 free players.
                </div>
              )}

              {selectedPlayers.length > 0 && selectedPlayers.length < 5 && unlockedCount >= 5 && (
                <p className="mb-2 text-center text-[10px] text-yellow-500">
                  Select {5 - selectedPlayers.length} more player{5 - selectedPlayers.length > 1 ? 's' : ''} to create a match
                </p>
              )}

              {/* Selected Squad Stats */}
              {selectedPlayers.length > 0 && (
                <div className="mb-3 rounded border border-white/10 bg-black/30 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Squad Rating</span>
                    <span className="font-bold" style={{ color: statColor(squadRating) }}>
                      {squadRating}
                    </span>
                  </div>
                  {selectedPlayers.length === 5 && (
                    <div className="space-y-0.5">
                      {selectedPlayers.map((id, i) => {
                        const p = myPlayers.find(pl => pl.id === id);
                        if (!p) return null;
                        const roles = ['GK', 'DEF', 'DEF', 'MID', 'FWD'];
                        if (formation === 'offensive') {
                          roles[1] = 'DEF'; roles[2] = 'MID'; roles[3] = 'FWD'; roles[4] = 'FWD';
                        } else if (formation === 'defensive') {
                          roles[1] = 'DEF'; roles[2] = 'DEF'; roles[3] = 'DEF'; roles[4] = 'FWD';
                        }
                        return (
                          <div key={id} className="flex items-center gap-1 text-[10px]">
                            <span className="w-6 text-gray-500">{roles[i]}</span>
                            <span className="text-gray-300">#{id}</span>
                            <span className="ml-auto" style={{ color: statColor(Math.round(playerRating(p.stats))) }}>
                              {Math.round(playerRating(p.stats))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Formation Picker */}
              <div className="mb-2">
                <span className="mb-1 block text-[10px] text-gray-500">Formation</span>
                <div className="flex gap-1">
                  {(['balanced', 'offensive', 'defensive'] as Formation[]).map((f, i) => (
                    <button
                      key={f}
                      onClick={() => setFormation(f)}
                      className={`flex-1 rounded py-1 text-[10px] transition-colors ${
                        formation === f
                          ? 'bg-cyan-500 font-bold text-black'
                          : 'border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {FORMATION_NAMES[i]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                  <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-300">✕</button>
                </div>
              )}

              {/* Step Progress */}
              {matchStep && (
                <div className="mb-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-400">
                  {matchStep === 'squad' ? 'Step 1/2: Creating squad on-chain... (confirm in wallet)' : 'Step 2/2: Creating match... (confirm in wallet)'}
                </div>
              )}

              {/* Pending Accept Banner */}
              {pendingAcceptMatch && (
                <div className="mb-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-yellow-400">
                      Accepting Match #{pendingAcceptMatch.id}
                      {pendingAcceptMatch.stake > 0n && ` (Stake: ${formatETH(pendingAcceptMatch.stake)})`}
                    </span>
                    <button
                      onClick={() => setPendingAcceptMatch(null)}
                      className="text-[10px] text-yellow-600 hover:text-yellow-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Stake + Create / Accept */}
              <div className="flex gap-2">
                {!pendingAcceptMatch && (
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={stakeInput}
                    onChange={e => setStakeInput(e.target.value)}
                    placeholder="Stake (ETH, 0 = friendly)"
                    className="flex-1 rounded border border-white/10 bg-[#0d0d1a] px-2 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50 sm:py-1.5"
                  />
                )}
                <button
                  onClick={pendingAcceptMatch
                    ? () => doAcceptMatch(pendingAcceptMatch)
                    : handleCreateSquadAndMatch
                  }
                  disabled={isPending || selectedPlayers.length !== 5 || matchStep !== ''}
                  className={`rounded px-4 py-2 text-xs font-bold uppercase text-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5 ${
                    pendingAcceptMatch
                      ? 'flex-1 bg-yellow-500 hover:bg-yellow-400'
                      : 'bg-cyan-500 hover:bg-cyan-400'
                  } ${selectedPlayers.length === 5 && !isPending && matchStep === '' ? 'fc-pulse-cta' : ''}`}
                >
                  {matchStep === 'squad'
                    ? 'Creating Squad...'
                    : matchStep === 'match'
                      ? (pendingAcceptMatch ? 'Accepting...' : 'Creating Match...')
                      : pendingAcceptMatch
                        ? `Accept Match #${pendingAcceptMatch.id}`
                        : 'Create Match'
                  }
                </button>
              </div>
            </>
            );
          })()}
        </div>
      )}

      {/* ─── Match Board ─── */}
      {tab === 'matches' && (
        <div className="fc-tab-fade space-y-3" key="matches">
          {/* Open matches */}
          <div className="rounded-lg border border-white/10 bg-[#0d0d1a]/80 p-3 backdrop-blur-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-yellow-500">
              Open Challenges ({openMatches.length})
            </h3>
            {openMatches.length === 0 ? (
              <p className="text-xs text-gray-500">No open matches. Create one!</p>
            ) : (
              <div className="space-y-1">
                {openMatches.map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onAccept={handleAcceptClick}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent results */}
          <div className="rounded-lg border border-white/10 bg-[#0d0d1a]/80 p-3 backdrop-blur-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              Recent Results
            </h3>
            {resolvedMatches.length === 0 ? (
              <p className="text-xs text-gray-500">No matches played yet.</p>
            ) : (
              <div className="space-y-1">
                {resolvedMatches.slice(0, 10).map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onView={setViewingMatch}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Packs (Lootbox) ─── */}
      {tab === 'packs' && <div className="fc-tab-fade" key="packs"><LootboxPanel onGoToSquad={() => setTab('squad')} /></div>}

      {/* ─── Creator ─── */}
      {tab === 'creator' && <div className="fc-tab-fade" key="creator"><PlayerCreator onGoToPacks={() => setTab('packs')} /></div>}

      {/* ─── Standings ─── */}
      {tab === 'standings' && (
        <div className="fc-tab-fade rounded-lg border border-white/10 bg-[#0d0d1a]/80 p-3 backdrop-blur-sm" key="standings">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-yellow-500">
            Season Standings
          </h3>
          <p className="text-xs text-gray-500">
            Standings populate as matches are played.
          </p>
          {address && record.matchesPlayed > 0 && (
            <div className="mt-2 rounded border border-white/10 bg-black/30 p-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Your Record</span>
                <span className="text-white">
                  {record.wins}W {record.draws}D {record.losses}L
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Goal Diff</span>
                <span style={{ color: record.goalsFor >= record.goalsAgainst ? '#00ff88' : '#ff0055' }}>
                  {record.goalsFor - record.goalsAgainst > 0 ? '+' : ''}
                  {record.goalsFor - record.goalsAgainst}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
