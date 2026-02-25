'use client';

/**
 * PriceTag — compact ETH price display with optional multiplier badge.
 *
 * Usage:
 *   <PriceTag price={100000000000000000n} />
 *   <PriceTag price={250000000000000000n} multiplier={1.8} />
 *
 * Props:
 *   price      — raw ETH amount as bigint (18-decimal precision, wei)
 *   multiplier — optional Harberger building multiplier (e.g. 1.8 for Bank)
 */

import { formatETH } from '@/lib/utils';

interface PriceTagProps {
  price: bigint;
  multiplier?: number;
}

export function PriceTag({ price, multiplier }: PriceTagProps) {
  const formatted = formatETH(price);

  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Price amount */}
      <span
        className="font-mono font-bold"
        style={{ color: '#00ff88' }}
      >
        {formatted}
      </span>

      {/* Multiplier badge — only rendered when provided and meaningful */}
      {multiplier !== undefined && multiplier !== 1.0 && (
        <span
          className="inline-flex items-center rounded px-1 py-0.5 font-mono text-xs font-bold"
          style={{
            background: 'rgba(0,255,136,0.12)',
            border: '1px solid rgba(0,255,136,0.3)',
            color: '#00ffaa',
            fontSize: '0.6rem',
            letterSpacing: '0.04em',
          }}
          aria-label={`${multiplier}x fee multiplier`}
          title={`${multiplier}x fee multiplier`}
        >
          {multiplier.toFixed(1)}x
        </span>
      )}
    </span>
  );
}
