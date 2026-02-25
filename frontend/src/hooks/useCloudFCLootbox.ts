'use client';

import { useMemo, useCallback } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {
  CLOUDFC_LOOTBOX_ADDRESS,
  LOOTBOX_ABI,
} from '@/lib/cloudfc-contract';
import { ZERO_ADDRESS } from '@/lib/utils';

const LOOTBOX_ENABLED = CLOUDFC_LOOTBOX_ADDRESS !== ZERO_ADDRESS;

export function useLootbox(address?: string) {
  // ─── Read: pack price ───
  const { data: packPriceRaw } = useReadContract({
    address: CLOUDFC_LOOTBOX_ADDRESS,
    abi: LOOTBOX_ABI,
    functionName: 'packPrice',
    query: { enabled: LOOTBOX_ENABLED, refetchInterval: 60_000 },
  });

  const packPrice = BigInt(packPriceRaw ?? 0);

  // ─── Read: total packs ───
  const { data: totalPacksRaw, refetch: refetchTotal } = useReadContract({
    address: CLOUDFC_LOOTBOX_ADDRESS,
    abi: LOOTBOX_ABI,
    functionName: 'totalPacks',
    query: { enabled: LOOTBOX_ENABLED, refetchInterval: 15_000 },
  });

  const totalPacks = Number(totalPacksRaw ?? 0);

  // ─── Read: user's recent pack records (last 5) ───
  const packRecordContracts = useMemo(() => {
    if (!totalPacks || !LOOTBOX_ENABLED) return [];
    const start = Math.max(0, totalPacks - 10);
    return Array.from({ length: Math.min(totalPacks, 10) }, (_, i) => ({
      address: CLOUDFC_LOOTBOX_ADDRESS,
      abi: LOOTBOX_ABI,
      functionName: 'getPackRecord' as const,
      args: [BigInt(start + i)] as const,
    }));
  }, [totalPacks]);

  const { data: packRecordsRaw } = useReadContracts({
    contracts: packRecordContracts,
    query: { enabled: packRecordContracts.length > 0, refetchInterval: 15_000 },
  });

  const userPacks = useMemo(() => {
    if (!packRecordsRaw || !address) return [];
    return packRecordsRaw
      .filter(r => r?.status === 'success')
      .map(r => {
        const d = r.result as { buyer: string; playerIds: readonly bigint[]; timestamp: bigint };
        return {
          buyer: d.buyer,
          playerIds: d.playerIds.map(id => Number(id)),
          timestamp: Number(d.timestamp),
        };
      })
      .filter(p => p.buyer.toLowerCase() === address.toLowerCase())
      .reverse();
  }, [packRecordsRaw, address]);

  // ─── Write: openPack ───
  const { data: hash, writeContractAsync, isPending, reset } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const openPack = useCallback(async () => {
    reset();
    await writeContractAsync({
      address: CLOUDFC_LOOTBOX_ADDRESS,
      abi: LOOTBOX_ABI,
      functionName: 'openPack',
      value: packPrice,
    });
  }, [writeContractAsync, reset, packPrice]);

  return {
    packPrice,
    totalPacks,
    userPacks,
    openPack,
    isPending,
    isSuccess,
    txHash: hash,
    refetch: refetchTotal,
  };
}
