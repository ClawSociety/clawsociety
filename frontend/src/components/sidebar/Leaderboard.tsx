'use client';

// Leaderboard - top 5 holders aggregated by pending fees or total price
// Usage: <Leaderboard seats={seats} />

import { useState } from 'react';
import { Seat } from '@/lib/types';
import { formatETH, shortenAddress } from '@/lib/utils';
import { useLeaderboard, HolderStats } from '@/hooks/useLeaderboard';

/** Read a stored nickname for any address directly from localStorage. */
function readNickname(address: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(`claw_profile_${address.toLowerCase()}`);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { nickname?: string };
    return typeof parsed.nickname === 'string' ? parsed.nickname : '';
  } catch {
    return '';
  }
}

type Tab = 'earners' | 'whales';

interface LeaderboardProps {
  seats: Seat[];
}

const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#aaaaaa', '#aaaaaa'];
const rankLabels = ['1st', '2nd', '3rd', '4th', '5th'];

function HolderRow({ holder, rank, tab }: { holder: HolderStats; rank: number; tab: Tab }) {
  const isEven = rank % 2 === 0;
  const displayName = readNickname(holder.holder) || shortenAddress(holder.holder);

  return (
    <li
      className={`flex items-center gap-2 rounded px-2 py-2.5 font-mono text-xs sm:py-1.5 ${
        isEven ? 'bg-white/5' : 'bg-transparent'
      }`}
    >
      {/* Rank */}
      <span
        className="w-6 shrink-0 text-center font-bold"
        style={{ color: rankColors[rank] }}
      >
        {rankLabels[rank]}
      </span>

      {/* Name + seat count */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-gray-300">{displayName}</span>
        <span className="text-[10px] text-gray-600">
          {holder.seatCount} seat{holder.seatCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Primary stat */}
      <span className="shrink-0 text-right font-bold" style={{ color: tab === 'earners' ? '#00ffff' : '#00ff88' }}>
        {tab === 'earners' ? formatETH(holder.pendingFees) : formatETH(holder.totalPrice)}
      </span>
    </li>
  );
}

export function Leaderboard({ seats }: LeaderboardProps) {
  const [tab, setTab] = useState<Tab>('earners');
  const { byFees, byPrice } = useLeaderboard(seats);

  const ranked = tab === 'earners' ? byFees : byPrice;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
      {/* Header + Tabs */}
      <div className="mb-2 flex items-center justify-between">
        <h3
          className="font-mono text-xs font-bold uppercase tracking-widest"
          style={{ color: '#ffd700' }}
        >
          Leaderboard
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('earners')}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
            style={{
              color: tab === 'earners' ? '#0d0d1a' : '#00ffff',
              background: tab === 'earners' ? '#00ffff' : 'transparent',
              border: `1px solid ${tab === 'earners' ? '#00ffff' : '#00ffff33'}`,
            }}
          >
            Earners
          </button>
          <button
            onClick={() => setTab('whales')}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors"
            style={{
              color: tab === 'whales' ? '#0d0d1a' : '#00ff88',
              background: tab === 'whales' ? '#00ff88' : 'transparent',
              border: `1px solid ${tab === 'whales' ? '#00ff88' : '#00ff8833'}`,
            }}
          >
            Whales
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <p className="mb-1.5 font-mono text-[10px] text-gray-600">
        {tab === 'earners' ? 'By unclaimed fees' : 'By total seat value'}
      </p>

      {ranked.length === 0 ? (
        <p className="font-mono text-xs text-gray-500">No holders yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {ranked.map((holder, rank) => (
            <HolderRow key={holder.holder} holder={holder} rank={rank} tab={tab} />
          ))}
        </ul>
      )}
    </div>
  );
}
