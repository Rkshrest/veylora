import { createHash } from 'node:crypto';
import { AuditEntry } from './models.js';

async function appendAuditInOrder({ entityId, action, actor, actorId = null, payload = {} }) {
  const last = await AuditEntry.findOne().sort({ sequence: -1 }).lean();
  const entry = { sequence: (last?.sequence ?? 0) + 1, entityId: String(entityId), action, actor, actorId: actorId ? String(actorId) : null,
    timestamp: new Date(), payload, previousHash: last?.hash ?? 'GENESIS' };
  entry.hash = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
  return AuditEntry.create(entry);
}

// Keep sequence assignment and hash linkage ordered within this API process.
let auditQueue = Promise.resolve();
export function appendAudit(event) {
  const write = auditQueue.then(() => appendAuditInOrder(event));
  auditQueue = write.catch(() => {});
  return write;
}

export async function verifyAuditChain() {
  const entries = await AuditEntry.find().sort({ sequence: 1 }).lean();
  let previousHash = 'GENESIS';
  for (let i = 0; i < entries.length; i++) {
    const { hash, _id, __v, ...content } = entries[i];
    const expected = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    if (entries[i].sequence !== i + 1 || entries[i].previousHash !== previousHash || hash !== expected) {
      return { valid: false, checkedEntries: i + 1, brokenAt: entries[i].sequence };
    }
    previousHash = hash;
  }
  return { valid: true, checkedEntries: entries.length, head: previousHash };
}
