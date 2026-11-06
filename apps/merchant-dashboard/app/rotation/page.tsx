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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Timelocked Payout Rotation</h1>
        <p className="text-sm text-slate-400 mt-1">
          Safely rotate payout account via World ID Agent Pass authorization and contract timelock.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300">New Hedera Payee Account</label>
          <input
            type="text"
            value={newPayTo}
            onChange={(e) => setNewPayTo(e.target.value)}
            disabled={rotationStatus !== 'IDLE'}
            className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
          />
        </div>

        {rotationStatus === 'IDLE' && (
          <button
            onClick={handlePropose}
            className="w-full bg-blue-600 hover:bg-blue-500 font-medium py-2.5 px-4 rounded-lg transition"
          >
            1. Propose Rotation (Treasury Role)
          </button>
        )}

        {rotationStatus === 'PROPOSED' && (
          <div className="space-y-4 border border-amber-900/60 bg-amber-950/20 p-4 rounded-lg">
            <p className="text-sm text-amber-300">
              Rotation proposed! World ID Agent Pass verification is required to authorize the rotation.
            </p>
            <button
              onClick={handleWorldAuth}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-medium py-2.5 px-4 rounded-lg transition"
            >
              2. Authenticate with World ID Agent Pass (Biometric Consent)
            </button>
          </div>
        )}

        {rotationStatus === 'APPROVED' && (
          <div className="space-y-4 border border-blue-900/60 bg-blue-950/20 p-4 rounded-lg">
            <p className="text-sm text-blue-300">
              World ID verified! Enforcing 90s safety timelock before activation.
            </p>
            <div className="text-center py-2 text-2xl font-mono font-bold text-white">
              {delayRemaining > 0 ? `${delayRemaining}s remaining` : 'Timelock elapsed! Ready to activate.'}
            </div>
            <button
              onClick={handleActivate}
              disabled={delayRemaining > 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-medium py-2.5 px-4 rounded-lg transition"
            >
              3. Activate Rotation on Sepolia & ENS
            </button>
          </div>
        )}

        {rotationStatus === 'ACTIVE' && (
          <div className="border border-emerald-900/60 bg-emerald-950/20 p-4 rounded-lg text-emerald-300 text-sm">
            Rotation Active! All autonomous agents will now verify and route payments to: <strong>{newPayTo}</strong>.
          </div>
        )}
      </div>
    </div>
  );
}
