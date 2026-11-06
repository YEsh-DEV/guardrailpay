import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'QuoteSeal — Payment Guard for Autonomous AI Agents',
  description:
    "QuoteSeal verifies every AI agent payment against the merchant's ENS identity before it signs. Autonomous, but never blind.",
  keywords: ['AI agents', 'x402', 'ENS', 'Hedera', 'payment security', 'Web3', 'autonomous payments'],
  openGraph: {
    title: 'QuoteSeal — Payment Guard for Autonomous AI Agents',
    description: 'Your agent\'s payment guard. Verified before it signs. Autonomous, but never blind.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#081014',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#081014] text-white overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
