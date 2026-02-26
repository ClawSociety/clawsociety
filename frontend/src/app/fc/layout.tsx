import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claw FC',
  description: 'Player-Centric 5v5 on-chain football — build squads, challenge opponents, earn ETH',
};

export default function FCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
