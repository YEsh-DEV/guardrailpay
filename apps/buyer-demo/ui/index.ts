import Fastify from 'fastify';
import { runAgentPurchase } from '../agent/index.js';
import { createLogger } from '@quoteseal/shared';

const logger = createLogger('BuyerDemoUI');
const app = Fastify();
const PORT = 3003;

let recentLogs: any[] = [];

app.get('/api/run', async (request) => {
  const query = (request.query as { mode?: string }) || {};
  const isAttackMode = query.mode === 'attack';

  const targetUrl = isAttackMode
    ? 'http://localhost:3002/api/research/paid'
    : 'http://localhost:3001/api/research/paid';

  const result = await runAgentPurchase(targetUrl);
  recentLogs.unshift({
    timestamp: new Date().toLocaleTimeString(),
    mode: isAttackMode ? 'ATTACK_PROXY' : 'DIRECT_MERCHANT',
    ...result,
  });

  return result;
});

app.get('/api/history', async () => {
  return recentLogs;
});

app.get('/', async (request, reply) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QuoteSeal - Autonomous Agent Payment Demo</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-8">
  <div class="max-w-5xl mx-auto space-y-8">
    <div class="border-b border-slate-800 pb-6 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <span class="bg-blue-600 px-3 py-1 rounded text-xl">QuoteSeal</span>
          AI Agent PayeeGuard Demo
        </h1>
        <p class="text-slate-400 mt-2">Guarding HTTP 402 micropayments against recipient-substitution attacks on Hedera</p>
      </div>
      <div class="text-right">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
          ENSv2 Sepolia & Hedera Testnet
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-emerald-400 mb-2">Scenario 1: Normal Agent Payment</h2>
        <p class="text-sm text-slate-400 mb-4">Direct request to merchant. Payee matches ENS profile (<code>researchpro.eth</code>). Expect: <strong>PASS</strong> & real Hedera settlement.</p>
        <button onclick="triggerRun('normal')" id="btn-normal" class="w-full bg-emerald-600 hover:bg-emerald-500 font-medium py-2.5 px-4 rounded-lg transition">
          Execute Normal Payment (PASS)
        </button>
      </div>

      <div class="bg-slate-900 border border-rose-900/40 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-rose-400 mb-2">Scenario 2: MITM Payee Attack</h2>
        <p class="text-sm text-slate-400 mb-4">Routed via Attack Proxy (rewrites <code>payTo</code> to <code>0.0.66666</code>). Expect: <strong>BLOCK</strong> with Signer Call Count = 0.</p>
        <button onclick="triggerRun('attack')" id="btn-attack" class="w-full bg-rose-600 hover:bg-rose-500 font-medium py-2.5 px-4 rounded-lg transition">
          Execute via Attack Proxy (BLOCK)
        </button>
      </div>
    </div>

    <!-- Verdict Timeline -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <h3 class="text-xl font-bold mb-4">PayeeGuard Verdict Timeline</h3>
      <div id="timeline" class="space-y-4">
        <p class="text-slate-500 italic">No payments executed yet. Click one of the scenario buttons above.</p>
      </div>
    </div>
  </div>

  <script>
    async function triggerRun(mode) {
      const btn = mode === 'normal' ? document.getElementById('btn-normal') : document.getElementById('btn-attack');
      btn.innerText = 'Evaluating...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/run?mode=' + mode);
        const data = await res.json();
        updateTimeline();
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        btn.innerText = mode === 'normal' ? 'Execute Normal Payment (PASS)' : 'Execute via Attack Proxy (BLOCK)';
        btn.disabled = false;
      }
    }

    async function updateTimeline() {
      const res = await fetch('/api/history');
      const items = await res.json();
      const container = document.getElementById('timeline');
      if (items.length === 0) return;

      container.innerHTML = items.map(item => {
        const isPass = item.verdict === 'PASS';
        const badgeColor = isPass ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700' : 'bg-rose-900/50 text-rose-400 border-rose-700';

        return \`
          <div class="border border-slate-800 rounded-lg p-4 bg-slate-950/60 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 rounded text-xs font-bold border \${badgeColor}">\${item.verdict}</span>
                <span class="text-sm font-semibold text-slate-200">\${item.mode}</span>
                <span class="text-xs text-slate-500">\${item.timestamp}</span>
              </div>
              <div class="text-xs text-slate-400">
                Signer Called: <span class="\${item.signerCalled ? 'text-emerald-400 font-bold' : 'text-slate-400 font-mono'}">\${item.signerCalled ? 'YES (1)' : 'NO (0)'}</span>
              </div>
            </div>
            <p class="text-sm text-slate-300 font-mono bg-slate-900 p-2 rounded text-xs">\${item.reason}</p>
            \${item.hashScanUrl ? \`
              <div class="mt-2 text-xs">
                <a href="\${item.hashScanUrl}" target="_blank" class="text-blue-400 hover:underline flex items-center gap-1">
                  View Hedera Transaction on HashScan &rarr;
                </a>
              </div>
            \` : ''}
          </div>
        \`;
      }).join('');
    }
  </script>
</body>
</html>
  `;
  reply.header('content-type', 'text/html; charset=utf-8');
  return reply.send(html);
});

export async function startBuyerDemoUI(port = PORT) {
  await app.listen({ port, host: '0.0.0.0' });
  logger.info(`Buyer Demo UI running on http://localhost:${port}`);
  return app;
}

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.includes('ui/index.ts')) {
  startBuyerDemoUI();
}
