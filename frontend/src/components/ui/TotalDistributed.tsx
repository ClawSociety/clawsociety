'use client';

/**
 * TotalDistributed — banner showing the all-time total ETH distributed to seat holders.
 *
 * Usage:
 *   <TotalDistributed />
 *
 * Data strategy:
 *   1. On mount, uses usePublicClient to fetch ALL FeesDistributed logs from the
 *      contract deploy block (42601000) to the current block and sums the amounts.
 *   2. Subscribes to new FeesDistributed events via useWatchContractEvent to
 *      incrementally add to the running total in real-time without re-fetching history.
 *   3. ETH/USD price is fetched from CoinGecko on mount and refreshed every 60 s.
 *
 * Display:
 *   TOTAL ETH DISTRIBUTED TO SEATS: 0.4521 ETH  (~$1,234.56)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Block where the ETH-based contract was deployed (use a slightly-before value to be safe). */
const DEPLOY_BLOCK = 42601000n;

/** CoinGecko simple price endpoint — no API key required for modest usage. */
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

/** How long (ms) to cache the ETH price before re-fetching. */
const PRICE_CACHE_TTL = 60_000;

// ---------------------------------------------------------------------------
// ETH price helpers
// ---------------------------------------------------------------------------

let _cachedPrice: number | null = null;
let _cachedAt = 0;

