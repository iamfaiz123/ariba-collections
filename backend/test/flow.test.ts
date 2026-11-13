/**
 * End-to-end test of the whole order + payment flow against a real Postgres, with the mock
 * gateway and console WhatsApp. Covers every failure path the payment design promises to handle.
 *
 *   TEST_DATABASE_URL=postgres://… npm test     (the database is wiped first — never point it at real data)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://aribas:aribas@127.0.0.1:5432/aribas_test';
process.env.PORT = '4999';
process.env.ADMIN_PHONES = '9000000001';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.WHATSAPP_PROVIDER = 'console';
if (!/test/.test(process.env.DATABASE_URL)) throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name');

const { pool, query, one } = await import('../src/lib/db.js');
const { migrate } = await import('../src/db/migrate.js');
const { startQueue, stopQueue, queue, Q } = await import('../src/lib/queue.js');
const { buildApp } = await import('../src/app.js');
const { consoleOutbox } = await import('../src/lib/whatsapp.js');
const { mockGateway } = await import('../src/services/payments/provider.js');
const { reconcile } = await import('../src/services/payments/index.js');

const BASE = 'http://127.0.0.1:4999';
let app: Awaited<ReturnType<typeof buildApp>>;

async function api(method: string, path: string, opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data: data as any, headers: res.headers };
}

async function waitFor<T>(what: string, fn: () => Promise<T | undefined | null | false>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for: ${what}`);
}

async function login(phone: string, headers: Record<string, string> = {}) {
  const r1 = await api('POST', '/api/auth/otp/request', { body: { phone } });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  const r2 = await api('POST', '/api/auth/otp/verify', { body: { phone, code: r1.data.devCode, name: 'Test ' + phone.slice(-2) }, headers });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  return r2.data as { accessToken: string; user: any };
}

const orderOf = (id: string) => one('SELECT * FROM users.orders WHERE id = $1', [id]);
const stockOf = async (productId: string, size: string) => (await one('SELECT stock FROM products.variants WHERE product_id = $1 AND size = $2', [productId, size])).stock;

let admin: string;
let alice: { accessToken: string; user: any };
let bob: { accessToken: string; user: any };
let productId: string;
let aliceAddress: string;
let bobAddress: string;

async function checkout(token: string, addressId: string, size = 'S', qty = 1, extra: Record<string, string> = {}) {
  const add = await api('POST', '/api/cart/items', { token, body: { productId, size, qty, color: 'Maroon' } });
  assert.equal(add.status, 200, JSON.stringify(add.data));
  const r = await api('POST', '/api/orders/checkout', { token, body: { addressId, shippingMethod: 'standard' }, headers: extra });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data as { order: any; payment: any };
}

before(async () => {
  for (const s of ['products', 'cart', 'users', 'payments', 'pgboss']) await pool.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
  await pool.query('DROP TABLE IF EXISTS public.schema_migrations');
  await migrate(() => {});
  await startQueue();
  app = await buildApp({ services: ['users', 'products', 'cart', 'payments'], workers: true, logger: false });
  await app.listen({ port: 4999, host: '127.0.0.1' });
});

after(async () => {
  await app.close();
  await stopQueue();
  await pool.end();
});

test('login with WhatsApp OTP: wrong code, attempts, admin role', async () => {
  const req = await api('POST', '/api/auth/otp/request', { body: { phone: '9000000001' } });
  assert.equal(req.status, 200);
  assert.equal(consoleOutbox.at(-1)!.to, '+919000000001');
  assert.deepEqual(consoleOutbox.at(-1)!.params, ['******'], 'OTP must never be logged');
  const again = await api('POST', '/api/auth/otp/request', { body: { phone: '9000000001' } });
  assert.equal(again.status, 429, 'resend cooldown');
  const wrong = await api('POST', '/api/auth/otp/verify', { body: { phone: '9000000001', code: req.data.devCode === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);
  assert.match(wrong.data.error.message, /4 attempts left/);
  const ok = await api('POST', '/api/auth/otp/verify', { body: { phone: '+91 90000 00001', code: req.data.devCode } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  assert.match(ok.headers.get('set-cookie') ?? '', /aribas_rt=.*HttpOnly/i);
  const reuse = await api('POST', '/api/auth/otp/verify', { body: { phone: '9000000001', code: req.data.devCode } });
  assert.equal(reuse.status, 400, 'a code works once');
  admin = ok.data.accessToken;

  const bad = await api('POST', '/api/auth/otp/request', { body: { phone: '12345' } });
  assert.equal(bad.status, 400);

  // refresh-token rotation
  const cookie = (ok.headers.get('set-cookie') ?? '').split(';')[0];
  const ref = await api('POST', '/api/auth/refresh', { headers: { cookie } });
  assert.equal(ref.status, 200);
  const replay = await api('POST', '/api/auth/refresh', { headers: { cookie } });
  assert.equal(replay.status, 401, 'old refresh token is dead after rotation');
});

test('admin sets up a product and coupon; customers cannot', async () => {
  const p = await api('POST', '/api/admin/products', {
    token: admin,
    body: { slug: 'test-kurti', name: 'Test Kurti', category: 'kurtis', price: 1500, mrp: 2000, colors: [{ name: 'Maroon', hex: '#6E0F1C' }], images: ['/products/test/1.jpg'], stock: { S: 6, M: 1 } },
  });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  productId = p.data.id;
  assert.deepEqual(p.data.sizes, ['S', 'M']);
  const c = await api('PUT', '/api/admin/coupons/ARIBAS10', { token: admin, body: { kind: 'percent', value: 10, description: '10% off' } });
  assert.equal(c.status, 200, JSON.stringify(c.data));

  bob = await login('9000000003');
  const denied = await api('POST', '/api/admin/products', { token: bob.accessToken, body: {} });
  assert.equal(denied.status, 403);
  const list = await api('GET', '/api/products?category=kurtis');
  assert.equal(list.data.total, 1);
  assert.equal(list.data.items[0].price, 1500);
});

test('guest cart merges into account on login; server prices with coupon', async () => {
  const add = await api('POST', '/api/cart/items', { body: { productId, size: 'S', qty: 1, color: 'Maroon' } });
  assert.equal(add.status, 200);
  const cartId = add.data.cartId;
  const coupon = await api('POST', '/api/cart/coupon', { body: { code: 'aribas10' }, headers: { 'x-cart-id': cartId } });
  assert.equal(coupon.status, 200, JSON.stringify(coupon.data));
  assert.equal(coupon.data.discount, 150);
  assert.equal(coupon.data.shippingFee, 99, '₹1,350 after discount is below free shipping');
  assert.equal(coupon.data.total, 1449);

  alice = await login('9000000002', { 'x-cart-id': cartId });
  const cart = await api('GET', '/api/cart', { token: alice.accessToken });
  assert.equal(cart.data.items.length, 1);
  assert.equal(cart.data.coupon, 'ARIBAS10');

  const a = await api('POST', '/api/me/addresses', { token: alice.accessToken, body: { fullName: 'Alice A', phone: '9000000002', line1: '12 MG Road', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' } });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(a.data.isDefault, true);
  aliceAddress = a.data.id;
  const b = await api('POST', '/api/me/addresses', { token: bob.accessToken, body: { fullName: 'Bob B', phone: '9000000003', line1: '5 Park St', city: 'Kolkata', state: 'West Bengal', pincode: '700016' } });
  bobAddress = b.data.id;
});

test('happy path: checkout → pay → webhook → confirmed, receipt PDF, WhatsApp, cart cleared', async () => {
  const before = await stockOf(productId, 'S');
  const r = await api('POST', '/api/orders/checkout', { token: alice.accessToken, body: { addressId: aliceAddress }, headers: { 'idempotency-key': 'alice-checkout-1' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const { order, payment } = r.data;
  assert.equal(order.status, 'pending_payment');
  assert.equal(order.total, 1449);
  assert.equal(payment.amountPaise, 144900);
  assert.equal(await stockOf(productId, 'S'), before - 1, 'stock is held at checkout');

  // Double-click: same idempotency key → same order, same gateway order.
  const again = await api('POST', '/api/orders/checkout', { token: alice.accessToken, body: { addressId: aliceAddress }, headers: { 'idempotency-key': 'alice-checkout-1' } });
  assert.equal(again.data.order.id, order.id);
  assert.equal(again.data.payment.providerOrderId, payment.providerOrderId);

  const paid = await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: payment.providerOrderId } });
  assert.equal(paid.status, 200);
  // The browser callback arrives too — must not double-process.
  const verify = await api('POST', '/api/payments/verify', { token: alice.accessToken, body: paid.data });
  assert.equal(verify.status, 200);

  const o = await waitFor('order confirmed', async () => ((await orderOf(order.id))?.status === 'confirmed' ? orderOf(order.id) : null));
  assert.equal(o.payment_status, 'paid');
  assert.equal(o.payment_method, 'upi');
  await waitFor('receipt PDF', async () => (await one('SELECT pdf IS NOT NULL AS ok FROM users.receipts WHERE order_id = $1', [order.id]))?.ok);
  const msg = await waitFor('WhatsApp receipt', async () => consoleOutbox.find((m) => m.document && m.params.includes(order.number)));
  assert.equal(msg.to, '+919000000002');
  assert.equal(msg.params[2], 'Rs. 1,449.00');

  const pdf = await api('GET', `/api/orders/${order.id}/receipt`, { token: alice.accessToken });
  assert.equal(pdf.status, 200);
  assert.equal((pdf.data as Buffer).subarray(0, 4).toString(), '%PDF');
  const stranger = await api('GET', `/api/orders/${order.id}/receipt`, { token: bob.accessToken });
  assert.equal(stranger.status, 404, "another customer can't fetch it");

  const mine = await api('GET', `/api/orders/${order.id}`, { token: alice.accessToken });
  assert.match(mine.data.receipt.number, /^ARB\/\d{4}-\d{2}\/00001$/);
  await waitFor('cart cleared', async () => (await api('GET', '/api/cart', { token: alice.accessToken })).data.items.length === 0);
  const res = (await query(`SELECT count(*)::int AS n FROM payments.transactions`))[0].n;
  assert.equal(res, 1);
});

test('webhook redelivery and bad signatures are harmless', async () => {
  const pay = await one(`SELECT * FROM payments.payments WHERE status = 'captured' LIMIT 1`);
  const gp = mockGateway.payments.get(pay.provider_payment_id)!;
  const wh = mockGateway.webhook('payment.captured', { payment: gp });
  for (let i = 0; i < 3; i++) {
    const r = await api('POST', '/api/payments/webhook', { body: JSON.parse(wh.body), headers: { 'x-razorpay-signature': wh.signature, 'x-razorpay-event-id': wh.eventId } });
    assert.equal(r.status, 200);
  }
  const forged = await api('POST', '/api/payments/webhook', { body: JSON.parse(wh.body), headers: { 'x-razorpay-signature': 'deadbeef', 'x-razorpay-event-id': 'evt_forged' } });
  assert.equal(forged.status, 400);
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal((await one(`SELECT count(*)::int AS n FROM users.receipts`)).n, 1, 'still exactly one receipt');
  assert.equal((await one(`SELECT count(*)::int AS n FROM users.notifications WHERE kind = 'receipt'`)).n, 1, 'still exactly one WhatsApp');
});

test('customer pays twice for one order → second payment refunded automatically', async () => {
  const pay = await one(`SELECT * FROM payments.payments WHERE status = 'captured' LIMIT 1`);
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: pay.provider_order_id } });
  const refund = await waitFor('duplicate refunded', async () => one(`SELECT * FROM payments.refunds WHERE key LIKE 'duplicate:%' AND status = 'processed'`));
  assert.equal(refund.amount_paise, pay.amount_paise);
  await new Promise((r) => setTimeout(r, 800));
  const o = await orderOf(pay.order_id);
  assert.equal(o.status, 'confirmed');
  assert.equal(o.payment_status, 'paid', "a duplicate's refund doesn't change the order");
});

test('webhook never arrives and the tab was closed → reconciliation confirms it', async () => {
  const { order, payment } = await checkout(alice.accessToken, aliceAddress);
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: payment.providerOrderId, sendWebhook: false } });
  await new Promise((r) => setTimeout(r, 800));
  assert.equal((await orderOf(order.id)).status, 'pending_payment');
  const p = await one('SELECT id FROM payments.payments WHERE order_id = $1', [order.id]);
  await reconcile(p.id);
  await waitFor('confirmed by poller', async () => (await orderOf(order.id)).status === 'confirmed');
});

test('gateway down when the browser returns → "processing", then confirmed once it recovers', async () => {
  const { order, payment } = await checkout(alice.accessToken, aliceAddress);
  const paid = await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: payment.providerOrderId, sendWebhook: false } });
  mockGateway.down = true;
  const v = await api('POST', '/api/payments/verify', { token: alice.accessToken, body: paid.data });
  assert.equal(v.data.status, 'processing');
  const tampered = await api('POST', '/api/payments/verify', { token: alice.accessToken, body: { ...paid.data, razorpay_signature: 'x'.repeat(64) } });
  assert.equal(tampered.status, 400);
  mockGateway.down = false;
  const p = await one('SELECT id FROM payments.payments WHERE order_id = $1', [order.id]);
  await reconcile(p.id);
  await waitFor('confirmed after outage', async () => (await orderOf(order.id)).status === 'confirmed');
});

test('gateway down at checkout → order saved, customer can pay again later', async () => {
  mockGateway.down = true;
  await api('POST', '/api/cart/items', { token: bob.accessToken, body: { productId, size: 'S', qty: 1 } });
  const r = await api('POST', '/api/orders/checkout', { token: bob.accessToken, body: { addressId: bobAddress } });
  mockGateway.down = false;
  assert.equal(r.status, 201);
  assert.equal(r.data.payment, null);
  assert.ok(r.data.paymentError);
  const retry = await api('POST', `/api/orders/${r.data.order.id}/pay`, { token: bob.accessToken });
  assert.equal(retry.status, 200, JSON.stringify(retry.data));
  // Bob gives up: cancel the unpaid order → stock goes back.
  const before = await stockOf(productId, 'S');
  const c = await api('POST', `/api/orders/${r.data.order.id}/cancel`, { token: bob.accessToken, body: {} });
  assert.equal(c.data.status, 'cancelled');
  assert.equal(await stockOf(productId, 'S'), before + 1);
  // …but pays in an old tab anyway → refunded, not confirmed.
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: retry.data.payment.providerOrderId } });
  await waitFor('refund for paid-after-cancel', async () => one(`SELECT 1 FROM payments.refunds WHERE key = $1 AND status = 'processed'`, [`paid-after-cancel:${r.data.order.id}`]));
  await waitFor('order marked refunded', async () => (await orderOf(r.data.order.id)).payment_status === 'refunded');
  assert.equal((await orderOf(r.data.order.id)).status, 'cancelled');
});

test('payment after the hold expired: confirmed if stock remains, refunded if it sold out', async () => {
  // Still in stock (size S).
  const a = await checkout(alice.accessToken, aliceAddress, 'S');
  await query(`UPDATE users.orders SET expires_at = now() - interval '1 minute' WHERE id = $1`, [a.order.id]);
  await queue().send(Q.expireOrders, {});
  await waitFor('expired', async () => (await orderOf(a.order.id)).cancel_reason === 'payment_timeout');
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: a.payment.providerOrderId } });
  await waitFor('late payment confirmed', async () => (await orderOf(a.order.id)).status === 'confirmed');

  // Size M has 1 piece: Alice's hold expires, Bob buys it, then Alice pays.
  const late = await checkout(alice.accessToken, aliceAddress, 'M');
  await query(`UPDATE users.orders SET expires_at = now() - interval '1 minute' WHERE id = $1`, [late.order.id]);
  await queue().send(Q.expireOrders, {});
  await waitFor('expired', async () => (await orderOf(late.order.id)).cancel_reason === 'payment_timeout');
  assert.equal(await stockOf(productId, 'M'), 1, 'hold released');
  const bobs = await checkout(bob.accessToken, bobAddress, 'M');
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: bobs.payment.providerOrderId } });
  await waitFor('bob confirmed', async () => (await orderOf(bobs.order.id)).status === 'confirmed');
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: late.payment.providerOrderId } });
  const o = await waitFor('alice refunded', async () => ((await orderOf(late.order.id)).payment_status === 'refunded' ? orderOf(late.order.id) : null));
  assert.equal(o.status, 'cancelled');
  assert.ok(o.needs_attention);
  assert.equal(await stockOf(productId, 'M'), 0, 'never oversold');
});

test('checkout refuses when the bag has a sold-out item', async () => {
  await query(`DELETE FROM cart.items`);
  const added = await api('POST', '/api/cart/items', { token: alice.accessToken, body: { productId, size: 'S', qty: 1 } });
  assert.equal(added.status, 200, JSON.stringify(added.data));
  await query(`UPDATE products.variants SET stock = 0 WHERE product_id = $1 AND size = 'S'`, [productId]);
  const r = await api('POST', '/api/orders/checkout', { token: alice.accessToken, body: { addressId: aliceAddress } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.error.code, 'cart_changed');
  await query(`UPDATE products.variants SET stock = 5 WHERE product_id = $1 AND size = 'S'`, [productId]);
  await query(`DELETE FROM cart.items`);
});

test('cancel a paid order before shipping → full refund + restock', async () => {
  const { order, payment } = await checkout(alice.accessToken, aliceAddress, 'S');
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: payment.providerOrderId } });
  await waitFor('confirmed', async () => (await orderOf(order.id)).status === 'confirmed');
  const before = await stockOf(productId, 'S');
  const c = await api('POST', `/api/orders/${order.id}/cancel`, { token: alice.accessToken, body: { reason: 'Ordered wrong size' } });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.equal(await stockOf(productId, 'S'), before + 1);
  await waitFor('refunded', async () => (await orderOf(order.id)).payment_status === 'refunded');
});

test('shipping, delivery, return within 7 days → refund to original payment; reviews only after delivery', async () => {
  const { order, payment } = await checkout(alice.accessToken, aliceAddress, 'S', 2);
  await api('POST', '/api/payments/mock/pay', { body: { providerOrderId: payment.providerOrderId } });
  await waitFor('confirmed', async () => (await orderOf(order.id)).status === 'confirmed');

  const early = await api('POST', '/api/reviews', { token: alice.accessToken, body: { productId, rating: 5 } });
  // Alice has no delivered order yet.
  assert.equal(early.status, 409);

  const shipped = await api('PATCH', `/api/admin/orders/${order.id}/status`, { token: admin, body: { status: 'shipped', tracking: { courier: 'Delhivery', awb: '123' } } });
  assert.equal(shipped.status, 200, JSON.stringify(shipped.data));
  const cancelShipped = await api('POST', `/api/orders/${order.id}/cancel`, { token: alice.accessToken, body: {} });
  assert.equal(cancelShipped.status, 409);
  const back = await api('PATCH', `/api/admin/orders/${order.id}/status`, { token: admin, body: { status: 'packed' } });
  assert.equal(back.status, 409, 'status only moves forward');
  await api('PATCH', `/api/admin/orders/${order.id}/status`, { token: admin, body: { status: 'delivered' } });

  const detail = await api('GET', `/api/orders/${order.id}`, { token: alice.accessToken });
  assert.equal(detail.data.canReturn, true);
  const item = detail.data.items[0];
  const tooMany = await api('POST', `/api/orders/${order.id}/returns`, { token: alice.accessToken, body: { items: [{ itemId: item.id, qty: 3 }], reason: 'Too big' } });
  assert.equal(tooMany.status, 400);
  const ret = await api('POST', `/api/orders/${order.id}/returns`, { token: alice.accessToken, body: { items: [{ itemId: item.id, qty: 1 }], reason: 'Too big' } });
  assert.equal(ret.status, 201, JSON.stringify(ret.data));
  assert.equal(ret.data.refund, 1500, 'price of one item (no coupon on this order)');

  await api('PATCH', `/api/admin/returns/${ret.data.id}`, { token: admin, body: { action: 'approve' } });
  await api('PATCH', `/api/admin/returns/${ret.data.id}`, { token: admin, body: { action: 'received' } });
  await waitFor('return refunded', async () => (await one('SELECT status FROM users.returns WHERE id = $1', [ret.data.id])).status === 'refunded');
  const o = await orderOf(order.id);
  assert.equal(o.payment_status, 'partially_refunded');
  assert.equal(o.refunded_paise, 150000);

  const rev = await api('POST', '/api/reviews', { token: alice.accessToken, body: { productId, rating: 4, title: 'Lovely', body: 'Fabric is soft.' } });
  assert.equal(rev.status, 201, JSON.stringify(rev.data));
  const pub = await api('GET', `/api/reviews?productId=${productId}`);
  assert.equal(pub.data.count, 1);
  assert.equal(pub.data.average, 4);

  // Return window closes after 7 days.
  await query(`UPDATE users.orders SET delivered_at = now() - interval '8 days' WHERE id = $1`, [order.id]);
  const late = await api('POST', `/api/orders/${order.id}/returns`, { token: alice.accessToken, body: { items: [{ itemId: item.id, qty: 1 }], reason: 'Changed mind' } });
  assert.equal(late.status, 409);
});

test("admin sees a customer's orders, receipts and payment history", async () => {
  const users = await api('GET', '/api/admin/users?q=9000000002', { token: admin });
  assert.equal(users.data.items.length, 1);
  const detail = await api('GET', `/api/admin/users/${users.data.items[0].id}`, { token: admin });
  assert.ok(detail.data.orders.length >= 5);
  const withReceipt = detail.data.orders.find((o: any) => o.receipt);
  const pdf = await api('GET', `/api/admin/orders/${withReceipt.id}/receipt`, { token: admin });
  assert.equal((pdf.data as Buffer).subarray(0, 4).toString(), '%PDF');
  const od = await waitFor('receipt WhatsApp sent', async () => {
    const r = await api('GET', `/api/admin/orders/${withReceipt.id}`, { token: admin });
    return r.data.notifications.some((n: any) => n.kind === 'receipt' && n.status === 'sent') && r;
  });
  assert.ok(od.data.payments[0].attempts.length >= 1);
  const resend = await api('POST', `/api/admin/orders/${withReceipt.id}/resend-receipt`, { token: admin });
  assert.equal(resend.status, 200);
  await waitFor('resent', async () => (await query(`SELECT 1 FROM users.notifications WHERE order_id = $1 AND kind = 'receipt'`, [withReceipt.id])).length === 2);
  const overview = await api('GET', '/api/admin/overview', { token: admin });
  assert.ok(overview.data.orders_today >= 5);
  const forbidden = await api('GET', '/api/admin/users', { token: alice.accessToken });
  assert.equal(forbidden.status, 403);
  // Internal routes need the internal token.
  const internal = await api('POST', '/internal/products/quote', { body: { items: [] } });
  assert.equal(internal.status, 403);
});
