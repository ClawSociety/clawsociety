import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Web3Provider } from '@/components/providers/Web3Provider';
import { PortalNav } from '@/components/layout/PortalNav';
import { PortalFooter } from '@/components/layout/PortalFooter';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'Claw Society — Ecosystem Portal',
    template: '%s | Claw Society',
  },
  description: 'Multi-game ecosystem on Base — Society Grid, Claw FC, and more',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Claw Society — Ecosystem Portal',
    description: 'Multi-game ecosystem on Base — Society Grid, Claw FC, and more',
    type: 'website',
    url: 'https://clawsociety.fun',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'Claw Society',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Claw Society — Ecosystem Portal',
    description: 'Multi-game ecosystem on Base — Society Grid, Claw FC, and more',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body
        className="antialiased"
        style={{ background: '#0a0a0a', color: '#ededed' }}
      >
        <Web3Provider>
          <div
            className="grid-bg flex min-h-screen flex-col"
            style={{ background: '#0a0a0a' }}
          >
            <PortalNav />
            {children}
            <PortalFooter />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
