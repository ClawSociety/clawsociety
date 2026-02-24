'use client';

import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

export function useSeatAction() {
  const {
    writeContractAsync: writeApprove,
    isPending: isApprovePending,
  } = useWriteContract();

  const {
    data: hash,
    writeContractAsync: writeAction,
    isPending: isActionPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const isPending = isApprovePending || isActionPending;

  const approveUSDC = useCallback(
    async (amount: bigint) => {
      await writeApprove({
        address: USDC_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amount],
      });
    },
    [writeApprove]
  );

  const claimSeat = useCallback(
    async (seatId: bigint, price: bigint, depositAmount: bigint) => {
      reset();
      await approveUSDC(depositAmount);
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'claimSeat',
        args: [seatId, price, depositAmount],
      });
    },
    [approveUSDC, writeAction, reset]
  );

  const buyoutSeat = useCallback(
    async (seatId: bigint, newPrice: bigint, maxPrice: bigint, payment: bigint) => {
      reset();
      await approveUSDC(payment);
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'buyoutSeat',
        args: [seatId, newPrice, maxPrice, payment],
      });
    },
    [approveUSDC, writeAction, reset]
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
      await approveUSDC(amount);
      await writeAction({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'addDeposit',
        args: [seatId, amount],
      });
    },
    [approveUSDC, writeAction, reset]
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
