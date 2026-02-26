'use client';

// Sidebar - main container for tile details, leaderboard, activity feed
// Usage: <Sidebar selectedSeat={selectedSeatId} seats={seats} onAction={handleAction} />

import { Seat } from '@/lib/types';
import { ZERO_ADDRESS, formatETH } from '@/lib/utils';
import { TileDetails } from './TileDetails';
import { Leaderboard } from './Leaderboard';
import { ActivityFeed } from './ActivityFeed';

interface SidebarProps {
  selectedSeat: number | null;
  seats: Seat[];
  onAction?: (action: string, params: Record<string, string>) => void;
}

function GridStats({ seats }: { seats: Seat[] }) {
  const claimed = seats.filter((s) => s.holder !== ZERO_ADDRESS);
  const totalValue = claimed.reduce((acc, s) => acc + s.price, 0n);
  const totalDeposit = claimed.reduce((acc, s) => acc + s.deposit, 0n);

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3">
      <h3
        className="mb-2 font-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: '#8855ff' }}
      >
        Grid Stats
      </h3>
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="font-mono text-xs text-gray-400">Seats Claimed</span>
          <span className="font-mono text-xs font-bold text-white">
            {claimed.length} / {seats.length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-xs text-gray-400">Total Value</span>
          <span className="font-mono text-xs font-bold" style={{ color: '#00ff88' }}>
            {formatETH(totalValue)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-xs text-gray-400">Total Deposits</span>
          <span className="font-mono text-xs font-bold" style={{ color: '#ffd700' }}>
            {formatETH(totalDeposit)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ selectedSeat, seats, onAction }: SidebarProps) {
  const activeSeat = selectedSeat !== null ? seats[selectedSeat] ?? null : null;

  const handleAction = (action: string, params: Record<string, string>) => {
    if (onAction && selectedSeat !== null) {
      onAction(action, params);
    }
  };

  return (
    <aside
      className="flex flex-col gap-3 px-1 py-2 lg:h-full lg:max-h-screen lg:overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
    >
      {/* ---- Tile Details or placeholder ---- */}
      {activeSeat && selectedSeat !== null ? (
        <TileDetails seat={activeSeat} seatId={selectedSeat} onAction={handleAction} />
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-white/10 p-8 text-center"
          style={{ background: '#1a1a2e', minHeight: '180px' }}
        >
          <span className="mb-2 text-3xl">&#x1F5FA;&#xFE0F;</span>
          <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-400">
            Select a tile
          </p>
          <p className="mt-1 font-mono text-xs text-gray-600">
            Click any tile on the grid to view details and take actions.
          </p>
        </div>
      )}

      {/* ---- Leaderboard ---- */}
      <Leaderboard seats={seats} />

      {/* ---- Grid Stats ---- */}
      <GridStats seats={seats} />

      {/* ---- Activity Feed ---- */}
      <ActivityFeed />
    </aside>
  );
}
