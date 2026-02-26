'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useLootbox } from '@/hooks/useCloudFCLootbox';
import { useMyPlayers } from '@/hooks/useCloudFC';
import type { CloudFCPlayer, PlayerStats } from '@/lib/fc/types';
import {
  playerTier, playerName,
  TIER_COLORS, TIER_LABELS,
} from '@/lib/fc/playerNames';
import { PixelCard } from './PixelCard';
import { PackVisual } from './PackVisual';

// ─────────────────── Helpers ─────────────────────────────────

function statColor(val: number): string {
  if (val >= 85) return '#00ff88';
  if (val >= 70) return '#00ffff';
  if (val >= 50) return '#ffd700';
  if (val >= 30) return '#ff8855';
  return '#ff0055';
}

function avgStat(stats: PlayerStats): number {
  return Math.round(
    (stats.speed + stats.passing + stats.shooting + stats.defense + stats.stamina) / 5
  );
}

// ─────────────────── PlayerCardFull ──────────────────────────

function PlayerCardFull({
  player,
  revealed,
  delay,
}: {
  player: CloudFCPlayer;
  revealed: boolean;
  delay: number;
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const avg = avgStat(player.stats);
  const tier = playerTier(avg);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(() => setIsFlipped(true), delay);
      return () => clearTimeout(timer);
    }
  }, [revealed, delay]);

  if (!isFlipped) {
    return (
      <div
        className="flex h-[320px] w-[200px] items-center justify-center rounded-xl border-2 border-white/20 bg-gradient-to-b from-gray-800 to-gray-900"
        style={{ animation: 'pulse 1.5s infinite' }}
      >
        <span className="text-4xl text-white/20">?</span>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <PixelCard
        tokenId={player.id}
        stats={player.stats}
        tier={tier}
        width={200}
      />
    </div>
  );
}

// ─────────────────── Mini Card for Collection ────────────────

