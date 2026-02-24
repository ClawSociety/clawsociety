'use client';

import { useState, useCallback } from 'react';
import { useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESS, MANAGER_ABI } from '@/lib/contract';

export interface ContractEvent {
  type: 'SeatClaimed' | 'SeatBoughtOut' | 'SeatAbandoned' | 'SeatForfeited';
  seatId: bigint;
  address: string;
  timestamp: number;
  txHash: string;
}

interface EventArgs {
  seatId?: bigint;
  holder?: string;
  newHolder?: string;
}

const MAX_EVENTS = 20;

export function useContractEvents() {
  const [events, setEvents] = useState<ContractEvent[]>([]);

  const addEvent = useCallback((event: ContractEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
  }, []);

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatClaimed',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: EventArgs }).args;
        addEvent({
          type: 'SeatClaimed',
          seatId: args.seatId ?? 0n,
          address: args.holder ?? '',
          timestamp: Date.now(),
          txHash: log.transactionHash ?? '',
        });
      }
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatBoughtOut',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: EventArgs }).args;
        addEvent({
          type: 'SeatBoughtOut',
          seatId: args.seatId ?? 0n,
          address: args.newHolder ?? '',
          timestamp: Date.now(),
          txHash: log.transactionHash ?? '',
        });
      }
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatAbandoned',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: EventArgs }).args;
        addEvent({
          type: 'SeatAbandoned',
          seatId: args.seatId ?? 0n,
          address: args.holder ?? '',
          timestamp: Date.now(),
          txHash: log.transactionHash ?? '',
        });
      }
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: MANAGER_ABI,
    eventName: 'SeatForfeited',
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as unknown as { args: EventArgs }).args;
        addEvent({
          type: 'SeatForfeited',
          seatId: args.seatId ?? 0n,
          address: args.holder ?? '',
          timestamp: Date.now(),
          txHash: log.transactionHash ?? '',
        });
      }
    },
  });

  return { events };
}
