'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Grid } from '@/components/grid/Grid';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { HowItWorks } from '@/components/ui/HowItWorks';
import { TotalDistributed } from '@/components/ui/TotalDistributed';
import { StatusToast } from '@/components/ui/StatusToast';
import { TokenAddress, SOCIETY_TOKEN } from '@/components/ui/TokenAddress';
import { useGridState } from '@/hooks/useGridState';
import { useSeatAction } from '@/hooks/useSeatAction';
import { useClaimFees } from '@/hooks/useClaimFees';
import { useTransactionToast, createActionHandler } from '@/hooks/useTransactionToast';
import { ZERO_ADDRESS } from '@/lib/utils';

export default function SocietyPage() {
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const { address } = useAccount();
  const { seats, isLoading, refetch } = useGridState();

  const myOwnedSeatIds: bigint[] = useMemo(
    () =>
      seats
        .map((s, i) => ({ s, i }))
        .filter(
          ({ s }) =>
            address &&
            s.holder !== ZERO_ADDRESS &&
            s.holder.toLowerCase() === address.toLowerCase()
        )
        .map(({ i }) => BigInt(i)),
    [seats, address]
  );

  const {
    claimSeat, buyoutSeat, setPrice, addDeposit,
    withdrawDeposit, abandonSeat, isPending, isConfirming, isSuccess,
    error: seatActionError,
  } = useSeatAction();

  const { claimFees, totalPending } = useClaimFees(myOwnedSeatIds);

  const { txStatus, txError, resetTx, dismissToast, setIdle } = useTransactionToast({
    isPending,
    isConfirming,
    isSuccess,
    error: seatActionError,
    refetch,
  });

  const handleAction = useCallback(
    createActionHandler({
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
      resetTx,
      setIdle,
    }),
    [
      selectedSeat, seats, claimSeat, buyoutSeat, setPrice,
      addDeposit, withdrawDeposit, abandonSeat, claimFees,
      myOwnedSeatIds, resetTx, setIdle,
    ]
  );

  return (
    <>
      {/* Unclaimed fees banner */}
      {address && totalPending > 0n && (
        <div
          role="alert"
          className="mx-4 mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 font-mono text-xs sm:items-center sm:mx-6"
          style={{
            background: 'rgba(0,255,136,0.06)',
            borderColor: 'rgba(0,255,136,0.25)',
            color: '#00ff88',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>[!]</span>
          <span>You have unclaimed ETH fees. Select one of your seats to claim.</span>
        </div>
      )}

      <TotalDistributed />

      {/* Body: Grid + Sidebar */}
      <main
        className="flex flex-1 flex-col gap-4 px-4 pb-4 sm:px-6 lg:flex-row lg:items-start lg:gap-6"
        style={{ minHeight: 0 }}
      >
        <section
          aria-label="City grid"
          className="w-full lg:w-[65%]"
          style={{ minWidth: 0, overflow: 'hidden' }}
        >
          <Grid
            selectedSeat={selectedSeat}
            onSelectSeat={setSelectedSeat}
            seats={seats}
            isLoading={isLoading}
          />
        </section>

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

      {/* DexScreener Chart + Token Address */}
      <div className="px-4 pb-4 sm:px-6">
        <div className="rounded-lg border border-white/10 bg-[#0d0d1a] p-4">
          <h3
            className="mb-3 font-mono text-xs font-bold uppercase tracking-widest"
            style={{ color: '#00ffff' }}
          >
            $SOCIETY Chart
          </h3>
          <div
            className="overflow-hidden rounded-lg"
            style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}
          >
            <iframe
              src={`https://dexscreener.com/base/${SOCIETY_TOKEN}?embed=1&theme=dark&info=0`}
              title="$SOCIETY DexScreener Chart"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="clipboard-write"
            />
          </div>
          <TokenAddress />
        </div>
      </div>

      {/* How It Works */}
      <div className="px-4 pb-4 sm:px-6">
        <HowItWorks />
      </div>

      <StatusToast
        status={txStatus}
        errorMessage={txError}
        onDismiss={dismissToast}
      />
    </>
  );
}
