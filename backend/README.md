# Aribas backend

Node.js + TypeScript (Fastify), PostgreSQL, and a Postgres-backed job queue (pg-boss). The four services run in **one process** for now. Each one is a separate module with its own database schema, so it can move to its own machine later without code changes.

| Service | Owns | Routes |
|---|---|---|
| **users** | WhatsApp OTP login, profile, addresses, orders, PDF receipts, returns, reviews, admin | `/api/auth/*`, `/api/me*`, `/api/orders*`, `/api/returns`, `/api/reviews*`, `/api/admin/{overview,users,orders,returns,reviews}` |
| **products** | Catalogue, stock per size, stock holds | `/api/products*`, `/api/admin/products*` |
| **cart** | Guest and user carts, coupons, server-side pricing | `/api/cart*`, `/api/admin/coupons*` |
| **payments** | Razorpay orders, verification, webhooks, reconciliation, refunds | `/api/payments/*`, `/api/admin/{payments,refunds}*` |

Services call each other only through `/internal/*` HTTP routes (guarded by `INTERNAL_TOKEN`) or through queue events, never by reading each other's tables.

## Run locally

```bash
cd backend
docker compose up -d            # Postgres on :5432 (also creates aribas_test)
cp .env.example .env            # defaults work: mock payments + WhatsApp printed to the console
npm install
npm run seed -- --demo          # coupons + one demo product
npm run dev                     # http://localhost:4000

# storefront against it:
cd ../frontend && VITE_API_URL=http://localhost:4000 npm run dev
```

**Test mode** (no keys needed):
- **Login:** the OTP shows on the login screen.
- **Payment:** a "Test payment" dialog with Pay / Fail replaces Razorpay.
- **WhatsApp messages:** printed in the API log.

Put your own number in `ADMIN_PHONES` to open `/admin`.

**Tests:** `TEST_DATABASE_URL=postgres://aribas:aribas@127.0.0.1:5432/aribas_test npm test` runs the full order and payment flow, including every failure case below. The test database is wiped on every run.

## How payment works

1. **Checkout.** The users service reprices the cart through the cart service; browser prices are never trusted. It then creates the order (`pending_payment`) and holds the stock for 30 minutes (`ORDER_HOLD_MINUTES`).
2. **Payment.** The payments service creates a Razorpay order for the exact amount, and the browser opens Razorpay Checkout.
3. **Confirmation.** Any one of three paths confirms the payment, and all three go through the same idempotent `recordCapture()`:
   - the browser's signed callback (`POST /api/payments/verify`)
   - the Razorpay webhook (`POST /api/payments/webhook`)
   - a reconciliation poll every 5 minutes, which asks Razorpay about every unfinished payment from the last 48 hours
4. **Follow-up.** In the same database transaction as "captured", a `payments.captured` job is queued. The users service then:
   - confirms the order and assigns a receipt number (`ARB/2026-27/00001`);
   - builds the PDF and stores it in Postgres;
   - sends it on WhatsApp;
   - clears the purchased items from the cart.

   Each step retries with backoff, for up to about 12 attempts. Jobs that still fail land in a `*.dead` queue and show up in admin.

| What goes wrong | What happens |
|---|---|
| Customer closes the tab after paying | The webhook or the poller confirms the order anyway. |
| Webhooks are lost, or our server is down | Razorpay retries for 24 hours, and the poller catches anything left. |
| A webhook arrives several times | It's stored once by event ID, and capture is idempotent. |
| Customer pays twice | The second payment is refunded automatically. |
| Payment arrives after the hold expired | The order is confirmed if stock is left. Otherwise it's refunded automatically and flagged. |
| Customer cancels, then pays in an old tab | Refunded automatically. |
| Razorpay is down at checkout | The order is saved, and the customer presses Pay again later. A circuit breaker fails fast. |
| Razorpay is down when the browser returns | "Confirming…" is shown, and the poller finishes once Razorpay is back. |
| Amount paid ≠ order amount | Not confirmed. The payment is marked `attention` for admin. |
| PDF or WhatsApp fails | The order stays confirmed, and only that step retries. Admin can resend. |
| A refund is rejected by Razorpay | Flagged in admin → Overview, with a Retry button. |

