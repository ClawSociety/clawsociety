'use client';

import { useContractEvents, ContractEvent, EventType } from '@/hooks/useContractEvents';
import { formatETH, shortenAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Ticker item config
// ---------------------------------------------------------------------------

interface TickerConfig {
  icon: string;
  label: string;
  color: string;
}

const TICKER_CONFIG: Record<EventType, TickerConfig> = {
  SeatClaimed:      { icon: '\u2191', label: 'Claimed',      color: '#00ff88' },
  SeatBoughtOut:    { icon: '\u26A1', label: 'Buy',          color: '#ffd700' },
  SeatAbandoned:    { icon: '\u2193', label: 'Abandoned',    color: '#ff4455' },
  SeatForfeited:    { icon: '\u2717', label: 'Forfeited',    color: '#ff2233' },
  PriceChanged:     { icon: '\u0024', label: 'Price Set',    color: '#00ffff' },
  DepositAdded:     { icon: '\u002B', label: 'Deposit',      color: '#8855ff' },
  DepositWithdrawn: { icon: '\u2212', label: 'Withdrew',     color: '#ff8855' },
  FeesClaimed:      { icon: '\u0024', label: 'Claimed Fees', color: '#00ff88' },
  FeesDistributed:  { icon: '\u007E', label: 'Distributed',  color: '#ff44ff' },
};

function tickerText(event: ContractEvent): { addr: string; action: string; amount?: string } {
  const addr = event.address ? shortenAddress(event.address) : '';
  const config = TICKER_CONFIG[event.type];

  switch (event.type) {
    case 'SeatClaimed':
      return { addr, action: `Claimed #${event.seatId?.toString() ?? '?'}` };
    case 'SeatBoughtOut':
      return { addr, action: `Buy #${event.seatId?.toString() ?? '?'}`, amount: event.amount ? formatETH(event.amount) : undefined };
    case 'SeatAbandoned':
      return { addr, action: `Abandoned #${event.seatId?.toString() ?? '?'}` };
    case 'SeatForfeited':
      return { addr, action: `Forfeited #${event.seatId?.toString() ?? '?'}` };
    case 'PriceChanged':
      return { addr: `#${event.seatId?.toString() ?? '?'}`, action: config.label, amount: event.amount ? formatETH(event.amount) : undefined };
    case 'DepositAdded':
      return { addr: `#${event.seatId?.toString() ?? '?'}`, action: config.label, amount: event.amount ? formatETH(event.amount) : undefined };
    case 'DepositWithdrawn':
      return { addr: `#${event.seatId?.toString() ?? '?'}`, action: config.label, amount: event.amount ? formatETH(event.amount) : undefined };
    case 'FeesClaimed':
      return { addr, action: config.label, amount: event.amount ? formatETH(event.amount) : undefined };
    case 'FeesDistributed':
      return { addr: '', action: config.label, amount: event.amount ? formatETH(event.amount) : undefined };
    default:
      return { addr, action: 'Event' };
  }
}

// ---------------------------------------------------------------------------
// Single ticker item
// ---------------------------------------------------------------------------

function TickerItem({ event }: { event: ContractEvent }) {
  const config = TICKER_CONFIG[event.type];
  const { addr, action, amount } = tickerText(event);

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-4 font-mono text-xs">
      <span style={{ color: config.color }}>{config.icon}</span>
      {addr && <span className="text-white/70">{addr}</span>}
      <span style={{ color: config.color }}>{action}</span>
      {amount && <span className="text-white/50">{amount}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ticker bar
// ---------------------------------------------------------------------------

export function ActivityTicker() {
  const { events } = useContractEvents();

  // Show nothing if no events yet
  if (events.length === 0) return null;

  // Duplicate items for seamless loop
  const items = events.slice(0, 20);

  return (
    <div
      className="relative w-full overflow-hidden border-b border-white/5"
      style={{ background: '#0a0a12', height: '32px' }}
    >
      <div className="ticker-track flex items-center" style={{ height: '32px' }}>
        {/* First copy */}
        {items.map((event, i) => (
          <TickerItem key={`a-${event.txHash}-${event.logIndex}-${i}`} event={event} />
        ))}
        {/* Duplicate for seamless loop */}
        {items.map((event, i) => (
          <TickerItem key={`b-${event.txHash}-${event.logIndex}-${i}`} event={event} />
        ))}
      </div>

      {/* Edge fades */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-8"
        style={{ background: 'linear-gradient(to right, #0a0a12, transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-8"
        style={{ background: 'linear-gradient(to left, #0a0a12, transparent)' }}
      />

      <style jsx>{`
        .ticker-track {
          animation: ticker-scroll 30s linear infinite;
          width: max-content;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
