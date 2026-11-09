const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createPaymentStore } = require('../lib/payment_store.cjs');

async function main() {
  if (process.env.PAYMENTS_MIGRATION_BRANCH !== 'br-falling-heart-b6tx4els') {
    throw new Error('Only the designated Neon test branch is allowed');
  }
  const connectionString = process.env.PAYMENTS_DATABASE_URL;
  if (!connectionString) throw new Error('PAYMENTS_DATABASE_URL required');
  const url = new URL(connectionString);
  if (url.hostname.includes('-pooler')) throw new Error('Direct migration connection required');
  if (url.hostname !== process.env.PAYMENTS_MIGRATION_HOST) throw new Error('Unexpected migration host');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const migration = fs.readFileSync(path.join(__dirname, '../db/neon/001_payment_events.sql'), 'utf8');
    await client.query(migration);
    await client.query(migration);
    const store = createPaymentStore(client);
    const event = { id: 'd8166ec5-43eb-49f1-bd36-a0987a151801', orderReference: 'ORX-TEST-GPAY-PREPARATION',
      provider: 'google_pay', environment: 'TEST', type: 'test_completed', amountCents: 100 };
    await store.append(event);
    assert.deepEqual(await store.append(event), { inserted: false });
    await assert.rejects(store.append({ ...event, amountCents: 200 }), /idempotency conflict/);
    await assert.rejects(client.query('DELETE FROM orlinx_payments.events WHERE event_id=$1', [event.id]), /append-only/);
    await assert.rejects(client.query('UPDATE orlinx_payments.events SET amount_cents=2 WHERE event_id=$1', [event.id]), /append-only/);
    await assert.rejects(client.query('TRUNCATE orlinx_payments.events'), /append-only/);
    console.log('PASS: migration twice, persistent TEST event, idempotency, conflict, UPDATE/DELETE/TRUNCATE blocked');
  } finally { await client.end(); }
}
main().catch(() => { console.error('Neon validation failed; no credentials or event data logged.'); process.exitCode = 1; });