**Refunds:**
- Cancelling a paid order before it ships gives a full refund and puts the stock back.
- Returns are accepted within 7 days of delivery (`RETURN_WINDOW_DAYS`). When admin marks the item **received**, the money goes back to the original payment method.
- The return refund covers the item price minus its share of any coupon discount. Shipping isn't refunded.
- Every refund has a unique key, and before any retry the server checks Razorpay for that key, so money is never refunded twice.

**Receipts** are payment receipts, not GST tax invoices. Once you're GST-registered, add your GSTIN and HSN codes in `src/services/users/receipt.ts`.

## Going live: what to fill in `.env`

1. **Generate secrets:** `openssl rand -base64 48`, once for `JWT_SECRET` and once for `INTERNAL_TOKEN`.
2. **Razorpay** (dashboard.razorpay.com):
   - API Keys → `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Start with `rzp_test_` keys.
   - Webhooks → add `https://<api-host>/api/payments/webhook`, choose a secret (→ `RAZORPAY_WEBHOOK_SECRET`), and tick these events: `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
   - Leave payment **auto-capture** on (the default).
   - Set `PAYMENT_PROVIDER=razorpay`.
3. **WhatsApp Cloud API** (developers.facebook.com → your app → WhatsApp):
   - Verify your business and add your number. Get `WHATSAPP_TOKEN` (a permanent System User token) and `WHATSAPP_PHONE_NUMBER_ID`. Set `WHATSAPP_PROVIDER=meta`.
   - Create these templates in WhatsApp Manager and wait for approval (usually minutes):
     - `aribas_login_otp`: category **Authentication**, with a "copy code" button.
     - `aribas_order_receipt`: category **Utility**, with a **Document** header. Body, for example: `Hi {{1}}, thank you for shopping with Aribas! Your order {{2}} of {{3}} is confirmed. Your receipt is attached.`
     - Optional:
       - `WHATSAPP_REFUND_TEMPLATE` (body variables: name, amount, order number)
       - `WHATSAPP_SHIPPED_TEMPLATE` (body variables: name, order number, courier + AWB, tracking link)
4. **Rest of the config:**
   - `ADMIN_PHONES`
   - `CORS_ORIGINS`: your storefront URL(s)
   - `BUSINESS_ADDRESS`, `BUSINESS_PHONE`, `BUSINESS_EMAIL`: printed on receipts
   - `DATABASE_URL` and `DATABASE_SSL=true` for hosted Postgres

In production the server **refuses to start** if any of these are missing or still use test values.

## Deploying (Render)

- **Web service:** Root Directory `backend`, Build `npm ci && npm run build`, Start `npm start`, Health check `/health/ready`. Migrations run automatically on start.
- **Postgres:** a Render Postgres instance. Use its *internal* URL as `DATABASE_URL`.
- **Storefront:** set `VITE_API_URL=https://<api-host>` on the static site, then redeploy it.
- **Use a paid instance.** On the free plan the server sleeps, which delays webhooks and the payment poller.

**Splitting later:**
1. Deploy the same build again with, for example, `SERVICES=payments`.
2. Set `SERVICES=users,products,cart` on the original service.
3. Point the others at the new service: `PAYMENTS_URL=https://…`.
4. Route `/api/payments/*` to it.

`RUN_WORKERS=false` runs an instance that serves only API traffic.

## Layout

```
src/
  main.ts                 starts the services listed in SERVICES, runs migrations, graceful shutdown
  app.ts                  Fastify setup, errors, CORS, raw body for webhook signatures, /health
  config.ts               every env var, validated; production safety checks
  db/migrations/*.sql     schema (one Postgres schema per service)
  lib/                    db, queue (pg-boss), auth (JWT), internal clients, WhatsApp, fetch with retries
  services/
    products/             catalogue + stock holds
    cart/                 carts, coupons, pricing
    users/                auth, orders (+ queue handlers), receipt PDF, reviews, admin
    payments/             provider.ts (Razorpay + mock), index.ts (verify, webhook, reconcile, refunds)
test/flow.test.ts         end-to-end order and payment tests
```
