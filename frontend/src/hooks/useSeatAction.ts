'use client';

import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

export function useSeatAction() {
  const {
    data: hash,
    writeContractAsync: writeAction,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimSeat = useCallback(
    async (seatId: bigint, price: bigint, depositAmount: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'claimSeat',
        args: [seatId, price],
        value: depositAmount,
      });
    },
    [writeAction, reset]
  );

  const buyoutSeat = useCallback(
    async (seatId: bigint, newPrice: bigint, maxPrice: bigint, payment: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'buyoutSeat',
        args: [seatId, newPrice, maxPrice],
        value: payment,
      });
    },
    [writeAction, reset]
  );

  const setPrice = useCallback(
    async (seatId: bigint, newPrice: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'setPrice',
        args: [seatId, newPrice],
      });
    },
    [writeAction, reset]
  );

  const addDeposit = useCallback(
    async (seatId: bigint, amount: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'addDeposit',
        args: [seatId],
        value: amount,
      });
    },
    [writeAction, reset]
  );

  const withdrawDeposit = useCallback(
    async (seatId: bigint, amount: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'withdrawDeposit',
        args: [seatId, amount],
      });
    },
    [writeAction, reset]
  );

  const abandonSeat = useCallback(
    async (seatId: bigint) => {
      reset();
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'abandonSeat',
        args: [seatId],
      });
    },
    [writeAction, reset]
  );

  return {
    claimSeat,
    buyoutSeat,
    setPrice,
    addDeposit,
    withdrawDeposit,
    abandonSeat,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}
