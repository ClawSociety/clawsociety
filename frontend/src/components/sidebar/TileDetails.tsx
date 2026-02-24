'use client';

// TileDetails - selected tile info + action forms
// Usage: <TileDetails seat={seat} seatId={id} onAction={handleAction} />
// onAction('claim', { price: '100', deposit: '500' })
// onAction('buyout', { price: '200', deposit: '600' })
// onAction('setPrice', { price: '150' })
// onAction('addDeposit', { amount: '50' })
// onAction('withdrawDeposit', { amount: '25' })
// onAction('abandon', {})
// onAction('claimFees', {})

import { useState } from 'react';
import { Seat } from '@/lib/types';
import { BUILDING_CONFIGS } from '@/lib/constants';
import {
  formatUSDC,
  shortenAddress,
  calculateTaxPerWeek,
  calculateRunway,
  calculateBuyoutCost,
  ZERO_ADDRESS,
} from '@/lib/utils';
import { useAccount } from 'wagmi';

interface TileDetailsProps {
  seat: Seat;
  seatId: number;
  onAction: (action: string, params: Record<string, string>) => void;
}

// Reusable stat row
function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-mono text-xs text-gray-400">{label}</span>
      <span
        className="font-mono text-xs font-bold"
        style={{ color: valueColor ?? '#e2e8f0' }}
      >
        {value}
      </span>
    </div>
  );
}

// Reusable labeled input
function ActionInput({
  label,
  value,
  onChange,
  placeholder,
  accentColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
        {label}
      </label>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '0.00'}
        className="w-full rounded border bg-[#0d0d1a] px-2 py-1.5 font-mono text-xs text-white placeholder-gray-600 outline-none transition-colors focus:ring-1"
        style={{
          borderColor: accentColor ? `${accentColor}55` : '#ffffff22',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': accentColor ?? '#00ffff',
        }}
      />
    </div>
  );
}

// Reusable action button
function ActionButton({
  label,
  onClick,
  color,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const base =
    'w-full rounded px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40';

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: color ?? '#00ffff',
      color: '#0d0d1a',
    },
    ghost: {
      background: 'transparent',
      color: color ?? '#00ffff',
      border: `1px solid ${color ?? '#00ffff'}55`,
    },
    danger: {
      background: 'transparent',
      color: '#ff4455',
      border: '1px solid #ff445533',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={base}
      style={styles[variant]}
    >
      {label}
    </button>
  );
}

