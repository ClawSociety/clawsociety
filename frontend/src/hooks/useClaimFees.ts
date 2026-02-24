'use client';

import { useCallback, useMemo } from 'react';
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

export function useClaimFees(seatIds: bigint[]) {
  const contracts = useMemo(
    () =>
      seatIds.map((seatId) => ({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'pendingFees' as const,
        args: [seatId] as const,
      })),
    [seatIds]
  );

  const { data: feeResults } = useReadContracts({
    contracts,
    query: {
      enabled: seatIds.length > 0,
      refetchInterval: 15_000,
    },
  });

  const totalPending = useMemo(() => {
    if (!feeResults) return 0n;
    return feeResults.reduce((sum, result) => {
      if (result.status === 'success' && result.result != null) {
        return sum + BigInt(result.result as bigint);
      }
      return sum;
    }, 0n);
  }, [feeResults]);

  const {
    data: hash,
    writeContractAsync,
    isPending,
    reset,
  } = useWriteContract();

  const { isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimFees = useCallback(
    async (ids: bigint[]) => {
      reset();
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'claimFees',
        args: [ids],
      });
    },
    [writeContractAsync, reset]
  );

  return {
    claimFees,
    totalPending,
    isPending,
    isSuccess,
  };
}
