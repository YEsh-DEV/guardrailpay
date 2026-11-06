'use client';
import React, { useState } from 'react';

export default function RotationPage() {
  const [newPayTo, setNewPayTo] = useState('0.0.99999');
  const [rotationStatus, setRotationStatus] = useState<'IDLE' | 'PROPOSED' | 'APPROVED' | 'ACTIVE'>('IDLE');
  const [delayRemaining, setDelayRemaining] = useState(90);

  const handlePropose = () => {
    setRotationStatus('PROPOSED');
  };

  const handleWorldAuth = () => {
    // Simulate World ID Agent Pass OIDC callback
    setRotationStatus('APPROVED');
    const interval = setInterval(() => {
      setDelayRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleActivate = () => {
    setRotationStatus('ACTIVE');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-[#CAF0F8]">
      <div>
        <h1 className="text-3xl font-bold font-title-sans text-white">Timelocked Payout Rotation</h1>
        <p className="text-sm text-[#90E0EF]/80 mt-1">
          Safely rotate payout account via World ID Agent Pass authorization and contract timelock.
        </p>
      </div>

      <div className="bg-[#02033B]/80 border border-[#0077B6]/30 rounded-2xl p-6 space-y-6 shadow-[0_20px_50px_rgba(2,3,59,0.7)]">
        <div>
          <label className="block text-sm font-medium text-[#90E0EF]">New Hedera Payee Account</label>
          <input
            type="text"
            value={newPayTo}
            onChange={(e) => setNewPayTo(e.target.value)}
            disabled={rotationStatus !== 'IDLE'}
            className="mt-1 w-full bg-[#03045E]/60 border border-[#0077B6]/40 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00B4D8]"
          />
        </div>

        {rotationStatus === 'IDLE' && (
          <button
            onClick={handlePropose}
            className="w-full bg-[#00B4D8] text-[#03045E] hover:bg-[#90E0EF] font-bold py-3 px-4 rounded-full transition shadow-[0_0_20px_rgba(0,180,216,0.4)]"
          >
            1. Propose Rotation (Treasury Role)
          </button>
        )}

        {rotationStatus === 'PROPOSED' && (
          <div className="space-y-4 border border-[#0077B6]/40 bg-[#0077B6]/15 p-4 rounded-xl">
            <p className="text-sm text-[#CAF0F8]">
              Rotation proposed! World ID Agent Pass verification is required to authorize the rotation.
            </p>
            <button
              onClick={handleWorldAuth}
              className="w-full bg-[#00B4D8] text-[#03045E] hover:bg-[#90E0EF] font-bold py-3 px-4 rounded-full transition shadow-[0_0_20px_rgba(0,180,216,0.4)]"
            >
              2. Authenticate with World ID Agent Pass (Biometric Consent)
            </button>
          </div>
        )}

        {rotationStatus === 'APPROVED' && (
          <div className="space-y-4 border border-[#0077B6]/40 bg-[#03045E]/60 p-4 rounded-xl">
            <p className="text-sm text-[#90E0EF]">
              World ID verified! Enforcing 90s safety timelock before activation.
            </p>
            <div className="text-center py-2 text-2xl font-mono font-bold text-[#00B4D8]">
              {delayRemaining > 0 ? `${delayRemaining}s remaining` : 'Timelock elapsed! Ready to activate.'}
            </div>
            <button
              onClick={handleActivate}
              disabled={delayRemaining > 0}
              className="w-full bg-[#00B4D8] text-[#03045E] hover:bg-[#90E0EF] disabled:bg-[#0077B6]/20 disabled:text-[#90E0EF]/40 font-bold py-3 px-4 rounded-full transition"
            >
              3. Activate Rotation on Sepolia & ENS
            </button>
          </div>
        )}

        {rotationStatus === 'ACTIVE' && (
          <div className="border border-[#00B4D8]/40 bg-[#00B4D8]/15 p-4 rounded-xl text-[#CAF0F8] text-sm font-bold font-mono">
            ✓ Rotation Active! All autonomous agents will now verify and route payments to: <strong>{newPayTo}</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
