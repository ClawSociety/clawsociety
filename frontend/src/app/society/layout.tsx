import type { Metadata } from 'next';
import { ServerFundBar } from '@/components/ui/ServerFundBar';
import { ActivityTicker } from '@/components/ui/ActivityTicker';

export const metadata: Metadata = {
  title: 'Society Grid',
  description: '100 Harberger-taxed seats on Base — claim tiles, set prices, earn ETH from every trade',
};

export default function SocietyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ServerFundBar />
      <ActivityTicker />
      {children}
    </>
  );
}
