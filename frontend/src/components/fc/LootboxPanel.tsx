'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { formatETH } from '@/lib/utils';
import { useLootbox } from '@/hooks/useCloudFCLootbox';
import { useMyPlayers } from '@/hooks/useCloudFC';
import type { CloudFCPlayer, PlayerStats } from '@/lib/fc/types';
import {
  playerTier, playerName, cardImageUrl,
  TIER_COLORS, TIER_LABELS, TIER_STARS,
} from '@/lib/fc/playerNames';

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
  const colors = TIER_COLORS[tier];
  const name = playerName(player.id, tier);
  const imgUrl = cardImageUrl(player.id, tier);

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
    <div
      className="relative flex h-[320px] w-[200px] flex-col rounded-xl border-2 p-3 transition-all duration-500"
      style={{
        borderColor: colors.border,
        background: `linear-gradient(180deg, ${colors.bg} 0%, #0d0d1a 100%)`,
        boxShadow: `0 0 20px ${colors.glow}, inset 0 0 20px ${colors.glow}`,
        animation: 'fadeIn 0.4s ease-out',
      }}
    >
      {/* Tier Banner */}
      <div className="mb-1 text-center">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: colors.text }}
        >
          {TIER_STARS[tier]} {TIER_LABELS[tier]} {TIER_STARS[tier]}
        </span>
      </div>

      {/* Portrait */}
      <div
        className="mx-auto mb-2 flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-lg border"
        style={{ borderColor: colors.border }}
      >
        <img
          src={imgUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.innerHTML =
              `<div class="flex h-full w-full items-center justify-center text-3xl" style="color:${colors.text}">&#9917;</div>`;
          }}
        />
      </div>

      {/* Name */}
      <div className="mb-0.5 text-center">
        <span className="block truncate font-mono text-xs font-bold text-white">
          {name}
        </span>
      </div>

      {/* OVR Badge */}
      <div className="mb-1.5 text-center">
        <span
          className="inline-block rounded-full px-2 py-0.5 font-mono text-sm font-black"
          style={{
            color: '#0d0d1a',
            backgroundColor: statColor(avg),
          }}
        >
          OVR: {avg}
        </span>
      </div>

      {/* Stat Bars */}
      <div className="space-y-0.5">
        {[
          { label: 'SPD', value: player.stats.speed },
          { label: 'PAS', value: player.stats.passing },
          { label: 'SHO', value: player.stats.shooting },
          { label: 'DEF', value: player.stats.defense },
          { label: 'STA', value: player.stats.stamina },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="w-6 font-mono text-[8px] text-gray-500">{label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${value}%`,
                  backgroundColor: statColor(value),
                }}
              />
            </div>
            <span
              className="w-5 text-right font-mono text-[8px]"
              style={{ color: statColor(value) }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Token ID */}
      <div className="mt-auto pt-1 text-center">
        <span className="font-mono text-[8px] text-gray-600">
          #{String(player.id).padStart(4, '0')}
        </span>
      </div>
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
  const { players: myPlayers } = useMyPlayers(address);
  const [subtab, setSubtab] = useState<SubTab>('open');
  const [revealedPlayers, setRevealedPlayers] = useState<CloudFCPlayer[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [preOpenCount, setPreOpenCount] = useState<number | null>(null);

  // When transaction succeeds, capture the newly minted players for reveal
  useEffect(() => {
    if (isSuccess && preOpenCount !== null && myPlayers.length >= preOpenCount + 5) {
      // Sort by id descending and take the 5 newest
      const sorted = [...myPlayers].sort((a, b) => b.id - a.id);
      const newPlayers = sorted.slice(0, 5).reverse();
      setRevealedPlayers(newPlayers);
      setShowReveal(true);
      setPreOpenCount(null);
      refetch();
    }
  }, [isSuccess, myPlayers.length, preOpenCount, myPlayers, refetch]);

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
              {/* Buy Button */}
              {!showReveal && (
                <div className="mb-4 text-center">
                  <button
                    onClick={handleOpenPack}
                    disabled={isPending}
                    className="group relative rounded-xl border-2 border-cyan-400 bg-gradient-to-b from-cyan-500/20 to-transparent px-8 py-4 transition-all hover:from-cyan-500/30 hover:shadow-[0_0_30px_rgba(0,255,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="block text-lg font-black uppercase text-cyan-400">
                      {isPending ? 'Opening...' : 'Open Pack'}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {formatETH(packPrice)} for 5 players
                    </span>
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
