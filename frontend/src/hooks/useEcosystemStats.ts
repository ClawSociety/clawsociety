'use client';

import { useMemo } from 'react';
import { useGridState } from '@/hooks/useGridState';
import { useCloudFCMatches } from '@/hooks/useCloudFC';
import { ZERO_ADDRESS } from '@/lib/utils';

export interface EcosystemStats {
  seatsClaimed: number;
  totalSeats: number;
  uniqueHolders: number;
  totalMatches: number;
  totalGridValue: bigint;
  totalGridDeposits: bigint;
}

export function useEcosystemStats(): EcosystemStats {
  const { seats } = useGridState();
  const { total: totalMatches } = useCloudFCMatches();

  return useMemo(() => {
    const occupied = seats.filter((s) => s.holder !== ZERO_ADDRESS);
    const holders = new Set(occupied.map((s) => s.holder.toLowerCase()));
    const totalGridValue = occupied.reduce((acc, s) => acc + s.price, 0n);
    const totalGridDeposits = occupied.reduce((acc, s) => acc + s.deposit, 0n);

    return {
      seatsClaimed: occupied.length,
      totalSeats: seats.length,
      uniqueHolders: holders.size,
      totalMatches,
      totalGridValue,
      totalGridDeposits,
    };
  }, [seats, totalMatches]);
}
