import { createHash } from 'crypto';

export interface AuditEvent {
  type: 'PAYMENT_PASS' | 'PAYMENT_BLOCK' | 'ROTATION_PROPOSED' | 'ROTATION_ACTIVATED';
  timestamp: number;
  origin: string;
  payTo: string;
  ensName?: string;
  details?: Record<string, unknown>;
}

export interface HcsAuditRecord {
  topicId: string;
  sequenceNumber: number;
  eventHash: string;
  timestamp: string;
}

const inMemoryHcsLog: HcsAuditRecord[] = [];

export async function submitAuditEventToHcs(
  event: AuditEvent,
  topicId = '0.0.989898'
): Promise<HcsAuditRecord> {
  const serialized = JSON.stringify(event);
  const eventHash = createHash('sha256').update(serialized).digest('hex');

  const record: HcsAuditRecord = {
    topicId,
    sequenceNumber: inMemoryHcsLog.length + 1,
    eventHash,
    timestamp: new Date().toISOString(),
  };

  inMemoryHcsLog.push(record);
  return record;
}

export function getHcsAuditLog(): HcsAuditRecord[] {
  return [...inMemoryHcsLog];
}
