import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { http } from 'wagmi';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY;
const baseRpc = alchemyKey
  ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
  : undefined; // falls back to RainbowKit default

export const config = getDefaultConfig({
  appName: 'Claw Society',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'demo',
  chains: [base],
  ssr: true,
  ...(baseRpc && {
    transports: {
      [base.id]: http(baseRpc),
    },
  }),
});
