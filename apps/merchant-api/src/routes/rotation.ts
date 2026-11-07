import { FastifyInstance } from 'fastify';

export interface RotationState {
  id: string;
  currentPayTo: string;
  pendingPayTo: string;
  status: 'NONE' | 'PROPOSED' | 'APPROVED' | 'ACTIVE' | 'REVOKED';
  proposedAt: number;
  approvedAt?: number;
  effectiveAt?: number;
  worldSubject?: string;
}

export let currentPayTo = process.env.HEDERA_MERCHANT_ACCOUNT_ID || '0.0.12345';

export function updateMerchantPayTo(newPayTo: string) {
  currentPayTo = newPayTo;
}

let activeRotation: RotationState = {
  id: String(Date.now()),
  currentPayTo,
  pendingPayTo: '',
  status: 'NONE',
  proposedAt: 0,
};

const ROTATION_DELAY = parseInt(process.env.ROTATION_DELAY_SECONDS || '90', 10);

export function getActiveRotation(): RotationState {
  return activeRotation;
}

export function approveActiveRotation(worldSubject: string) {
  if (activeRotation.status !== 'PROPOSED') {
    return { success: false, reason: `Cannot approve rotation in status ${activeRotation.status}` };
  }

  const now = Math.floor(Date.now() / 1000);
  activeRotation.status = 'APPROVED';
  activeRotation.approvedAt = now;
  activeRotation.effectiveAt = now + ROTATION_DELAY;
  activeRotation.worldSubject = worldSubject;

  return {
    success: true,
    effectiveAt: activeRotation.effectiveAt,
    delaySeconds: ROTATION_DELAY,
  };
}

export async function rotationRoutes(server: FastifyInstance) {
  // Propose a new payout address
  server.post('/api/rotation/propose', async (request, reply) => {
    const body = (request.body as { newPayTo?: string }) || {};
    if (!body.newPayTo) {
      return reply.code(400).send({ error: 'Missing newPayTo' });
    }

    const now = Math.floor(Date.now() / 1000);
    activeRotation = {
      id: String(Date.now()),
      currentPayTo,
      pendingPayTo: body.newPayTo,
      status: 'PROPOSED',
      proposedAt: now,
    };

    return reply.code(200).send({
      message: 'Rotation proposed. Awaiting World ID Agent Pass approval.',
      rotation: activeRotation,
      nextStep: '/world/start',
    });
  });

  // Get rotation status
  server.get('/api/rotation/status', async () => {
    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining =
      activeRotation.effectiveAt && activeRotation.effectiveAt > now
        ? activeRotation.effectiveAt - now
        : 0;

    return {
      activePayTo: process.env.HEDERA_MERCHANT_ACCOUNT_ID || '0.0.12345',
      rotation: activeRotation,
      currentTime: now,
      secondsRemaining,
      canActivate: activeRotation.status === 'APPROVED' && secondsRemaining === 0,
    };
  });

  // Activate rotation
  server.post('/api/rotation/activate', async (request, reply) => {
    if (activeRotation.status !== 'APPROVED') {
      return reply.code(400).send({
        error: `Cannot activate rotation with status ${activeRotation.status}. Must be APPROVED.`,
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (activeRotation.effectiveAt && now < activeRotation.effectiveAt) {
      const wait = activeRotation.effectiveAt - now;
      return reply.code(403).send({
        error: `Timelock delay not elapsed. Must wait ${wait} more seconds.`,
        effectiveAt: activeRotation.effectiveAt,
        currentTime: now,
      });
    }

    activeRotation.status = 'ACTIVE';
    updateMerchantPayTo(activeRotation.pendingPayTo);

    return reply.code(200).send({
      message: 'Rotation successfully activated!',
      newActivePayTo: currentPayTo,
      rotation: activeRotation,
    });
  });

  // Revoke rotation
  server.post('/api/rotation/revoke', async () => {
    activeRotation.status = 'REVOKED';
    return {
      message: 'Rotation revoked. Previous payout address remains active.',
      rotation: activeRotation,
    };
  });
}