function MiniCard({ player }: { player: CloudFCPlayer }) {
  const avg = avgStat(player.stats);
  const tier = playerTier(avg);
  const colors = TIER_COLORS[tier];
  const name = playerName(player.id, tier);

  return (
    <div
      className="rounded-lg border p-2 font-mono"
      style={{
        borderColor: colors.border,
        background: colors.bg,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[8px]" style={{ color: colors.text }}>
          {TIER_LABELS[tier]}
        </span>
        <span className="text-[8px] text-gray-600">#{player.id}</span>
      </div>
      <div className="mb-0.5 truncate text-[10px] font-bold text-white">
        {name}
      </div>
      <div className="flex items-center gap-1">
        <span
          className="rounded px-1 text-[10px] font-black"
          style={{
            color: '#0d0d1a',
            backgroundColor: statColor(avg),
          }}
        >
          {avg}
        </span>
        <div className="flex gap-0.5 text-[7px] text-gray-500">
          <span>S{player.stats.speed}</span>
          <span>P{player.stats.passing}</span>
          <span>H{player.stats.shooting}</span>
          <span>D{player.stats.defense}</span>
          <span>T{player.stats.stamina}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Main Panel ──────────────────────────────

type SubTab = 'open' | 'collection';

export function LootboxPanel({ onGoToSquad }: { onGoToSquad?: () => void }) {
  const { address } = useAccount();
  const { packPrice, totalPacks, openPack, isPending, isSuccess, refetch } = useLootbox(address);
  const { players: myPlayers, refetchPlayers } = useMyPlayers(address);
  const [subtab, setSubtab] = useState<SubTab>('open');
  const [revealedPlayers, setRevealedPlayers] = useState<CloudFCPlayer[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [preOpenCount, setPreOpenCount] = useState<number | null>(null);

  // When transaction succeeds, immediately refetch players with retry logic
  useEffect(() => {
    if (!isSuccess || preOpenCount === null) return;

    // If players already loaded (from a previous refetch), show reveal
    if (myPlayers.length >= preOpenCount + 5) {
      const sorted = [...myPlayers].sort((a, b) => b.id - a.id);
      const newPlayers = sorted.slice(0, 5).reverse();
      setRevealedPlayers(newPlayers);
      setShowReveal(true);
      setPreOpenCount(null);
      refetch();
      return;
    }

    // Retry refetch up to 5 times with 2s intervals
    let attempt = 0;
    const maxRetries = 5;
    const timer = setInterval(() => {
      attempt++;
      refetchPlayers();
      if (attempt >= maxRetries) clearInterval(timer);
    }, 2000);

    // Immediately trigger first refetch
    refetchPlayers();

    return () => clearInterval(timer);
  }, [isSuccess, myPlayers.length, preOpenCount, myPlayers, refetch, refetchPlayers]);

  const handleOpenPack = async () => {
    setShowReveal(false);
    setRevealedPlayers([]);
    setPreOpenCount(myPlayers.length);
    try {
      await openPack();
    } catch (e) {
      console.error('openPack failed:', e);
      setPreOpenCount(null);
    }
  };

  // Sort collection by tier (diamond first)
  const sortedPlayers = useMemo(() => {
    return [...myPlayers].sort((a, b) => {
      const aAvg = avgStat(a.stats);
      const bAvg = avgStat(b.stats);
      return bAvg - aAvg;
    });
  }, [myPlayers]);

  return (
    <div className="flex flex-col gap-3 font-mono">
      {/* Header */}
      <div className="rounded-xl border border-white/10 bg-[#1a1a2e] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-2xl">&#x1F4E6;</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
              Lootbox Packs
            </h2>
            <p className="text-[10px] text-gray-500">
              Open a pack to get 5 random players
            </p>
          </div>
          <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
            {totalPacks} opened
          </span>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1">
          {(['open', 'collection'] as SubTab[]).map(t => (
            <button
              key={t}
              onClick={() => setSubtab(t)}
              className="flex-1 rounded py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{
                color: subtab === t ? '#0d0d1a' : '#00ffff',
                background: subtab === t ? '#00ffff' : 'transparent',
                border: `1px solid ${subtab === t ? '#00ffff' : '#00ffff33'}`,
              }}
            >
              {t === 'open' ? 'Open Pack' : `Collection (${myPlayers.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Pack Opening ─── */}
      {subtab === 'open' && (
        <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-4">
          {!address ? (
            <p className="text-center text-xs text-gray-500">
              Connect wallet to open packs.
            </p>
          ) : (
            <>
              {/* Pack Visual + Buy */}
              {!showReveal && (
                <div className="mb-4 text-center">
                  <button
                    onClick={handleOpenPack}
                    disabled={isPending}
                    className="mx-auto block disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PackVisual isPending={isPending} packPrice={packPrice} />
                  </button>

                  <div className="mt-3 flex justify-center gap-4 text-[10px] text-gray-600">
                    <span>Bronze 60%</span>
                    <span>Silver 25%</span>
                    <span>Gold 12%</span>
                    <span>Diamond 3%</span>
                  </div>
                </div>
              )}

              {/* Reveal Animation */}
              {showReveal && revealedPlayers.length === 5 && (
                <div>
                  <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-yellow-400">
                    Pack Opened!
                  </h3>
                  <div className="flex flex-wrap justify-center gap-3">
                    {revealedPlayers.map((player, i) => (
                      <PlayerCardFull
                        key={player.id}
                        player={player}
                        revealed={true}
                        delay={i * 600}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        setShowReveal(false);
                        setRevealedPlayers([]);
                      }}
                      className="rounded border border-white/20 px-4 py-2 text-xs text-gray-400 hover:bg-white/10"
                    >
                      Open Another
                    </button>
                    {onGoToSquad && (
                      <button
                        onClick={onGoToSquad}
                        className="rounded bg-cyan-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-cyan-400"
                      >
                        Build Squad
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Pending animation */}
              {isPending && !showReveal && (
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="flex h-[320px] w-[200px] items-center justify-center rounded-xl border-2 border-white/20 bg-gradient-to-b from-gray-800 to-gray-900"
                      style={{
                        animation: `pulse 1.5s infinite ${i * 0.2}s`,
                      }}
                    >
                      <span className="text-4xl text-white/20">?</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Collection ─── */}
      {subtab === 'collection' && (
        <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
          {!address ? (
            <p className="text-xs text-gray-500">Connect wallet to see collection.</p>
          ) : sortedPlayers.length === 0 ? (
            <p className="text-xs text-gray-500">
              No players yet. Open a pack to get started!
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {sortedPlayers.map(player => (
                <MiniCard key={player.id} player={player} />
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: rotateY(90deg) scale(0.8); }
          to { opacity: 1; transform: rotateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
