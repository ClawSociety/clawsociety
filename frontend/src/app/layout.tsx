import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Web3Provider } from '@/components/providers/Web3Provider';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Claw Society',
  description: 'Tokenized city grid on Base — 100 Harberger-taxed seats earning ETH from every trade',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Claw Society',
    description: '100 seats. Harberger-taxed. ETH from every trade.',
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
    title: 'Claw Society',
    description: '100 seats. Harberger-taxed. ETH from every trade.',
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
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