// Divider with label
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">{label}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export function TileDetails({ seat, seatId, onAction }: TileDetailsProps) {
  const { address } = useAccount();
  const building = BUILDING_CONFIGS[seat.buildingType] ?? BUILDING_CONFIGS[6];

  // Claim form state
  const [claimPrice, setClaimPrice] = useState('');
  const [claimDeposit, setClaimDeposit] = useState('');

  // Buyout form state
  const [buyoutPrice, setBuyoutPrice] = useState('');
  const [buyoutDeposit, setBuyoutDeposit] = useState('');

  // Owner action states
  const [newPrice, setNewPrice] = useState('');
  const [addAmt, setAddAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  const isAvailable = seat.holder === ZERO_ADDRESS;
  const isOwner = address && seat.holder.toLowerCase() === address.toLowerCase();
  const isOtherOwner = !isAvailable && !isOwner;

  const taxPerWeek = isAvailable ? 0n : calculateTaxPerWeek(seat.price);
  const runway = isAvailable ? null : calculateRunway(seat.deposit, seat.price);

  // Buyout cost preview
  const buyoutPreviewPrice = parseFloat(buyoutPrice || '0');
  const buyoutCost =
    isOtherOwner && !isNaN(buyoutPreviewPrice) && buyoutPreviewPrice > 0
      ? calculateBuyoutCost(seat.price)
      : null;

  return (
    <div
      className="rounded-xl border p-4 font-mono"
      style={{
        background: '#1a1a2e',
        borderColor: building.borderColor + '66',
        boxShadow: `0 0 20px ${building.glowColor}`,
      }}
    >
      {/* ---- Building Header ---- */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl leading-none">{building.emoji}</span>
        <div className="min-w-0">
          <h2
            className="truncate text-sm font-bold uppercase tracking-wider"
            style={{ color: building.color }}
          >
            {building.name}
          </h2>
          <p className="text-[10px] text-gray-500">
            Seat #{seatId} &middot; {building.multiplier}x multiplier
          </p>
        </div>
      </div>

      {/* ================================================================
          AVAILABLE
      ================================================================ */}
      {isAvailable && (
        <>
          <div
            className="mb-3 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: '#00ff8822', color: '#00ff88', border: '1px solid #00ff8844' }}
          >
            Available
          </div>

          <SectionDivider label="Claim Seat" />

          <div className="mt-2 space-y-2">
            <ActionInput
              label="Your Price (USDC)"
              value={claimPrice}
              onChange={setClaimPrice}
              placeholder="e.g. 100"
              accentColor={building.color}
            />
            <ActionInput
              label="Initial Deposit (USDC)"
              value={claimDeposit}
              onChange={setClaimDeposit}
              placeholder="e.g. 500"
              accentColor={building.color}
            />

            {claimPrice && (
              <p className="text-[10px] text-gray-500">
                Tax: {formatUSDC(calculateTaxPerWeek(BigInt(Math.floor(parseFloat(claimPrice || '0') * 1e6))))} /
                week
              </p>
            )}

            <ActionButton
              label="Claim Seat"
              onClick={() => onAction('claim', { price: claimPrice, deposit: claimDeposit })}
              color={building.color}
              disabled={!claimPrice || !claimDeposit}
            />
          </div>
        </>
      )}

      {/* ================================================================
          OWNED BY SOMEONE ELSE
      ================================================================ */}
      {isOtherOwner && (
        <>
          <div className="mb-3 space-y-0.5">
            <StatRow label="Owner" value={shortenAddress(seat.holder)} valueColor="#a0aec0" />
            <StatRow label="Price" value={formatUSDC(seat.price)} valueColor={building.color} />
            <StatRow label="Deposit" value={formatUSDC(seat.deposit)} />
            <StatRow
              label="Tax / Week"
              value={formatUSDC(taxPerWeek)}
              valueColor="#ff8855"
            />
            <StatRow label="Runway" value={runway ?? '-'} valueColor="#ffd700" />
          </div>

          <SectionDivider label="Buy Out" />

          <div className="mt-2 space-y-2">
            <ActionInput
              label="Your New Price (USDC)"
              value={buyoutPrice}
              onChange={setBuyoutPrice}
              placeholder="e.g. 200"
              accentColor="#ff0055"
            />
            <ActionInput
              label="Your Deposit (USDC)"
              value={buyoutDeposit}
              onChange={setBuyoutDeposit}
              placeholder="e.g. 600"
              accentColor="#ff0055"
            />

            {/* Cost breakdown */}
            {buyoutCost && (
              <div
                className="rounded border p-2 text-[10px]"
                style={{ borderColor: '#ff005533', background: '#ff005511' }}
              >
                <p className="mb-1 font-bold uppercase tracking-wider" style={{ color: '#ff0055' }}>
                  Cost Breakdown
                </p>
                <div className="space-y-0.5 text-gray-400">
                  <div className="flex justify-between">
                    <span>Pays seller</span>
                    <span style={{ color: '#e2e8f0' }}>{formatUSDC(buyoutCost.sellerGets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Protocol fee (20%)</span>
                    <span style={{ color: '#ff8855' }}>{formatUSDC(buyoutCost.fee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-0.5">
                    <span className="font-bold text-white">Total</span>
                    <span className="font-bold" style={{ color: '#ff0055' }}>
                      {formatUSDC(buyoutCost.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <ActionButton
              label="Buy Out"
              onClick={() => onAction('buyout', { price: buyoutPrice, deposit: buyoutDeposit })}
              color="#ff0055"
              disabled={!buyoutPrice || !buyoutDeposit}
            />
          </div>
        </>
      )}

      {/* ================================================================
          OWNED BY CONNECTED USER
      ================================================================ */}
      {isOwner && (
        <>
          <div
            className="mb-3 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: `${building.color}22`, color: building.color, border: `1px solid ${building.color}44` }}
          >
            Your Seat
          </div>

          {/* Current stats */}
          <div className="mb-3 space-y-0.5">
            <StatRow label="Price" value={formatUSDC(seat.price)} valueColor={building.color} />
            <StatRow label="Deposit" value={formatUSDC(seat.deposit)} />
            <StatRow
              label="Tax / Week"
              value={formatUSDC(taxPerWeek)}
              valueColor="#ff8855"
            />
            <StatRow label="Runway" value={runway ?? '-'} valueColor="#ffd700" />
          </div>

          {/* Set Price */}
          <SectionDivider label="Set Price" />
          <div className="mt-2 mb-3 flex gap-2">
            <div className="flex-1">
              <ActionInput
                label="New Price (USDC)"
                value={newPrice}
                onChange={setNewPrice}
                placeholder={formatUSDC(seat.price).replace('$', '')}
                accentColor={building.color}
              />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Set"
                onClick={() => { onAction('setPrice', { price: newPrice }); setNewPrice(''); }}
                color={building.color}
                disabled={!newPrice}
                variant="ghost"
              />
            </div>
          </div>

          {/* Add Deposit */}
          <SectionDivider label="Deposit" />
          <div className="mt-2 mb-1 flex gap-2">
            <div className="flex-1">
              <ActionInput
                label="Add (USDC)"
                value={addAmt}
                onChange={setAddAmt}
                placeholder="e.g. 100"
                accentColor="#00ff88"
              />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Add"
                onClick={() => { onAction('addDeposit', { amount: addAmt }); setAddAmt(''); }}
                color="#00ff88"
                disabled={!addAmt}
                variant="ghost"
              />
            </div>
          </div>
          <div className="mb-3 flex gap-2">
            <div className="flex-1">
              <ActionInput
                label="Withdraw (USDC)"
                value={withdrawAmt}
                onChange={setWithdrawAmt}
                placeholder="e.g. 50"
                accentColor="#ffd700"
              />
            </div>
            <div className="flex items-end">
              <ActionButton
                label="Out"
                onClick={() => { onAction('withdrawDeposit', { amount: withdrawAmt }); setWithdrawAmt(''); }}
                color="#ffd700"
                disabled={!withdrawAmt}
                variant="ghost"
              />
            </div>
          </div>

          {/* Claim Fees */}
          <SectionDivider label="Fees" />
          <div className="mt-2 mb-3">
            <ActionButton
              label="Claim ETH Fees"
              onClick={() => onAction('claimFees', {})}
              color="#00ffff"
              variant="ghost"
            />
          </div>

          {/* Abandon */}
          <SectionDivider label="Danger Zone" />
          <div className="mt-2">
            <ActionButton
              label="Abandon Seat"
              onClick={() => onAction('abandon', {})}
              variant="danger"
            />
          </div>
        </>
      )}
    </div>
  );
}
