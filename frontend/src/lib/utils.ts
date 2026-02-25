import { TAX_RATE_BPS, BUYOUT_FEE_BPS } from './constants';
import { parseEther } from 'viem';

export function formatETH(amount: bigint): string {
  const num = Number(amount) / 1e18;
  if (num < 0.0001) return '<0.0001 ETH';
  return `${num.toFixed(4)} ETH`;
}

export function parseETHInput(amount: string): bigint {
  return parseEther(amount || '0');
}

export function calculateTaxPerWeek(price: bigint): bigint {
  return (price * BigInt(TAX_RATE_BPS)) / 10000n;
}

export function calculateRunway(deposit: bigint, price: bigint): string {
  if (price === 0n) return '\u221E';
  const taxPerWeek = calculateTaxPerWeek(price);
  if (taxPerWeek === 0n) return '\u221E';
  const weeks = Number(deposit) / Number(taxPerWeek);
  if (weeks > 52) return `${(weeks / 52).toFixed(1)} years`;
  if (weeks > 1) return `${weeks.toFixed(1)} weeks`;
  return `${(weeks * 7).toFixed(1)} days`;
}

export function calculateBuyoutCost(price: bigint): { total: bigint; fee: bigint; sellerGets: bigint } {
  const fee = (price * BigInt(BUYOUT_FEE_BPS)) / 10000n;
  const sellerGets = price - fee;
  return { total: price, fee, sellerGets };
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
