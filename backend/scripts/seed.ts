/**
 * Seeds the coupons the storefront already advertises. Safe to run again.
 *   npm run seed            → coupons
 *   npm run seed -- --demo  → coupons + one demo product (local testing only)
 */
import { migrate } from '../src/db/migrate.js';
import { pool, query, one } from '../src/lib/db.js';

const COUPONS = [
  { code: 'ARIBAS10', description: '10% off on your order', kind: 'percent', value: 10, min: 0 },
  { code: 'FESTIVE500', description: '₹500 off on orders above ₹4,999', kind: 'flat', value: 500_00, min: 4999_00 },
  { code: 'WELCOME15', description: '15% off orders above ₹2,999', kind: 'percent', value: 15, min: 2999_00 },
];

await migrate();
for (const c of COUPONS) {
  await query(
    `INSERT INTO cart.coupons (code, description, kind, value, min_subtotal_paise) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING`,
    [c.code, c.description, c.kind, c.value, c.min],
  );
}
console.log(`coupons: ${COUPONS.map((c) => c.code).join(', ')}`);

if (process.argv.includes('--demo')) {
  const p = await one(
    `INSERT INTO products.products (slug, name, category, fabric, occasion, description, colors, images, price_paise, mrp_paise, is_new)
     VALUES ('demo-embroidered-cotton-kurti', 'Demo Embroidered Cotton Kurti', 'kurtis', 'Cotton', 'Casual',
             'A demo product for local testing.', '[{"name":"Maroon","hex":"#6E0F1C"}]', '[]', 129900, 189900, true)
     ON CONFLICT (slug) DO UPDATE SET updated_at = now() RETURNING id`,
  );
  for (const [size, stock] of Object.entries({ S: 5, M: 5, L: 5, XL: 3 }))
    await query(`INSERT INTO products.variants (product_id, size, stock) VALUES ($1,$2,$3) ON CONFLICT (product_id, size) DO NOTHING`, [p.id, size, stock]);
  console.log('demo product: demo-embroidered-cotton-kurti');
}
await pool.end();
