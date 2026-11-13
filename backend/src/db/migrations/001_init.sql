-- One Postgres schema per service. A service only reads and writes its own schema;
-- anything else goes through internal HTTP calls or queue events.
-- Money is stored in paise (integer), like Razorpay.

CREATE SCHEMA IF NOT EXISTS products;
CREATE SCHEMA IF NOT EXISTS cart;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS payments;

-- ───────────────────────── products ─────────────────────────
CREATE TABLE products.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  category      text NOT NULL,
  fabric        text NOT NULL DEFAULT '',
  occasion      text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  highlights    jsonb NOT NULL DEFAULT '[]',
  includes      jsonb NOT NULL DEFAULT '[]',
  care          jsonb NOT NULL DEFAULT '[]',
  colors        jsonb NOT NULL DEFAULT '[]',
  images        jsonb NOT NULL DEFAULT '[]',
  video         text,
  price_paise   integer NOT NULL CHECK (price_paise > 0),
  mrp_paise     integer NOT NULL CHECK (mrp_paise >= price_paise),
  is_new        boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON products.products (category) WHERE active;

-- One row per size; stock is what can still be sold (held stock is already subtracted).
CREATE TABLE products.variants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products.products(id) ON DELETE CASCADE,
  size       text NOT NULL,
  stock      integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, size)
);

-- Stock held for an unpaid order. held → committed (paid) | released (expired/cancelled);
-- committed → restocked (cancelled after payment).
CREATE TABLE products.reservations (
  order_id   uuid NOT NULL,
  variant_id uuid NOT NULL REFERENCES products.variants(id),
  qty        integer NOT NULL CHECK (qty > 0),
  status     text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'committed', 'released', 'restocked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, variant_id)
);
CREATE INDEX ON products.reservations (expires_at) WHERE status = 'held';

-- ───────────────────────── cart ─────────────────────────
CREATE TABLE cart.carts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid UNIQUE,
  coupon_code text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart.items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    uuid NOT NULL REFERENCES cart.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  size       text NOT NULL,
  color      text NOT NULL DEFAULT '',
  qty        integer NOT NULL CHECK (qty BETWEEN 1 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id, size, color)
);

CREATE TABLE cart.coupons (
  code               text PRIMARY KEY,
  description        text NOT NULL DEFAULT '',
  kind               text NOT NULL CHECK (kind IN ('percent', 'flat')),
  -- percent: 1–90; flat: paise
  value              integer NOT NULL CHECK (value > 0),
  min_subtotal_paise integer NOT NULL DEFAULT 0,
  active             boolean NOT NULL DEFAULT true,
  expires_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────── users ─────────────────────────
CREATE TABLE users.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text NOT NULL UNIQUE,
  name          text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE users.otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  ip          text,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON users.otp_codes (phone, created_at DESC);
CREATE INDEX ON users.otp_codes (ip, created_at DESC);

CREATE TABLE users.sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users.addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL,
  phone      text NOT NULL,
  line1      text NOT NULL,
  line2      text NOT NULL DEFAULT '',
  city       text NOT NULL,
  state      text NOT NULL,
  pincode    text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON users.addresses (user_id) WHERE deleted_at IS NULL;

CREATE SEQUENCE users.order_number_seq START 10001;

-- status:         pending_payment → confirmed → packed → shipped → delivered; or cancelled
-- payment_status: unpaid → paid → (refund_pending →) partially_refunded | refunded
CREATE TABLE users.orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number           text NOT NULL UNIQUE,
  user_id          uuid NOT NULL REFERENCES users.users(id),
  idempotency_key  text,
  status           text NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN ('pending_payment', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  payment_status   text NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'paid', 'refund_pending', 'partially_refunded', 'refunded')),
  address          jsonb NOT NULL,
  shipping_method  text NOT NULL CHECK (shipping_method IN ('standard', 'express')),
  subtotal_paise   integer NOT NULL,
  discount_paise   integer NOT NULL DEFAULT 0,
  shipping_paise   integer NOT NULL DEFAULT 0,
  total_paise      integer NOT NULL CHECK (total_paise > 0),
  refunded_paise   integer NOT NULL DEFAULT 0,
  coupon_code      text,
  payment_method   text,
  payment_ref      text,
  tracking         jsonb,
  cancel_reason    text,
  -- Set when something needs a human (amount mismatch, refund failed…); shown in admin.
  needs_attention  text,
  expires_at       timestamptz NOT NULL,
  paid_at          timestamptz,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX ON users.orders (user_id, created_at DESC);
