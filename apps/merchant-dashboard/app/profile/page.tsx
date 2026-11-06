import React from 'react';

export default function ProfilePage() {
  const profile = {
    ensName: 'researchpro.eth',
    serviceEndpoint: 'https://api.researchpro.com',
    hederaNetwork: 'hedera:testnet',
    assetId: 'HBAR',
    activePayTo: '0.0.12345',
    maxAmount: '1,000,000,000 tinybars (10 HBAR)',
    profileVersion: 'v1.0.0',
    rotationStatus: 'ACTIVE',
    controllerContract: '0x352B883eE8C... (RotationController.sol)',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ENSv2 Payment Profile</h1>
        <p className="text-sm text-slate-400 mt-1">
          Live records registered on Sepolia ENS resolver consumed by PayeeGuard engines.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {Object.entries(profile).map(([key, val]) => (
          <div key={key} className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{key}</span>
            <span className="text-sm font-mono text-slate-100">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
