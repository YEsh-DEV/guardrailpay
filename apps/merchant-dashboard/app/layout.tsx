import React from 'react';

export const metadata = {
  title: 'QuoteSeal - Merchant Payment Identity',
  description: 'Merchant dashboard for ENSv2 payment identity, payouts, and rotations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-blue-600 text-white px-2.5 py-1 rounded font-bold text-sm tracking-wide">
              QuoteSeal
            </span>
            <span className="font-semibold text-slate-200">Merchant Dashboard</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-slate-300">
            <a href="/" className="hover:text-blue-400">Overview</a>
            <a href="/onboard" className="hover:text-blue-400">Onboarding</a>
            <a href="/profile" className="hover:text-blue-400">ENS Profile</a>
            <a href="/rotation" className="hover:text-blue-400">Payout Rotation</a>
          </nav>
        </header>
        <main className="p-8 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
