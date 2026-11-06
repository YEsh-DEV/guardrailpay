import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "QuoteSeal — Your Agent's Gateway to Safer Payments",
  description:
    "QuoteSeal intercepts and verifies every AI agent payment against the merchant's ENS identity before the wallet signs.",
  keywords: ['AI agents', 'x402', 'ENS', 'Hedera', 'payment security', 'Web3', 'fintech'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#050505] text-[#E2E8F0] overflow-x-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
