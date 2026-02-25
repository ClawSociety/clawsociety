'use client';

/**
 * ServerFundBar — horizontal progress bar at the top of the page.
 *
 * Usage:
 *   <ServerFundBar />
 *
 * Reads live data from useServerFund() and renders:
 *   - Normal state:  "SERVER FUND: X.XXXX ETH / 10 ETH  (XX%)"  green fill bar
 *   - Autonomous:    "SOCIETY AUTONOMOUS" with full-width green glow bar
 */

import { useServerFund } from '@/hooks/useServerFund';
import { formatETH } from '@/lib/utils';

export function ServerFundBar() {
  const { balance, goal, isAutonomous, progress } = useServerFund();

  // Clamp rendered width between 0 and 100 for the CSS fill
  const fillPct = Math.max(0, Math.min(100, progress));

  // ------------------------------------------------------------------
  // Autonomous state — full-width glowing bar with special label
  // ------------------------------------------------------------------
  if (isAutonomous) {
    return (
      <div
        role="status"
        aria-label="Society is autonomous"
        className="relative w-full overflow-hidden"
        style={{
          height: '28px',
          background: '#0a0a0a',
          borderBottom: '1px solid rgba(0,255,136,0.3)',
        }}
      >
        {/* Full fill */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, #00ff88 0%, #00ffcc 100%)',
            boxShadow: '0 0 24px 6px rgba(0,255,136,0.7)',
            opacity: 0.92,
          }}
        />

        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-xs font-bold uppercase tracking-widest select-none"
            style={{
              color: '#000',
              letterSpacing: '0.22em',
              textShadow: '0 0 8px rgba(0,255,136,0.9)',
            }}
          >
            SOCIETY AUTONOMOUS
          </span>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Normal state
  // ------------------------------------------------------------------
  const balanceLabel = formatETH(balance);
  const goalLabel = formatETH(goal);
  const pctLabel = fillPct.toFixed(1);

  return (
    <div
      role="progressbar"
      aria-valuenow={fillPct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Server fund: ${balanceLabel} of ${goalLabel}`}
      className="relative w-full overflow-hidden"
      style={{
        height: '28px',
        background: '#0d0d1a',
        borderBottom: '1px solid rgba(0,255,136,0.15)',
      }}
    >
      {/* Background track */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: '#0d0d1a' }}
      />

      {/* Filled portion */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 h-full transition-all duration-700 ease-out"
        style={{
          width: `${fillPct}%`,
          background: 'linear-gradient(90deg, #006644 0%, #00cc6e 60%, #00ff88 100%)',
          boxShadow: fillPct > 0 ? '2px 0 12px 2px rgba(0,255,136,0.45)' : 'none',
        }}
      />

      {/* Label row — sits above the fill */}
      <div className="absolute inset-0 flex items-center px-3">
        <span
          className="font-mono text-xs font-bold uppercase tracking-widest select-none"
          style={{ color: 'rgba(0,255,136,0.9)', letterSpacing: '0.18em' }}
        >
          <span className="hidden sm:inline">SERVER FUND:</span>
          <span className="sm:hidden">FUND:</span>&nbsp;
        </span>
        <span
          className="font-mono text-xs font-bold select-none"
          style={{ color: '#fff' }}
        >
          {balanceLabel}
        </span>
        <span
          className="font-mono text-xs select-none"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          &nbsp;/&nbsp;{goalLabel}
        </span>

        {/* Percentage — pushed to the right */}
        <span
          className="ml-auto font-mono text-xs select-none"
          style={{ color: 'rgba(0,255,136,0.7)' }}
        >
          {pctLabel}%
        </span>
      </div>
    </div>
  );
}
