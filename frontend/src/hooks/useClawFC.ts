'use client';

import { useMemo, useCallback } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { FC_ADDRESS, FC_ABI } from '@/lib/fc-contract';
import { ZERO_ADDRESS } from '@/lib/utils';
import { parseEther } from 'viem';

// ─────────────────────── Types ────────────────────────────────

export interface FCMatch {
  id: number;
  home: string;
  away: string;
  homeSeatIds: number[];
  awaySeatIds: number[];
  stake: bigint;
  seed: bigint;
  homeGoals: number;
  awayGoals: number;
  status: number; // 0=open, 1=resolved, 2=cancelled
  createdAt: number;
}

export interface FCRecord {
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  matchesPlayed: number;
}

const ENABLED = FC_ADDRESS !== ZERO_ADDRESS;

// ─────────────────────── Match List ───────────────────────────

export function useFCMatches() {
  const { data: totalRaw, refetch: refetchTotal } = useReadContract({
    address: FC_ADDRESS,
    abi: FC_ABI,
    functionName: 'totalMatches',
    query: { enabled: ENABLED, refetchInterval: 15_000 },
  });

  const total = Number(totalRaw ?? 0);
  const from = Math.max(0, total - 20);

  // Fetch last 20 matches individually
  const contracts = useMemo(
    () =>
      Array.from({ length: Math.min(total, 20) }, (_, i) => ({
        address: FC_ADDRESS,
        abi: FC_ABI,
        functionName: 'getMatch' as const,
        args: [BigInt(from + i)] as const,
      })),
    [total, from]
  );

  const { data: rawMatches, refetch } = useReadContracts({
    contracts,
    query: { enabled: total > 0 && ENABLED, refetchInterval: 15_000 },
  });

  const matches = useMemo((): FCMatch[] => {
    if (!rawMatches) return [];
    return rawMatches
      .map((r, i) => {
        if (r?.status !== 'success' || !r.result) return null;
        const d = r.result as unknown as [
          string, string,
          readonly bigint[], readonly bigint[],
          bigint, bigint,
          number, number, number, bigint,
        ];
        return {
          id: from + i,
          home: d[0],
          away: d[1],
          homeSeatIds: (d[2] as readonly bigint[]).map(Number),
          awaySeatIds: (d[3] as readonly bigint[]).map(Number),
          stake: BigInt(d[4]),
          seed: BigInt(d[5]),
          homeGoals: Number(d[6]),
          awayGoals: Number(d[7]),
          status: Number(d[8]),
          createdAt: Number(d[9]),
        };
      })
      .filter((m): m is FCMatch => m !== null)
      .reverse();
  }, [rawMatches, from]);

  const openMatches = useMemo(() => matches.filter((m) => m.status === 0), [matches]);
  const resolvedMatches = useMemo(() => matches.filter((m) => m.status === 1), [matches]);

  return {
    matches,
    openMatches,
    resolvedMatches,
    total,
    refetch: () => { refetchTotal(); refetch(); },
  };
}

// ─────────────────────── Player Record ────────────────────────

export function useFCRecord(address?: string) {
  const { data } = useReadContract({
    address: FC_ADDRESS,
    abi: FC_ABI,
    functionName: 'getRecord',
    args: [(address ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!address && ENABLED, refetchInterval: 30_000 },
  });

  return useMemo((): FCRecord => {
    if (!data) return { wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0 };
    const d = data as [number, number, number, number, number, number];
    return {
      wins: Number(d[0]),
      losses: Number(d[1]),
      draws: Number(d[2]),
      goalsFor: Number(d[3]),
      goalsAgainst: Number(d[4]),
      matchesPlayed: Number(d[5]),
    };
  }, [data]);
}

// ─────────────────────── Write Actions ────────────────────────

export function useFCActions() {
  const { data: hash, writeContractAsync, isPending, reset } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const createMatch = useCallback(
    async (seatIds: bigint[], stakeEth: string) => {
      reset();
      // Pad to 5 slots with EMPTY_SLOT (100)
      const padded: bigint[] = [...seatIds];
      while (padded.length < 5) padded.push(100n);
      const stake = stakeEth ? parseEther(stakeEth) : 0n;

      await writeContractAsync({
        address: FC_ADDRESS,
        abi: FC_ABI,
        functionName: 'createMatch',
        args: [padded as unknown as readonly [bigint, bigint, bigint, bigint, bigint]],
        value: stake,
      });
    },
    [writeContractAsync, reset]
  );

  const acceptMatch = useCallback(
    async (matchId: bigint, seatIds: bigint[], stake: bigint) => {
      reset();
      const padded: bigint[] = [...seatIds];
      while (padded.length < 5) padded.push(100n);

      await writeContractAsync({
        address: FC_ADDRESS,
        abi: FC_ABI,
        functionName: 'acceptMatch',
        args: [matchId, padded as unknown as readonly [bigint, bigint, bigint, bigint, bigint]],
        value: stake,
      });
    },
    [writeContractAsync, reset]
  );

  const cancelMatch = useCallback(
    async (matchId: bigint) => {
      reset();
      await writeContractAsync({
        address: FC_ADDRESS,
        abi: FC_ABI,
        functionName: 'cancelMatch',
        args: [matchId],
      });
    },
    [writeContractAsync, reset]
  );

  return { createMatch, acceptMatch, cancelMatch, isPending, isSuccess };
}
