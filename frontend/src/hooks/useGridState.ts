'use client';

import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';
import type { Seat } from '@/lib/types';

interface RawSeat {
  holder: string;
  price: bigint;
  deposit: bigint;
  lastTaxTime: bigint;
  lastPriceChangeTime: bigint;
  buildingType: number;
}

// Grid layout from GridLayout.sol — building type per seat index
// prettier-ignore
const GRID_LAYOUT: number[] = [
  9,8,6,8,8,8,8,8,9,9,
  9,7,6,7,6,6,7,6,7,9,
  9,8,6,5,6,2,6,5,8,9,
  9,7,6,4,3,3,4,6,7,9,
  8,8,5,3,2,1,2,5,8,8,
  8,8,5,3,1,0,2,5,8,8,
  9,7,6,4,3,3,4,6,7,9,
  9,8,6,5,4,4,6,5,8,9,
  9,7,5,7,4,4,7,5,7,9,
  9,9,9,9,8,8,9,9,9,9,
];

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function buildMockSeats(): Seat[] {
  return GRID_LAYOUT.map((bt) => ({
    holder: ZERO_ADDR,
    price: 0n,
    deposit: 0n,
    lastTaxTime: 0n,
    lastPriceChangeTime: 0n,
    buildingType: bt,
  }));
}

export function useGridState() {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    functionName: 'getAllSeats',
    query: {
      refetchInterval: 10_000,
      // Keep previous data visible while refetching — prevents skeleton flash
      placeholderData: (prev: unknown) => prev,
    },
  });

  const seats: Seat[] = data
    ? (data as readonly RawSeat[]).map((raw) => ({
        holder: raw.holder,
        price: BigInt(raw.price),
        deposit: BigInt(raw.deposit),
        lastTaxTime: BigInt(raw.lastTaxTime),
        lastPriceChangeTime: BigInt(raw.lastPriceChangeTime),
        buildingType: Number(raw.buildingType),
      }))
    : [];

  // Fall back to mock data when contract is unavailable (dev mode / pre-deploy)
  const effectiveSeats = seats.length > 0 ? seats : buildMockSeats();

  return { seats: effectiveSeats, isLoading, refetch };
}
