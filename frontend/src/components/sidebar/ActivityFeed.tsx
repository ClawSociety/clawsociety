'use client';

import { useContractEvents, ContractEvent, EventType } from '@/hooks/useContractEvents';
import { formatETH, shortenAddress } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Event display config
// ---------------------------------------------------------------------------

interface EventConfig {
  icon: string;
  color: string;
}

const EVENT_CONFIG: Record<EventType, EventConfig> = {
  SeatClaimed:      { icon: '[+]', color: '#00ff88' },
  SeatBoughtOut:    { icon: '[!]', color: '#ffd700' },
  SeatAbandoned:    { icon: '[-]', color: '#ff4455' },
  SeatForfeited:    { icon: '[x]', color: '#ff2233' },
  PriceChanged:     { icon: '[$]', color: '#00ffff' },
  DepositAdded:     { icon: '[^]', color: '#8855ff' },
  DepositWithdrawn: { icon: '[v]', color: '#ff8855' },
  FeesClaimed:      { icon: '[*]', color: '#00ff88' },
  FeesDistributed:  { icon: '[~]', color: '#ff44ff' },
};

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Event description
// ---------------------------------------------------------------------------

function describeEvent(event: ContractEvent): string {
  const seat = event.seatId !== undefined ? `Seat #${event.seatId.toString()}` : '';
  const addr = event.address ? shortenAddress(event.address) : '';
  const oldAddr = event.oldAddress ? shortenAddress(event.oldAddress) : '';
  const amt = event.amount ? formatETH(event.amount) : '';

  switch (event.type) {
    case 'SeatClaimed':
      return `${seat} claimed by ${addr}`;
    case 'SeatBoughtOut':
      return `${seat} bought out by ${addr}${oldAddr ? ` from ${oldAddr}` : ''}`;
    case 'SeatAbandoned':
      return `${seat} abandoned by ${addr}`;
    case 'SeatForfeited':
      return `${seat} forfeited by ${addr}`;
    case 'PriceChanged':
      return `${seat} price set to ${amt}`;
    case 'DepositAdded':
      return `${seat} deposit +${amt}`;
    case 'DepositWithdrawn':
      return `${seat} deposit -${amt}`;
    case 'FeesClaimed':
      return `${addr} claimed ${amt} fees`;
    case 'FeesDistributed':
      return `${amt} distributed to holders`;
    default:
      return 'Unknown event';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed() {
  const { events } = useContractEvents();

  return (
    <div
      className="rounded-lg border border-white/10 bg-[#0d0d1a] p-3"
      style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}
    >
      <h3
        className="mb-2 font-mono text-xs font-bold uppercase tracking-widest"
        style={{ color: '#00ffff' }}
      >
        Activity
      </h3>

      {events.length === 0 ? (
        <div
          className="flex items-center gap-2 py-3"
          style={{ color: 'rgba(160,160,200,0.5)' }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#00ff88',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <span className="text-xs">Watching for events...</span>
        </div>
      ) : (
        <div
          style={{
            maxHeight: '280px',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent',
          }}
        >
          {events.map((event, i) => {
            const config = EVENT_CONFIG[event.type];
            return (
              <div
                key={`${event.txHash}-${event.logIndex}-${i}`}
                className="flex items-start gap-2 py-1.5"
                style={{
                  borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                }}
              >
                {/* Icon */}
                <span
                  className="shrink-0 text-xs font-bold"
                  style={{
                    color: config.color,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    lineHeight: '1.4',
                  }}
                >
                  {config.icon}
                </span>

                {/* Description + timestamp */}
                <div className="min-w-0 flex-1">
                  <div
                    className="text-xs leading-snug"
                    style={{ color: 'rgba(220,220,240,0.85)' }}
                  >
                    {describeEvent(event)}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'rgba(160,160,200,0.35)', fontSize: '0.6rem', marginTop: '1px' }}
                  >
                    {relativeTime(event.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