async function fetchEthPrice(): Promise<number | null> {
  const now = Date.now();
  if (_cachedPrice !== null && now - _cachedAt < PRICE_CACHE_TTL) {
    return _cachedPrice;
  }
  try {
    const res = await fetch(COINGECKO_URL, { cache: 'no-store' });
    if (!res.ok) return _cachedPrice;
    const json = await res.json();
    const price = json?.ethereum?.usd;
    if (typeof price === 'number' && price > 0) {
      _cachedPrice = price;
      _cachedAt = now;
      return price;
    }
  } catch {
    // Network failure — return last cached value if any
  }
  return _cachedPrice;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatUSD(usd: number): string {
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convert wei (bigint) to a floating-point ETH number. */
function weiToEth(wei: bigint): number {
  // Divide via string to avoid precision loss from Number(bigint)
  const whole = Number(wei / 10n ** 18n);
  const remainder = Number(wei % 10n ** 18n) / 1e18;
  return whole + remainder;
}

// ---------------------------------------------------------------------------
// FeesDistributed ABI entry (for getLogs event filter)
// ---------------------------------------------------------------------------

const FEES_DISTRIBUTED_ABI_EVENT = {
  type: 'event',
  name: 'FeesDistributed',
  inputs: [
    { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
  ],
  anonymous: false,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TotalDistributed() {
  const publicClient = usePublicClient();

  const [totalWei, setTotalWei] = useState<bigint | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track whether the initial historical fetch completed so the real-time
  // watcher knows it can safely add to the accumulated total.
  const historicalDoneRef = useRef(false);
  // Buffer incoming live events that arrive before the historical fetch finishes.
  const liveBufferRef = useRef<bigint[]>([]);

  // ------------------------------------------------------------------
  // 1. Fetch ETH price on mount + refresh every 60 s
  // ------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadPrice() {
      const price = await fetchEthPrice();
      if (!cancelled) setEthPrice(price);
    }

    loadPrice();

    const interval = setInterval(loadPrice, PRICE_CACHE_TTL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ------------------------------------------------------------------
  // 2. Historical log fetch — sum ALL FeesDistributed amounts
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    async function fetchHistorical() {
      try {
        setIsLoading(true);
        const currentBlock = await publicClient!.getBlockNumber();

        // getLogs supports large ranges but some providers limit to ~10k blocks
        // per call. We chunk in 200k-block slices to be safe against RPC limits.
        const CHUNK = 200_000n;
        let from = DEPLOY_BLOCK;
        let accumulated = 0n;

        while (from <= currentBlock) {
          if (cancelled) return;

          const to = from + CHUNK - 1n < currentBlock ? from + CHUNK - 1n : currentBlock;

          const logs = await publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: FEES_DISTRIBUTED_ABI_EVENT,
            fromBlock: from,
            toBlock: to,
          });

          for (const log of logs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const amount = (log as any).args?.amount as bigint | undefined;
            if (typeof amount === 'bigint') {
              accumulated += amount;
            }
          }

          from = to + 1n;
        }

        if (cancelled) return;

        // Apply any buffered live events that arrived during the fetch
        const buffered = liveBufferRef.current;
        liveBufferRef.current = [];
        for (const amt of buffered) {
          accumulated += amt;
        }

        historicalDoneRef.current = true;
        setTotalWei(accumulated);
      } catch (err) {
        console.warn('[TotalDistributed] Failed to fetch historical logs:', err);
        // Mark done so live events still work
        historicalDoneRef.current = true;
        setTotalWei(liveBufferRef.current.reduce((a, b) => a + b, 0n));
        liveBufferRef.current = [];
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchHistorical();
    return () => { cancelled = true; };
  }, [publicClient]);

  // ------------------------------------------------------------------
  // 3. Real-time watcher — add new FeesDistributed amounts
  // ------------------------------------------------------------------

  const handleNewLogs = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logs: any[]) => {
      for (const log of logs) {
        const amount = log?.args?.amount as bigint | undefined;
        if (typeof amount !== 'bigint') continue;

        if (historicalDoneRef.current) {
          // Safe to update state directly
          setTotalWei((prev) => (prev ?? 0n) + amount);
        } else {
          // Buffer until historical fetch resolves
          liveBufferRef.current.push(amount);
        }
      }
    },
    []
  );

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'FeesDistributed',
    onLogs: handleNewLogs,
  });

  // ------------------------------------------------------------------
  // Derived display values
  // ------------------------------------------------------------------

  const ethAmount = totalWei !== null ? weiToEth(totalWei) : null;
  const usdAmount =
    ethAmount !== null && ethPrice !== null ? ethAmount * ethPrice : null;

  // Formatted ETH label — reuse the project's formatETH for consistency but
  // we need more precision here so we format directly.
  function formatEthDisplay(val: number): string {
    if (val === 0) return '0.0000';
    if (val < 0.0001) return '< 0.0001';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      role="status"
      aria-label="Total ETH distributed to seat holders"
      className="mx-4 mb-3 sm:mx-6"
    >
      <div
        className="relative overflow-hidden rounded-lg border px-4 py-3 font-mono"
        style={{
          background: 'linear-gradient(135deg, rgba(0,255,136,0.06) 0%, rgba(0,255,255,0.04) 100%), rgba(10,10,26,0.9)',
          borderColor: 'rgba(0,255,136,0.25)',
          boxShadow: '0 0 24px rgba(0,255,136,0.08), inset 0 0 40px rgba(0,255,136,0.03)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Subtle corner accent lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-px w-16"
          style={{ background: 'linear-gradient(90deg, #00ff88 0%, transparent 100%)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-px w-16"
          style={{ background: 'linear-gradient(270deg, #00ffff 0%, transparent 100%)' }}
        />

        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          {/* Label */}
          <span
            className="shrink-0 text-xs font-bold uppercase tracking-widest"
            style={{ color: '#00ffff', letterSpacing: '0.14em' }}
          >
            Total ETH Distributed to Seats:
          </span>

          {/* ETH amount */}
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: isLoading ? 'rgba(0,255,136,0.4)' : '#00ff88',
              textShadow: isLoading ? 'none' : '0 0 12px rgba(0,255,136,0.55)',
              transition: 'color 0.3s ease, text-shadow 0.3s ease',
            }}
          >
            {isLoading
              ? '...'
              : `${formatEthDisplay(ethAmount ?? 0)} ETH`}
          </span>

          {/* USD equivalent */}
          {!isLoading && usdAmount !== null && (
            <span
              className="text-xs tabular-nums"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              (~{formatUSD(usdAmount)})
            </span>
          )}

          {/* Live indicator dot */}
          <span
            aria-hidden="true"
            className="hidden sm:inline-flex ml-auto shrink-0 items-center gap-1.5"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: '#00ff88',
                boxShadow: '0 0 6px 2px rgba(0,255,136,0.7)',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: 'rgba(0,255,136,0.45)', letterSpacing: '0.1em' }}
            >
              Live
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
