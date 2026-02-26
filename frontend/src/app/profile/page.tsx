'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/ui/ConnectButton';
import { useProfile } from '@/hooks/useProfile';
import { useGridState } from '@/hooks/useGridState';
import { useClaimFees } from '@/hooks/useClaimFees';
import { useCloudFCRecord, useClaimable, useMyPlayers } from '@/hooks/useCloudFC';
import { formatETH, shortenAddress, ZERO_ADDRESS } from '@/lib/utils';
import { useMemo } from 'react';

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
      <div className="font-mono text-lg font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { address } = useAccount();
  const { profile } = useProfile(address);
  const { seats } = useGridState();

  const myOwnedSeatIds = useMemo(
    () =>
      seats
        .map((s, i) => ({ s, i }))
        .filter(
          ({ s }) =>
            address &&
            s.holder !== ZERO_ADDRESS &&
            s.holder.toLowerCase() === address.toLowerCase()
        )
        .map(({ i }) => BigInt(i)),
    [seats, address]
  );

  const { totalPending } = useClaimFees(myOwnedSeatIds);
  const record = useCloudFCRecord(address);
  const { claimable } = useClaimable(address);
  const { players } = useMyPlayers(address);

  const mySeats = useMemo(
    () =>
      seats.filter(
        (s) =>
          address &&
          s.holder !== ZERO_ADDRESS &&
          s.holder.toLowerCase() === address.toLowerCase()
      ),
    [seats, address]
  );

  const totalValue = mySeats.reduce((acc, s) => acc + s.price, 0n);
  const totalDeposit = mySeats.reduce((acc, s) => acc + s.deposit, 0n);
  const totalETHEarned = totalPending + claimable;

  if (!address) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
        <p className="font-mono text-sm text-gray-400">Connect your wallet to view your profile</p>
        <ConnectButton />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile Header */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d1a] p-5">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg font-mono text-xl font-bold"
              style={{
                background: `hsl(${parseInt(address.slice(2, 8), 16) % 360}, 60%, 12%)`,
                color: `hsl(${parseInt(address.slice(2, 8), 16) % 360}, 70%, 55%)`,
              }}
            >
              {(profile.nickname || address).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2
                className="font-mono text-lg font-bold truncate"
                style={{ color: '#00ff88' }}
              >
                {profile.nickname || 'Unnamed'}
              </h2>
              <p className="font-mono text-xs text-gray-500 truncate">
                {shortenAddress(address)}
              </p>
            </div>
          </div>

          {/* Aggregate ETH */}
          {totalETHEarned > 0n && (
            <div className="mt-4 rounded-lg border border-[#00ff88]/20 bg-[#00ff88]/5 p-3 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400">
                Total Claimable ETH (All Games)
              </div>
              <div
                className="mt-1 font-mono text-xl font-bold"
                style={{ color: '#00ff88', textShadow: '0 0 12px rgba(0,255,136,0.5)' }}
              >
                {formatETH(totalETHEarned)}
              </div>
            </div>
          )}
        </div>

        {/* Society Grid Section */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d1a] p-5">
          <h3
            className="mb-3 font-mono text-xs font-bold uppercase tracking-widest"
            style={{ color: '#00ff88' }}
          >
            Society Grid
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatBox label="Seats" value={String(mySeats.length)} color="#00ffff" />
            <StatBox label="Portfolio" value={totalValue > 0n ? formatETH(totalValue) : '0 ETH'} color="#ff44ff" />
            <StatBox label="Deposits" value={formatETH(totalDeposit)} color="#ffd700" />
            <StatBox label="Pending Fees" value={totalPending > 0n ? formatETH(totalPending) : '0 ETH'} color="#00ff88" />
          </div>

          {mySeats.length > 0 && (
            <div className="mt-3 font-mono text-xs text-gray-400">
              Seat IDs: {myOwnedSeatIds.map((id) => `#${id}`).join(', ')}
            </div>
          )}
        </div>

        {/* CloudFC Section */}
        <div className="rounded-xl border border-white/10 bg-[#0d0d1a] p-5">
          <h3
            className="mb-3 font-mono text-xs font-bold uppercase tracking-widest"
            style={{ color: '#00ffff' }}
          >
            Claw FC
          </h3>

          {record.matchesPlayed > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <StatBox label="Wins" value={String(record.wins)} color="#00ff88" />
                <StatBox label="Draws" value={String(record.draws)} color="#ffd700" />
                <StatBox label="Losses" value={String(record.losses)} color="#ff0055" />
                <StatBox label="GF" value={String(record.goalsFor)} color="#00ffff" />
                <StatBox label="GA" value={String(record.goalsAgainst)} color="#ff8855" />
              </div>

              {claimable > 0n && (
                <div className="mt-3 flex items-center justify-between rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                  <span className="font-mono text-xs text-yellow-400">
                    FC Claimable: {formatETH(claimable)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-gray-500">
              No matches played yet.{' '}
              {players.length > 0
                ? `You have ${players.length} player${players.length > 1 ? 's' : ''} ready.`
                : 'Open a pack to get started!'}
            </p>
          )}

          {players.length > 0 && (
            <div className="mt-3 font-mono text-xs text-gray-400">
              {players.length} player{players.length > 1 ? 's' : ''} owned
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
