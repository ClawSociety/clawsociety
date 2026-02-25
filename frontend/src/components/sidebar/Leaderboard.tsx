'use client';

// Leaderboard - top 5 claimed seats sorted by price descending
// Usage: <Leaderboard seats={seats} />

import { Seat } from '@/lib/types';
import { BUILDING_CONFIGS } from '@/lib/constants';
import { formatETH, shortenAddress, ZERO_ADDRESS } from '@/lib/utils';

interface LeaderboardProps {
  seats: Seat[];
}

export function Leaderboard({ seats }: LeaderboardProps) {
  const ranked = seats
    .map((seat, index) => ({ seat, index }))
    .filter(({ seat }) => seat.holder !== ZERO_ADDRESS)
    .sort((a, b) => (a.seat.price > b.seat.price ? -1 : a.seat.price < b.seat.price ? 1 : 0))
    .slice(0, 5);

  const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32', '#aaaaaa', '#aaaaaa'];
  const rankLabels = ['1st', '2nd', '3rd', '4th', '5th'];

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
      <h3
        className="mb-2 font-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: '#ffd700' }}
      >
        Leaderboard
      </h3>

      {ranked.length === 0 ? (
        <p className="font-mono text-xs text-gray-500">No seats claimed yet.</p>
      ) : (
        <ul className="space-y-1">
          {ranked.map(({ seat, index }, rank) => {
            const building = BUILDING_CONFIGS[seat.buildingType] ?? BUILDING_CONFIGS[6];
            const isEven = rank % 2 === 0;

            return (
              <li
                key={index}
                className={`flex items-center gap-2 rounded px-2 py-2.5 font-mono text-xs sm:py-1 ${
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

                {/* Building */}
                <span className="shrink-0 text-sm leading-none">{building.emoji}</span>
                <span
                  className="w-16 shrink-0 truncate text-[10px]"
                  style={{ color: building.color }}
                >
                  {building.name}
                </span>

                {/* Owner */}
                <span className="min-w-0 flex-1 truncate text-gray-400">
                  {shortenAddress(seat.holder)}
                </span>

                {/* Price */}
                <span className="shrink-0 font-bold" style={{ color: '#00ff88' }}>
                  {formatETH(seat.price)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
