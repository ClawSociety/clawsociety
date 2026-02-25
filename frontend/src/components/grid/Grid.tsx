'use client';

/**
 * Grid — the 10x10 Claw Society city grid.
 *
 * Usage:
 *   <Grid
 *     selectedSeat={selectedSeat}
 *     onSelectSeat={(id) => setSelectedSeat(id)}
 *   />
 */

import { CSSProperties, memo } from 'react';
import { useAccount } from 'wagmi';
import { useGridState } from '@/hooks/useGridState';
import { GRID_SIZE } from '@/lib/constants';
import { Tile } from './Tile';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GridProps {
  selectedSeat: number | null;
  onSelectSeat: (seatId: number) => void;
}

// ---------------------------------------------------------------------------
// Skeleton tile — shown while data is loading
// ---------------------------------------------------------------------------

function SkeletonTile({ index }: { index: number }) {
  // Stagger the pulse animation so tiles don't all flash in unison
  const delayMs = (index % 10) * 40 + Math.floor(index / 10) * 20;

  return (
    <div
      aria-hidden="true"
      style={{
        aspectRatio: '1',
        borderRadius: '4px',
        backgroundColor: '#1e1e35',
        border: '1px solid #2a2a45',
        animationDelay: `${delayMs}ms`,
      }}
      className="skeleton-pulse"
    />
  );
}

// ---------------------------------------------------------------------------
// Grid component
// ---------------------------------------------------------------------------

// Memoized so parent re-renders don't cascade into every tile.
const Grid = memo(function Grid({ selectedSeat, onSelectSeat }: GridProps) {
  const { seats, isLoading } = useGridState();
  const { address: userAddress } = useAccount();

  // ------------------------------------------------------------------
  // Grid container styling
  // ------------------------------------------------------------------

  const wrapperStyle: CSSProperties = {
    paddingBottom: '12px',
  };

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
    gap: 'clamp(2px, 0.4vw, 5px)',
    width: '100%',
    minWidth: '430px',
  };

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (isLoading) {
    return (
      <section
        aria-label="City grid loading"
        aria-busy="true"
        style={wrapperStyle}
        className="w-full overflow-x-auto lg:overflow-hidden"
      >
        <div style={gridStyle} className="grid-tilt" role="presentation">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
            <SkeletonTile key={i} index={i} />
          ))}
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------
  // Error / empty state — contract returned no seats
  // ------------------------------------------------------------------

  if (!seats.length) {
    return (
      <section
        aria-label="City grid"
        className="w-full flex items-center justify-center py-16"
      >
        <p
          className="text-sm font-mono"
          style={{ color: '#ff3377' }}
        >
          Unable to load grid data. Check your connection and try again.
        </p>
      </section>
    );
  }

  // ------------------------------------------------------------------
  // Populated grid
  // ------------------------------------------------------------------

  return (
    <section
      aria-label={`Claw Society city grid, ${GRID_SIZE * GRID_SIZE} seats`}
      style={wrapperStyle}
      className="w-full overflow-x-auto lg:overflow-hidden"
    >
      <div
        style={gridStyle}
        className="grid-tilt"
        // Accessible grid semantics — screen readers will announce the
        // grid role and navigate cells individually via the Tile's own
        // role="button" + aria-label.
        role="grid"
        aria-colcount={GRID_SIZE}
        aria-rowcount={GRID_SIZE}
      >
        {seats.map((seat, index) => (
          <div
            key={index}
            role="gridcell"
            aria-rowindex={Math.floor(index / GRID_SIZE) + 1}
            aria-colindex={(index % GRID_SIZE) + 1}
          >
            <Tile
              seat={seat}
              seatId={index}
              isSelected={selectedSeat === index}
              userAddress={userAddress}
              onClick={onSelectSeat}
            />
          </div>
        ))}
      </div>

      {/* Row / column labels — visible on larger screens only */}
      <div
        aria-hidden="true"
        className="hidden sm:flex justify-between mt-1 px-0.5"
      >
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <span
            key={i}
            className="flex-1 text-center font-mono"
            style={{
              fontSize: '0.5rem',
              color: 'rgba(160,160,200,0.4)',
            }}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </section>
  );
});

Grid.displayName = 'Grid';

export { Grid };
