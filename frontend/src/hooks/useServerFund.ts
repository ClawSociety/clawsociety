'use client';

import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

const GOAL = 10n * 10n ** 18n;

export function useServerFund() {
  const { data } = useReadContracts({
    contracts: [
      {
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'serverFundBalance',
      },
      {
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'societyAutonomous',
      },
    ],
    query: {
      refetchInterval: 30_000,
    },
  });

  const balance = useMemo(() => {
    if (!data || data[0].status !== 'success') return 0n;
    return BigInt(data[0].result as bigint);
  }, [data]);

  const isAutonomous = useMemo(() => {
    if (!data || data[1].status !== 'success') return false;
    return data[1].result as boolean;
  }, [data]);

  const progress = useMemo(() => {
    if (GOAL === 0n) return 100;
    const pct = Number((balance * 10000n) / GOAL) / 100;
    return Math.min(pct, 100);
  }, [balance]);

  return {
    balance,
    goal: GOAL,
    isAutonomous,
    progress,
  };
}
