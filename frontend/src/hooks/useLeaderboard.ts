'use client';

import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';
import { ZERO_ADDRESS } from '@/lib/utils';
import type { Seat } from '@/lib/types';

export interface HolderStats {
  holder: string;
  seatCount: number;
  totalPrice: bigint;
  totalDeposit: bigint;
  pendingFees: bigint;
  seatIds: number[];
}

export function useLeaderboard(seats: Seat[]) {
  // Find all occupied seat indices
  const occupiedSeatIds = useMemo(
    () =>
      seats
        .map((s, i) => ({ seat: s, index: i }))
        .filter(({ seat }) => seat.holder !== ZERO_ADDRESS)
        .map(({ index }) => index),
    [seats]
  );

  // Batch pendingFees() calls for all occupied seats
  const contracts = useMemo(
    () =>
      occupiedSeatIds.map((id) => ({
        address: CONTRACT_ADDRESS,
        abi: MANAGER_ABI,
        functionName: 'pendingFees' as const,
        args: [BigInt(id)] as const,
      })),
    [occupiedSeatIds]
  );

  const { data: feeResults } = useReadContracts({
    contracts,
    query: {
      enabled: occupiedSeatIds.length > 0,
      refetchInterval: 60_000,
    },
  });

  // Build fee map: seatIndex -> pendingFees
  const feeMap = useMemo(() => {
    const map = new Map<number, bigint>();
    if (!feeResults) return map;
    occupiedSeatIds.forEach((seatId, i) => {
      const result = feeResults[i];
      if (result?.status === 'success' && result.result != null) {
        map.set(seatId, BigInt(result.result as bigint));
      }
    });
    return map;
  }, [feeResults, occupiedSeatIds]);

  // Aggregate by holder
  const holders = useMemo(() => {
    const holderMap = new Map<string, HolderStats>();

    seats.forEach((seat, index) => {
      if (seat.holder === ZERO_ADDRESS) return;
      const key = seat.holder.toLowerCase();
      const existing = holderMap.get(key);
      const fees = feeMap.get(index) ?? 0n;

      if (existing) {
        existing.seatCount += 1;
        existing.totalPrice += seat.price;
        existing.totalDeposit += seat.deposit;
        existing.pendingFees += fees;
        existing.seatIds.push(index);
      } else {
        holderMap.set(key, {
          holder: seat.holder,
          seatCount: 1,
          totalPrice: seat.price,
          totalDeposit: seat.deposit,
          pendingFees: fees,
          seatIds: [index],
        });
      }
    });

    return Array.from(holderMap.values());
  }, [seats, feeMap]);

  // Pre-sorted arrays
  const byFees = useMemo(
    () => [...holders].sort((a, b) => (b.pendingFees > a.pendingFees ? 1 : b.pendingFees < a.pendingFees ? -1 : 0)).slice(0, 5),
    [holders]
  );

  const byPrice = useMemo(
    () => [...holders].sort((a, b) => (b.totalPrice > a.totalPrice ? 1 : b.totalPrice < a.totalPrice ? -1 : 0)).slice(0, 5),
    [holders]
  );

  return { byFees, byPrice };
}
