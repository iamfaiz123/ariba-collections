import { z } from 'zod';

/**
 * Every setting comes from environment variables (see .env.example). Missing optional
 * integrations fall back to safe local stand-ins (console WhatsApp, mock payments) outside production.
 */
const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');
const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  /** Which services this process runs: "all", or a comma list of users,products,cart,payments. */
  SERVICES: z.string().default('all'),
  /** Run background workers (queues and schedules) in this process. */
  RUN_WORKERS: z.string().optional().transform((v) => v !== 'false' && v !== '0'),
  DATABASE_URL: z.string().default('postgres://aribas@127.0.0.1:5432/aribas'),
  DATABASE_SSL: bool,
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),

  CORS_ORIGINS: list,
  JWT_SECRET: z.string().default('dev-only-secret-change-me-dev-only-secret'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  COOKIE_SECURE: z.string().optional(),
  INTERNAL_TOKEN: z.string().default('dev-internal-token'),
  /** Base URLs used for service-to-service calls. Default: this same process. */
  USERS_URL: z.string().optional(),
  PRODUCTS_URL: z.string().optional(),
  CART_URL: z.string().optional(),
  PAYMENTS_URL: z.string().optional(),
  /** Phone numbers that get the admin role when they log in, e.g. "+919000000000,+919111111111". */
  ADMIN_PHONES: list,
  /**
   * Hosted test server before Razorpay/WhatsApp keys exist: lets production run with the mock
   * gateway and console WhatsApp. Login codes are shown on screen ONLY for numbers in TEST_PHONES.
   * Remove both once the real keys are in.
   */
  ALLOW_TEST_MODE: bool,
  TEST_PHONES: list,

  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  RAZORPAY_API_URL: z.string().default('https://api.razorpay.com/v1'),

  WHATSAPP_PROVIDER: z.enum(['console', 'meta']).default('console'),
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_API_URL: z.string().default('https://graph.facebook.com'),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
  WHATSAPP_OTP_TEMPLATE: z.string().default('aribas_login_otp'),
  WHATSAPP_RECEIPT_TEMPLATE: z.string().default('aribas_order_receipt'),
  WHATSAPP_REFUND_TEMPLATE: z.string().default(''),
  WHATSAPP_SHIPPED_TEMPLATE: z.string().default(''),

  OTP_TTL_MINUTES: z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  ORDER_HOLD_MINUTES: z.coerce.number().default(30),
  RETURN_WINDOW_DAYS: z.coerce.number().default(7),
  SHIPPING_FREE_ABOVE: z.coerce.number().default(1999),
  SHIPPING_STANDARD_FEE: z.coerce.number().default(99),
  SHIPPING_EXPRESS_FEE: z.coerce.number().default(199),

  BUSINESS_NAME: z.string().default('Aribas'),
  BUSINESS_ADDRESS: z.string().default(''),
  BUSINESS_PHONE: z.string().default(''),
  BUSINESS_EMAIL: z.string().default(''),
  SITE_URL: z.string().default('https://ariba-collections.onrender.com'),
});

// Treat empty values in .env ("KEY=") as unset so defaults apply.
const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')));
if (!parsed.success) {
  console.error('Invalid environment:', z.prettifyError(parsed.error));
  process.exit(1);
}
const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

if (isProd) {
  const problems: string[] = [];
  if (env.JWT_SECRET.startsWith('dev-only') || env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be a random string of 32+ characters');
  if (env.INTERNAL_TOKEN === 'dev-internal-token' || env.INTERNAL_TOKEN.length < 24) problems.push('INTERNAL_TOKEN must be a random string of 24+ characters');
  if (env.PAYMENT_PROVIDER !== 'razorpay' && !env.ALLOW_TEST_MODE) problems.push('PAYMENT_PROVIDER must be "razorpay" in production');
  if (env.PAYMENT_PROVIDER === 'razorpay' && (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET))
    problems.push('RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required');
  if (env.WHATSAPP_PROVIDER !== 'meta' && !env.ALLOW_TEST_MODE) problems.push('WHATSAPP_PROVIDER must be "meta" in production (customers need their OTP)');
  if (env.WHATSAPP_PROVIDER === 'meta' && (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID))
    problems.push('WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required');
  if (env.ALLOW_TEST_MODE) console.warn('⚠ ALLOW_TEST_MODE is on: mock payments / console WhatsApp. Never take real orders like this.');
  if (problems.length) {
    console.error('Refusing to start in production:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
}

const SERVICE_NAMES = ['users', 'products', 'cart', 'payments'] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];
const enabled: ServiceName[] =
  env.SERVICES.trim() === 'all'
    ? [...SERVICE_NAMES]
    : (env.SERVICES.split(',').map((s) => s.trim()).filter((s): s is ServiceName => (SERVICE_NAMES as readonly string[]).includes(s)));

const self = `http://127.0.0.1:${env.PORT}`;

export const config = {
  ...env,
  isProd,
  services: enabled,
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  urls: {
    users: env.USERS_URL || self,
    products: env.PRODUCTS_URL || self,
    cart: env.CART_URL || self,
    payments: env.PAYMENTS_URL || self,
  },
  shipping: {
    freeAbovePaise: env.SHIPPING_FREE_ABOVE * 100,
    standardPaise: env.SHIPPING_STANDARD_FEE * 100,
    expressPaise: env.SHIPPING_EXPRESS_FEE * 100,
  },
};
export type Config = typeof config;
