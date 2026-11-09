const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { googlePayConfig } = require('../lib/google_pay_config.cjs');
const { createPaymentStore } = require('../lib/payment_store.cjs');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/google-pay.js'), 'utf8');

test('disabled by default and cannot enable production', () => {
  assert.deepEqual(googlePayConfig({}), { enabled: false });
  assert.deepEqual(googlePayConfig({ GOOGLE_PAY_TEST_ENABLED: 'true', NODE_ENV: 'production' }), { enabled: false });
  assert.equal(googlePayConfig({ GOOGLE_PAY_TEST_ENABLED: 'true' }).environment, 'TEST');
});

function harness(config, { ready = true, error, failFetch = false } = {}) {
  const calls = [];
  let onClick;
  const element = () => ({ hidden: false, dataset: {}, isConnected: true, style: {},
    children: [], setAttribute() {}, appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; } });
  const container = element();
  const window = { google: { payments: { api: { PaymentsClient: class {
    constructor(options) { calls.push(['client', options]); }
    async isReadyToPay() { return { result: ready }; }
    createButton(options) { onClick = options.onClick; calls.push(['button', options]); return element(); }
    async loadPaymentData(request) { calls.push(['load', request]); if (error) throw error; return { token: 'never-persist' }; }
  } } } } };
  vm.runInNewContext(source, { window, document: { createElement: element },
    fetch: async () => { calls.push(['fetch']); if (failFetch) throw Error('offline'); return { ok: true, json: async () => config }; },
    setTimeout, clearTimeout });
  return { window, container, calls, click: () => onClick() };
}

test('hidden when configuration is missing, offline or production', async () => {
  for (const config of [{ enabled: false }, { enabled: true, environment: 'PRODUCTION' }]) {
    const h = harness(config);
    await h.window.OrlinxGooglePay.mount(h.container, 150);
    assert.equal(h.container.hidden, true);
    assert.equal(h.calls.length, 1);
  }
  const h = harness({}, { failFetch: true });
  await h.window.OrlinxGooglePay.mount(h.container, 150);
  assert.equal(h.container.hidden, true);
});

test('no button for unsupported browser or price without a fixed value', async () => {
  const h = harness({ enabled: true, environment: 'TEST' }, { ready: false });
  await h.window.OrlinxGooglePay.mount(h.container, 100);
  assert.equal(h.container.hidden, true);
  for (const price of [0, -1, NaN, Infinity, '100', 1000000]) {
    const invalid = harness({ enabled: true, environment: 'TEST' });
    await invalid.window.OrlinxGooglePay.mount(invalid.container, price);
    assert.equal(invalid.calls.length, 0);
  }
});

test('official test button opens sheet, never posts a token or reports payment', async () => {
  const h = harness({ enabled: true, environment: 'TEST', merchantName: 'ORLINX GROUP' });
  await h.window.OrlinxGooglePay.mount(h.container, 150);
  assert.equal(h.container.hidden, false);
  await h.click();
  const request = h.calls.find(([type]) => type === 'load')[1];
  assert.equal(request.transactionInfo.totalPrice, '150.00');
  assert.equal(request.transactionInfo.currencyCode, 'BRL');
  assert.equal(request.allowedPaymentMethods[0].tokenizationSpecification.parameters.gateway, 'example');
  assert.match(h.container.children[0].textContent, /Nenhum pagamento foi processado/);
  assert.equal(h.calls.filter(([type]) => type === 'fetch').length, 1);
  await h.window.OrlinxGooglePay.mount(h.container, 150);
  assert.equal(h.calls.filter(([type]) => type === 'button').length, 1);
});

test('cancellation and provider failure allow retry without reporting success', async () => {
  for (const error of [{ statusCode: 'CANCELED' }, new Error('failure')]) {
    const h = harness({ enabled: true, environment: 'TEST' }, { error });
    await h.window.OrlinxGooglePay.mount(h.container, 150);
    await h.click();
    await h.click();
    assert.match(h.container.children[0].textContent, /Nenhum valor foi cobrado/);
    assert.equal(h.calls.filter(([type]) => type === 'load').length, 2);
  }
});

const event = { id: 'b9aa23e9-4c03-4c30-b513-421fe75c330c', orderReference: 'ORX-123', provider: 'google_pay', environment: 'TEST', type: 'test_completed', amountCents: 15000 };
test('event storage parameterizes data and excludes tokens and personal fields', async () => {
  const calls = [];
  const store = createPaymentStore({ query: async (...args) => { calls.push(args); return { rows: [{ event_id: event.id }] }; } });
  assert.deepEqual(await store.append({ ...event, token: 'secret', cpf: 'secret' }), { inserted: true });
  assert.equal(calls[0][1].length, 6);
  assert.equal(JSON.stringify(calls).includes('secret'), false);
  await assert.rejects(store.append({ ...event, amountCents: 1.5 }), /Invalid/);
  await assert.rejects(store.append({ ...event, environment: 'PRODUCTION' }), /Invalid/);
});

test('duplicate event is idempotent; conflicting duplicate fails closed', async () => {
  let n = 0;
  const store = createPaymentStore({ query: async () => ({ rows: ++n === 2 ? [{ event_id: event.id }] : [] }) });
  assert.deepEqual(await store.append(event), { inserted: false });
  await assert.rejects(store.append(event), /idempotency conflict/);
});
