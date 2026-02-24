'use client';

/**
 * Claw Society — main page
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ServerFundBar (full width)                           │
 *   │ Header row: CLAW SOCIETY title · ConnectButton       │
 *   │ Subtitle                                             │
 *   ├──────────────────────┬───────────────────────────────┤
 *   │ Grid (~65%)          │ Sidebar (~35%)                │
 *   └──────────────────────┴───────────────────────────────┘
 *
 * Mobile: Grid stacked above Sidebar, full width.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Grid } from '@/components/grid/Grid';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { ServerFundBar } from '@/components/ui/ServerFundBar';
import { ConnectButton } from '@/components/ui/ConnectButton';
import { useGridState } from '@/hooks/useGridState';
import { useSeatAction } from '@/hooks/useSeatAction';
import { useClaimFees } from '@/hooks/useClaimFees';
import { parseUSDC, ZERO_ADDRESS } from '@/lib/utils';
import Image from 'next/image';

// ---------------------------------------------------------------------------
// Transaction status toast
// ---------------------------------------------------------------------------

type TxStatus = 'idle' | 'approving' | 'pending' | 'confirming' | 'success' | 'error';

interface StatusToastProps {
  status: TxStatus;
  errorMessage?: string;
  onDismiss: () => void;
}

function StatusToast({ status, errorMessage, onDismiss }: StatusToastProps) {
  if (status === 'idle') return null;

  const config: Record<TxStatus, { label: string; color: string; bg: string; border: string }> = {
    idle:       { label: '',                          color: '#fff',     bg: '#1a1a2e', border: '#ffffff22' },
    approving:  { label: 'Approving USDC...',         color: '#00ffff', bg: '#0d1a2e', border: '#00ffff33' },
    pending:    { label: 'Transaction sent...',       color: '#ffd700', bg: '#1a1500', border: '#ffd70033' },
    confirming: { label: 'Confirming on-chain...',    color: '#ff8855', bg: '#1a0d00', border: '#ff885533' },
    success:    { label: 'Transaction confirmed!',    color: '#00ff88', bg: '#001a0d', border: '#00ff8844' },
    error:      { label: errorMessage ?? 'Transaction failed.', color: '#ff4455', bg: '#1a0005', border: '#ff445533' },
  };

  const c = config[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 font-mono text-xs font-bold shadow-lg"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        maxWidth: '320px',
        boxShadow: `0 0 20px ${c.border}`,
      }}
    >
      {/* Spinner for in-progress states */}
      {(status === 'approving' || status === 'pending' || status === 'confirming') && (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2"
          style={{ borderColor: `${c.color}44`, borderTopColor: c.color }}
        />
      )}

      <span className="flex-1 leading-snug">{c.label}</span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-2 shrink-0 opacity-50 transition-opacity hover:opacity-100"
        style={{ color: c.color, fontSize: '1rem', lineHeight: 1 }}
      >
        x
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState<string | undefined>();

  const { address } = useAccount();
  const { seats, refetch } = useGridState();

  // Collect seat IDs owned by the connected user for fee tracking
  const myOwnedSeatIds: bigint[] = seats
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s }) =>
        address &&
        s.holder !== ZERO_ADDRESS &&
        s.holder.toLowerCase() === address.toLowerCase()
    )
    .map(({ i }) => BigInt(i));

  const {
    claimSeat,
    buyoutSeat,
    setPrice,
    addDeposit,
    withdrawDeposit,
    abandonSeat,
    isPending,
    isConfirming,
    isSuccess,
    error: seatActionError,
  } = useSeatAction();

  const { claimFees, totalPending } = useClaimFees(myOwnedSeatIds);

  // ------------------------------------------------------------------
  // Sync transaction state to toast status
  // ------------------------------------------------------------------

  useEffect(() => {
    if (seatActionError) {
      const msg =
        seatActionError instanceof Error
          ? seatActionError.message.slice(0, 140)
          : 'Transaction rejected.';
      setTxError(msg);
      setTxStatus('error');
    }
  }, [seatActionError]);

  useEffect(() => {
    if (isPending) setTxStatus('pending');
  }, [isPending]);

  useEffect(() => {
    if (isConfirming) setTxStatus('confirming');
  }, [isConfirming]);

  useEffect(() => {
    if (isSuccess) {
      setTxStatus('success');
      refetch();
      // Auto-dismiss after 4 s
      const timer = setTimeout(() => setTxStatus('idle'), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, refetch]);

  // ------------------------------------------------------------------
  // Action handler: maps Sidebar action strings to useSeatAction calls
  //
  // Action strings come from TileDetails:
  //   'claim'           { price, deposit }
  //   'buyout'          { price, deposit }
  //   'setPrice'        { price }
  //   'addDeposit'      { amount }
  //   'withdrawDeposit' { amount }
  //   'abandon'         {}
  //   'claimFees'       {}
  // ------------------------------------------------------------------

  const handleAction = useCallback(
    async (action: string, params: Record<string, string>) => {
      if (selectedSeat === null) return;

      const id = BigInt(selectedSeat);
      // Helper: parse a human-readable USDC dollar string to bigint (6 decimals)
      const toUSDC = (v: string) => parseUSDC(v || '0');

      try {
        setTxError(undefined);
        setTxStatus('approving');

        switch (action) {
          case 'claim': {
            const price = toUSDC(params.price ?? '0');
            const deposit = toUSDC(params.deposit ?? '0');
            await claimSeat(id, price, deposit);
            break;
          }

          case 'buyout': {
            const currentSeat = seats[selectedSeat];
            if (!currentSeat) break;
            const newPrice = toUSDC(params.price ?? '0');
            const deposit = toUSDC(params.deposit ?? '0');
            // maxPrice = current listing price acts as a slippage guard
            const maxPrice = currentSeat.price;
            // payment must cover the buyout price plus the buyer's new deposit
            const payment = currentSeat.price + deposit;
            await buyoutSeat(id, newPrice, maxPrice, payment);
            break;
          }

          case 'setPrice': {
            const price = toUSDC(params.price ?? '0');
            await setPrice(id, price);
            break;
          }

          case 'addDeposit': {
            const amount = toUSDC(params.amount ?? '0');
            await addDeposit(id, amount);
            break;
          }

          case 'withdrawDeposit': {
            const amount = toUSDC(params.amount ?? '0');
            await withdrawDeposit(id, amount);
            break;
          }

          case 'abandon': {
            await abandonSeat(id);
            break;
          }

          case 'claimFees': {
            if (myOwnedSeatIds.length > 0) {
              await claimFees(myOwnedSeatIds);
            }
            break;
          }

          default:
            console.warn('[ClawSociety] Unknown action:', action);
            setTxStatus('idle');
            return;
        }
      } catch (err) {
        // User-rejected wallet prompts should silently dismiss the toast
        if (err instanceof Error && err.message.toLowerCase().includes('user rejected')) {
          setTxStatus('idle');
        }
        // Other errors are surfaced via the seatActionError effect above
      }
    },
    [
      selectedSeat,
      seats,
      claimSeat,
      buyoutSeat,
      setPrice,
      addDeposit,
      withdrawDeposit,
      abandonSeat,
      claimFees,
      myOwnedSeatIds,
    ]
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      className="grid-bg flex min-h-screen flex-col"
      style={{ background: '#0a0a0a' }}
    >
      {/* Server fund progress bar — pinned to the very top */}
      <ServerFundBar />

      {/* Header row */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo.png"
            alt="Claw Society logo"
            width={40}
            height={40}
            className="shrink-0"
            priority
          />
          <div className="min-w-0">
          <h1
            className="neon-text-flicker font-mono font-extrabold uppercase"
            style={{
              color: '#00ff88',
              fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
              letterSpacing: '0.2em',
            }}
          >
            CLAW SOCIETY
          </h1>
          <p
            className="mt-0.5 font-mono"
            style={{
              fontSize: 'clamp(0.6rem, 1.5vw, 0.75rem)',
              color: 'rgba(160,160,200,0.6)',
              letterSpacing: '0.05em',
            }}
          >
            100 seats.&nbsp; Harberger-taxed.&nbsp; ETH from every trade.
          </p>
          </div>
        </div>

        <div className="ml-4 shrink-0">
          <ConnectButton />
        </div>
      </header>

      {/* Unclaimed fees banner — only shown when connected user has pending fees */}
      {address && totalPending > 0n && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs sm:mx-6"
          style={{
            background: 'rgba(0,255,136,0.06)',
            borderColor: 'rgba(0,255,136,0.25)',
            color: '#00ff88',
          }}
        >
          <span
            aria-hidden="true"
            style={{ fontSize: '0.75rem' }}
          >
            [!]
          </span>
          <span>
            You have unclaimed ETH fees. Select one of your seats to claim.
          </span>
        </div>
      )}

      {/* Body: Grid + Sidebar */}
      <main
        className="flex flex-1 flex-col gap-4 px-4 pb-8 sm:px-6 lg:flex-row lg:items-start lg:gap-6"
        style={{ minHeight: 0 }}
      >
        {/* Grid — ~65% on large screens */}
        <section
          aria-label="City grid"
          className="w-full lg:w-[65%]"
          style={{ minWidth: 0 }}
        >
          <Grid
            selectedSeat={selectedSeat}
            onSelectSeat={setSelectedSeat}
          />
        </section>

        {/* Sidebar — ~35% on large screens */}
        <section
          aria-label="Seat details and city stats"
          className="w-full lg:w-[35%]"
          style={{ minWidth: 0 }}
        >
          <Sidebar
            selectedSeat={selectedSeat}
            seats={seats}
            onAction={handleAction}
          />
        </section>
      </main>

      {/* Transaction status toast */}
      <StatusToast
        status={txStatus}
        errorMessage={txError}
        onDismiss={() => setTxStatus('idle')}
      />
    </div>
  );
}
