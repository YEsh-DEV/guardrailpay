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
    <div className="max-w-3xl mx-auto space-y-6 text-[#CAF0F8]">
      <div>
        <h1 className="text-3xl font-bold font-title-sans text-white">ENSv2 Payment Profile</h1>
        <p className="text-sm text-[#90E0EF]/80 mt-1">
          Live records registered on Sepolia ENS resolver consumed by PayeeGuard engines.
        </p>
      </div>

      <div className="bg-[#02033B]/80 border border-[#0077B6]/30 rounded-2xl divide-y divide-[#0077B6]/20 shadow-[0_20px_50px_rgba(2,3,59,0.7)]">
        {Object.entries(profile).map(([key, val]) => (
          <div key={key} className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-[#90E0EF]">{key}</span>
            <span className="text-sm font-mono text-[#CAF0F8]">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