CREATE INDEX ON users.orders (expires_at) WHERE status = 'pending_payment';
CREATE INDEX ON users.orders (status, created_at DESC);

CREATE TABLE users.order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES users.orders(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL,
  slug             text NOT NULL,
  name             text NOT NULL,
  image            text,
  size             text NOT NULL,
  color            text NOT NULL DEFAULT '',
  qty              integer NOT NULL CHECK (qty > 0),
  unit_price_paise integer NOT NULL
);
CREATE INDEX ON users.order_items (order_id);
CREATE INDEX ON users.order_items (product_id);

CREATE TABLE users.receipt_counters (
  fy   text PRIMARY KEY,
  last integer NOT NULL
);

-- Issued once per confirmed order and never changed. The PDF is kept in the database
-- (a few KB each) so it is backed up with everything else.
CREATE TABLE users.receipts (
  order_id   uuid PRIMARY KEY REFERENCES users.orders(id),
  number     text NOT NULL UNIQUE,
  pdf        bytea,
  issued_at  timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every WhatsApp message about an order, so retries never send the same message twice.
CREATE TABLE users.notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES users.orders(id),
  kind                text NOT NULL,
  dedupe_key          text NOT NULL UNIQUE,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  attempts            integer NOT NULL DEFAULT 0,
  last_error          text,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON users.notifications (order_id);

-- requested → approved | rejected; approved → received → refund_pending → refunded
CREATE TABLE users.returns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES users.orders(id),
  user_id      uuid NOT NULL REFERENCES users.users(id),
  status       text NOT NULL DEFAULT 'requested'
               CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refund_pending', 'refunded')),
  reason       text NOT NULL,
  items        jsonb NOT NULL,
  refund_paise integer NOT NULL,
  admin_note   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON users.returns (order_id);
CREATE INDEX ON users.returns (status, created_at DESC);

-- Refund completions already applied to an order (makes the refunded event idempotent).
CREATE TABLE users.applied_refunds (
  key          text PRIMARY KEY,
  order_id     uuid NOT NULL REFERENCES users.orders(id),
  amount_paise integer NOT NULL,
  applied_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users.reviews (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  user_id    uuid NOT NULL REFERENCES users.users(id),
  order_id   uuid NOT NULL REFERENCES users.orders(id),
  author     text NOT NULL,
  rating     integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX ON users.reviews (product_id) WHERE status = 'published';

-- ───────────────────────── payments ─────────────────────────
-- One gateway order per shop order. status: created → captured | (failed attempts keep it 'created')
CREATE TABLE payments.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL UNIQUE,
  order_number        text NOT NULL,
  user_id             uuid NOT NULL,
  provider            text NOT NULL,
  provider_order_id   text NOT NULL UNIQUE,
  amount_paise        integer NOT NULL CHECK (amount_paise > 0),
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'captured', 'attention')),
  provider_payment_id text,
  method              text,
  last_error          text,
  last_checked_at     timestamptz,
  captured_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON payments.payments (created_at) WHERE status = 'created';

-- Every gateway payment we have seen for an order (attempts, captures, duplicates).
CREATE TABLE payments.transactions (
  provider_payment_id text PRIMARY KEY,
  payment_id          uuid NOT NULL REFERENCES payments.payments(id),
  amount_paise        integer NOT NULL,
  status              text NOT NULL,
  method              text,
  is_duplicate        boolean NOT NULL DEFAULT false,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON payments.transactions (payment_id);

-- Raw webhooks, stored before processing. The event id makes redelivery harmless.
CREATE TABLE payments.webhook_events (
  id           text PRIMARY KEY,
  event        text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text
);

-- status: pending → processed | failed
CREATE TABLE payments.refunds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 text NOT NULL UNIQUE,
  order_id            uuid NOT NULL,
  provider_payment_id text NOT NULL,
  amount_paise        integer NOT NULL CHECK (amount_paise > 0),
  reason              text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  provider_refund_id  text UNIQUE,
  attempts            integer NOT NULL DEFAULT 0,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON payments.refunds (order_id);
CREATE INDEX ON payments.refunds (status) WHERE status <> 'processed';
