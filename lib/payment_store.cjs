const TYPES = new Set(['test_completed', 'charge_created', 'payment_confirmed', 'payment_failed', 'payment_refunded']);
function createPaymentStore(client) {
  if (typeof client?.query !== 'function') throw new TypeError('Postgres client required');
  return {
    async append(event) {
      if (!event || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.id) ||
          typeof event.orderReference !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(event.orderReference) ||
          !['google_pay', 'woovi'].includes(event.provider) || !['TEST', 'PRODUCTION'].includes(event.environment) ||
          !TYPES.has(event.type) || (event.type === 'test_completed' && event.environment !== 'TEST') ||
          !Number.isSafeInteger(event.amountCents) || event.amountCents <= 0 || event.amountCents > 99999999) {
        throw new TypeError('Invalid payment event');
      }
      const values = [event.id, event.orderReference, event.provider, event.environment, event.type, event.amountCents];
      const result = await client.query(
        `INSERT INTO orlinx_payments.events (event_id, order_reference, provider, environment, event_type, amount_cents)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`, values);
      if (result.rows.length) return { inserted: true };
      const existing = await client.query(
        `SELECT event_id FROM orlinx_payments.events WHERE event_id=$1 AND order_reference=$2
         AND provider=$3 AND environment=$4 AND event_type=$5 AND amount_cents=$6`, values);
      if (!existing.rows.length) throw new Error('Payment event idempotency conflict');
      return { inserted: false };
    }
  };
}
module.exports = { createPaymentStore };
