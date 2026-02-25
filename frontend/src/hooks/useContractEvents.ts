'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';
import { Log } from 'viem';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType =
  | 'SeatClaimed'
  | 'SeatBoughtOut'
  | 'SeatAbandoned'
  | 'SeatForfeited'
  | 'PriceChanged'
  | 'DepositAdded'
  | 'DepositWithdrawn'
  | 'FeesClaimed'
  | 'FeesDistributed';

export interface ContractEvent {
  type: EventType;
  seatId?: bigint;
  address?: string;
  oldAddress?: string;
  amount?: bigint;
  timestamp: number;
  txHash: string;
  logIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EVENTS = 50;
// ~1 hour of Base blocks (2s block time)
const HISTORICAL_BLOCK_RANGE = 1800n;

// All 9 event names we track
const EVENT_NAMES: EventType[] = [
  'SeatClaimed',
  'SeatBoughtOut',
  'SeatAbandoned',
  'SeatForfeited',
  'PriceChanged',
  'DepositAdded',
  'DepositWithdrawn',
  'FeesClaimed',
  'FeesDistributed',
];

// ---------------------------------------------------------------------------
// Parse a raw log into our ContractEvent shape
// ---------------------------------------------------------------------------

function parseLog(eventName: EventType, log: Log, blockTimestamp?: number): ContractEvent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = (log as any).args ?? {};
  const ts = blockTimestamp ?? Date.now();

  const base: ContractEvent = {
    type: eventName,
    timestamp: ts,
    txHash: log.transactionHash ?? '',
    logIndex: log.logIndex ?? 0,
  };

  switch (eventName) {
    case 'SeatClaimed':
      return { ...base, seatId: args.seatId, address: args.holder, amount: args.deposit };
    case 'SeatBoughtOut':
      return { ...base, seatId: args.seatId, address: args.newHolder, oldAddress: args.oldHolder, amount: args.price };
    case 'SeatAbandoned':
      return { ...base, seatId: args.seatId, address: args.holder };
    case 'SeatForfeited':
      return { ...base, seatId: args.seatId, address: args.holder };
    case 'PriceChanged':
      return { ...base, seatId: args.seatId, amount: args.newPrice };
    case 'DepositAdded':
      return { ...base, seatId: args.seatId, amount: args.amount };
    case 'DepositWithdrawn':
      return { ...base, seatId: args.seatId, amount: args.amount };
    case 'FeesClaimed':
      return { ...base, seatId: args.seatId, address: args.holder, amount: args.amount };
    case 'FeesDistributed':
      return { ...base, amount: args.amount };
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Dedupe key
// ---------------------------------------------------------------------------

function eventKey(txHash: string, logIndex: number): string {
  return `${txHash}-${logIndex}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useContractEvents() {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const seenIds = useRef(new Set<string>());
  const publicClient = usePublicClient();

  // Add event(s) with deduplication
  const addEvents = useCallback((incoming: ContractEvent[]) => {
    const novel: ContractEvent[] = [];
    for (const evt of incoming) {
      const key = eventKey(evt.txHash, evt.logIndex);
      if (!seenIds.current.has(key)) {
        seenIds.current.add(key);
        novel.push(evt);
      }
    }
    if (novel.length === 0) return;
    setEvents((prev) => [...novel, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const addEvent = useCallback((event: ContractEvent) => {
    addEvents([event]);
  }, [addEvents]);

  // -----------------------------------------------------------------------
  // Historical fetch on mount
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    async function fetchHistorical() {
      try {
        const currentBlock = await publicClient!.getBlockNumber();
        const fromBlock = currentBlock > HISTORICAL_BLOCK_RANGE ? currentBlock - HISTORICAL_BLOCK_RANGE : 0n;

        // Fetch logs for all 9 events in parallel
        const logPromises = EVENT_NAMES.map((name) =>
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: (MANAGER_ABI as readonly unknown[]).find(
              (e: unknown) => (e as { type: string; name?: string }).type === 'event' && (e as { name: string }).name === name
            ) as undefined, // viem accepts the ABI event object
            fromBlock,
            toBlock: currentBlock,
          }).then((logs) => logs.map((log) => ({ name, log })))
            .catch(() => [] as { name: EventType; log: Log }[])
        );

        const results = await Promise.all(logPromises);
        if (cancelled) return;

        // Flatten, sort by block number + log index (oldest first), then reverse for newest-first
        const all = results
          .flat()
          .sort((a, b) => {
            const blockDiff = Number((a.log.blockNumber ?? 0n) - (b.log.blockNumber ?? 0n));
            if (blockDiff !== 0) return blockDiff;
            return (a.log.logIndex ?? 0) - (b.log.logIndex ?? 0);
          });

        // Use block timestamps — batch unique block numbers
        const blockNumbers = [...new Set(all.map((e) => e.log.blockNumber).filter(Boolean))] as bigint[];
        const blockTimestamps = new Map<bigint, number>();

        // Fetch block timestamps in batches of 10
        for (let i = 0; i < blockNumbers.length; i += 10) {
          const batch = blockNumbers.slice(i, i + 10);
          const blocks = await Promise.all(
            batch.map((bn) => publicClient!.getBlock({ blockNumber: bn }).catch(() => null))
          );
          for (const block of blocks) {
            if (block) {
              blockTimestamps.set(block.number, Number(block.timestamp) * 1000);
            }
          }
        }

        if (cancelled) return;

        const parsed = all.map(({ name, log }) => {
          const ts = log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? Date.now()) : Date.now();
          return parseLog(name, log, ts);
        });

        // Reverse so newest is first
        parsed.reverse();
        addEvents(parsed);
      } catch (err) {
        console.warn('[ClawSociety] Failed to fetch historical events:', err);
      }
    }

    fetchHistorical();
    return () => { cancelled = true; };
  }, [publicClient, addEvents]);

  // -----------------------------------------------------------------------
  // Real-time watchers for all 9 events
  // -----------------------------------------------------------------------

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatClaimed',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('SeatClaimed', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatBoughtOut',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('SeatBoughtOut', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatAbandoned',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('SeatAbandoned', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatForfeited',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('SeatForfeited', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'PriceChanged',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('PriceChanged', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'DepositAdded',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('DepositAdded', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'DepositWithdrawn',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('DepositWithdrawn', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'FeesClaimed',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('FeesClaimed', log as unknown as Log));
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'FeesDistributed',
    onLogs(logs) {
      for (const log of logs) addEvent(parseLog('FeesDistributed', log as unknown as Log));
    },
  });

  return { events };
}
