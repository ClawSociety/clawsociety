'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TxStatus } from '@/components/ui/StatusToast';
import { parseETHInput } from '@/lib/utils';
import type { Seat } from '@/lib/types';

interface UseTransactionToastOptions {
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTransactionToast({
  isPending,
  isConfirming,
  isSuccess,
  error,
  refetch,
}: UseTransactionToastOptions) {
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txError, setTxError] = useState<string | undefined>();

  useEffect(() => {
    if (error) {
      const msg =
        error instanceof Error
          ? error.message.slice(0, 140)
          : 'Transaction rejected.';
      setTxError(msg);
      setTxStatus('error');
    }
  }, [error]);

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
      const retryTimer = setTimeout(() => refetch(), 2000);
      const dismissTimer = setTimeout(() => setTxStatus('idle'), 4000);
      return () => {
        clearTimeout(retryTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [isSuccess, refetch]);

  const resetTx = useCallback(() => {
    setTxError(undefined);
    setTxStatus('pending');
  }, []);

  const dismissToast = useCallback(() => {
    setTxStatus('idle');
  }, []);

  const setIdle = useCallback(() => {
    setTxStatus('idle');
  }, []);

  return { txStatus, txError, resetTx, dismissToast, setIdle };
}

/**
 * Maps sidebar action strings to useSeatAction calls.
 */
export function createActionHandler({
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
}: {
  selectedSeat: number | null;
  seats: Seat[];
  claimSeat: (id: bigint, price: bigint, deposit: bigint) => Promise<void>;
  buyoutSeat: (id: bigint, price: bigint, maxPrice: bigint, payment: bigint) => Promise<void>;
  setPrice: (id: bigint, price: bigint) => Promise<void>;
  addDeposit: (id: bigint, amount: bigint) => Promise<void>;
  withdrawDeposit: (id: bigint, amount: bigint) => Promise<void>;
  abandonSeat: (id: bigint) => Promise<void>;
  claimFees: (ids: bigint[]) => Promise<void>;
  myOwnedSeatIds: bigint[];
  resetTx: () => void;
  setIdle: () => void;
}) {
  return async (action: string, params: Record<string, string>) => {
    if (selectedSeat === null) return;

    const id = BigInt(selectedSeat);
    const toETH = (v: string) => parseETHInput(v || '0');

    try {
      resetTx();

      switch (action) {
        case 'claim': {
          const price = toETH(params.price ?? '0');
          const deposit = toETH(params.deposit ?? '0');
          await claimSeat(id, price, deposit);
          break;
        }
        case 'buyout': {
          const currentSeat = seats[selectedSeat];
          if (!currentSeat) break;
          const newPrice = toETH(params.price ?? '0');
          const deposit = toETH(params.deposit ?? '0');
          const maxPrice = currentSeat.price;
          const payment = currentSeat.price + deposit;
          await buyoutSeat(id, newPrice, maxPrice, payment);
          break;
        }
        case 'setPrice': {
          const price = toETH(params.price ?? '0');
          await setPrice(id, price);
          break;
        }
        case 'addDeposit': {
          const amount = toETH(params.amount ?? '0');
          await addDeposit(id, amount);
          break;
        }
        case 'withdrawDeposit': {
          const amount = toETH(params.amount ?? '0');
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
          setIdle();
          return;
      }
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('user rejected')) {
        setIdle();
      }
    }
  };
}
