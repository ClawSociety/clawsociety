'use client';

// Sidebar - main container for tile details, leaderboard, activity feed, and Claw FC
// Usage: <Sidebar selectedSeat={selectedSeatId} seats={seats} onAction={handleAction} />

import { useState } from 'react';
import { Seat } from '@/lib/types';
import { ZERO_ADDRESS, formatETH } from '@/lib/utils';
import { TileDetails } from './TileDetails';
import { Leaderboard } from './Leaderboard';
import { ActivityFeed } from './ActivityFeed';
import { FCPanel } from '../fc/FCPanel';

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

type SidebarView = 'grid' | 'fc';

export function Sidebar({ selectedSeat, seats, onAction }: SidebarProps) {
  const [view, setView] = useState<SidebarView>('grid');
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
      {/* ---- View Switcher ---- */}
      <div className="flex gap-1">
        <button
          onClick={() => setView('grid')}
          className="flex-1 rounded py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
          style={{
            color: view === 'grid' ? '#0d0d1a' : '#8855ff',
            background: view === 'grid' ? '#8855ff' : 'transparent',
            border: `1px solid ${view === 'grid' ? '#8855ff' : '#8855ff33'}`,
          }}
        >
          Grid
        </button>
        <button
          onClick={() => setView('fc')}
          className="flex-1 rounded py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
          style={{
            color: view === 'fc' ? '#0d0d1a' : '#00ffff',
            background: view === 'fc' ? '#00ffff' : 'transparent',
            border: `1px solid ${view === 'fc' ? '#00ffff' : '#00ffff33'}`,
          }}
        >
          Claw FC
        </button>
      </div>

      {view === 'grid' && (
        <>
          {/* ---- Tile Details or placeholder ---- */}
          {activeSeat && selectedSeat !== null ? (
            <TileDetails seat={activeSeat} seatId={selectedSeat} onAction={handleAction} />
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-xl border border-white/10 p-8 text-center"
              style={{ background: '#1a1a2e', minHeight: '180px' }}
            >
              <span className="mb-2 text-3xl">🗺️</span>
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
        </>
      )}

      {view === 'fc' && <FCPanel seats={seats} />}
    </aside>
  );
}
