'use client';

import { useMemo, useCallback } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import {
  CLOUDFC_ADDRESS, CLOUDFC_PLAYERS_ADDRESS,
  CLOUDFC_ABI, PLAYERS_ABI,
  formationToUint8,
} from '@/lib/cloudfc-contract';
import { ZERO_ADDRESS } from '@/lib/utils';
import { parseEther } from 'viem';
import type { CloudFCMatch, CloudFCPlayer, Formation } from '@/lib/fc/types';

// ─────────────────────── Config ───────────────────────────────

const FC_ENABLED = CLOUDFC_ADDRESS !== ZERO_ADDRESS;
const PLAYERS_ENABLED = CLOUDFC_PLAYERS_ADDRESS !== ZERO_ADDRESS;

// ─────────────────────── Record Type ──────────────────────────

export interface CloudFCRecord {
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  matchesPlayed: number;
}

// ─────────────────────── Player List ──────────────────────────

export function useMyPlayers(address?: string) {
  const { data: balanceRaw } = useReadContract({
    address: CLOUDFC_PLAYERS_ADDRESS,
    abi: PLAYERS_ABI,
    functionName: 'balanceOf',
    args: [(address ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!address && PLAYERS_ENABLED, refetchInterval: 30_000 },
  });

  const balance = Number(balanceRaw ?? 0);

  // Fetch token IDs
  const tokenIdContracts = useMemo(
    () => Array.from({ length: Math.min(balance, 50) }, (_, i) => ({
      address: CLOUDFC_PLAYERS_ADDRESS,
      abi: PLAYERS_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [(address ?? ZERO_ADDRESS) as `0x${string}`, BigInt(i)] as const,
    })),
    [balance, address]
  );

  const { data: tokenIdsRaw } = useReadContracts({
    contracts: tokenIdContracts,
    query: { enabled: balance > 0 && PLAYERS_ENABLED, refetchInterval: 30_000 },
  });

  const tokenIds = useMemo(() => {
    if (!tokenIdsRaw) return [];
    return tokenIdsRaw
      .filter(r => r?.status === 'success')
      .map(r => Number(r.result as bigint));
  }, [tokenIdsRaw]);

  // Fetch stats for each token
  const statsContracts = useMemo(
    () => tokenIds.map(id => ({
      address: CLOUDFC_PLAYERS_ADDRESS,
      abi: PLAYERS_ABI,
      functionName: 'getStats' as const,
      args: [BigInt(id)] as const,
    })),
    [tokenIds]
  );

  const lockContracts = useMemo(
    () => tokenIds.map(id => ({
      address: CLOUDFC_PLAYERS_ADDRESS,
      abi: PLAYERS_ABI,
      functionName: 'locked' as const,
      args: [BigInt(id)] as const,
    })),
    [tokenIds]
  );

  const { data: statsRaw } = useReadContracts({
    contracts: statsContracts,
    query: { enabled: tokenIds.length > 0 && PLAYERS_ENABLED, refetchInterval: 30_000 },
  });

  const { data: locksRaw } = useReadContracts({
    contracts: lockContracts,
    query: { enabled: tokenIds.length > 0 && PLAYERS_ENABLED, refetchInterval: 30_000 },
  });

  const players = useMemo((): CloudFCPlayer[] => {
    if (!statsRaw || tokenIds.length === 0) return [];
    return tokenIds.map((id, i) => {
      const s = statsRaw[i];
      const l = locksRaw?.[i];
      if (s?.status !== 'success') return null;
      const d = s.result as [number, number, number, number, number];
      return {
        id,
        owner: address ?? '',
        stats: {
          speed: Number(d[0]),
          passing: Number(d[1]),
          shooting: Number(d[2]),
          defense: Number(d[3]),
          stamina: Number(d[4]),
        },
        locked: l?.status === 'success' ? Boolean(l.result) : false,
      };
    }).filter((p): p is CloudFCPlayer => p !== null);
  }, [statsRaw, locksRaw, tokenIds, address]);

  return { players, balance };
}

// ─────────────────────── Match List ───────────────────────────

export function useCloudFCMatches() {
  const { data: totalRaw, refetch: refetchTotal } = useReadContract({
    address: CLOUDFC_ADDRESS,
    abi: CLOUDFC_ABI,
    functionName: 'totalMatches',
    query: { enabled: FC_ENABLED, refetchInterval: 15_000 },
  });

  const total = Number(totalRaw ?? 0);
  const from = Math.max(0, total - 20);

  const contracts = useMemo(
    () => Array.from({ length: Math.min(total, 20) }, (_, i) => ({
      address: CLOUDFC_ADDRESS,
      abi: CLOUDFC_ABI,
      functionName: 'getMatch' as const,
      args: [BigInt(from + i)] as const,
    })),
    [total, from]
  );

  const { data: rawMatches, refetch } = useReadContracts({
    contracts,
    query: { enabled: total > 0 && FC_ENABLED, refetchInterval: 15_000 },
  });

  const matches = useMemo((): CloudFCMatch[] => {
    if (!rawMatches) return [];
    return rawMatches
      .map((r, i) => {
        if (r?.status !== 'success' || !r.result) return null;
        const d = r.result as unknown as [
          bigint, bigint,  // homeSquadId, awaySquadId
          bigint,          // stake
          bigint,          // seed
          number, number,  // homeGoals, awayGoals
          number,          // status
          bigint,          // createdAt
          bigint,          // totalPool
        ];
        return {
          id: from + i,
          homeSquadId: Number(d[0]),
          awaySquadId: Number(d[1]),
          stake: BigInt(d[2]),
          seed: BigInt(d[3]),
          homeGoals: Number(d[4]),
          awayGoals: Number(d[5]),
          status: Number(d[6]),
          createdAt: Number(d[7]),
          totalPool: BigInt(d[8]),
        };
      })
      .filter((m): m is CloudFCMatch => m !== null)
      .reverse();
  }, [rawMatches, from]);

  const openMatches = useMemo(() => matches.filter(m => m.status === 0), [matches]);
  const resolvedMatches = useMemo(() => matches.filter(m => m.status === 1), [matches]);

  return {
    matches,
    openMatches,
    resolvedMatches,
    total,
    refetch: () => { refetchTotal(); refetch(); },
  };
}

// ─────────────────────── Player Record ────────────────────────

export function useCloudFCRecord(address?: string) {
  const { data } = useReadContract({
    address: CLOUDFC_ADDRESS,
    abi: CLOUDFC_ABI,
    functionName: 'getRecord',
    args: [(address ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!address && FC_ENABLED, refetchInterval: 30_000 },
  });

  return useMemo((): CloudFCRecord => {
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

// ─────────────────────── Claimable Balance ────────────────────

export function useClaimable(address?: string) {
  const { data, refetch } = useReadContract({
    address: CLOUDFC_ADDRESS,
    abi: CLOUDFC_ABI,
    functionName: 'claimable',
    args: [(address ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!address && FC_ENABLED, refetchInterval: 15_000 },
  });

  return { claimable: BigInt(data ?? 0), refetchClaimable: refetch };
}

// ─────────────────────── Write Actions ────────────────────────

export function useCloudFCActions() {
  const { data: hash, writeContractAsync, isPending, reset } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  const createSquad = useCallback(
    async (playerIds: bigint[], formation: Formation) => {
      reset();
      const padded = [...playerIds];
      while (padded.length < 5) padded.push(0n);
      return writeContractAsync({
        address: CLOUDFC_ADDRESS,
        abi: CLOUDFC_ABI,
        functionName: 'createSquad',
        args: [
          padded as unknown as readonly [bigint, bigint, bigint, bigint, bigint],
          formationToUint8(formation),
        ],
      });
    },
    [writeContractAsync, reset]
  );

  const createMatch = useCallback(
    async (squadId: bigint, stakeEth: string) => {
      reset();
      const stake = stakeEth ? parseEther(stakeEth) : 0n;
      return writeContractAsync({
        address: CLOUDFC_ADDRESS,
        abi: CLOUDFC_ABI,
        functionName: 'createMatch',
        args: [squadId],
        value: stake,
      });
    },
    [writeContractAsync, reset]
  );

  const acceptMatch = useCallback(
    async (matchId: bigint, squadId: bigint, stake: bigint) => {
      reset();
      return writeContractAsync({
        address: CLOUDFC_ADDRESS,
        abi: CLOUDFC_ABI,
        functionName: 'acceptMatch',
        args: [matchId, squadId],
        value: stake,
      });
    },
    [writeContractAsync, reset]
  );

  const cancelMatch = useCallback(
    async (matchId: bigint) => {
      reset();
      return writeContractAsync({
        address: CLOUDFC_ADDRESS,
        abi: CLOUDFC_ABI,
        functionName: 'cancelMatch',
        args: [matchId],
      });
    },
    [writeContractAsync, reset]
  );

  const claimRewards = useCallback(
    async () => {
      reset();
      return writeContractAsync({
        address: CLOUDFC_ADDRESS,
        abi: CLOUDFC_ABI,
        functionName: 'claimRewards',
      });
    },
    [writeContractAsync, reset]
  );

  return { createSquad, createMatch, acceptMatch, cancelMatch, claimRewards, isPending, isSuccess };
}
