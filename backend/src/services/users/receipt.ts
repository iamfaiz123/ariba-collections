import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config.js';
import { formatInr } from '../../lib/util.js';

/** Payment receipt (not a GST tax invoice; switch to one once GST-registered). */

const LOGO = join(dirname(fileURLToPath(import.meta.url)), '../../../assets/logo.png');
const MAROON = '#6E0F1C';
const GOLD = '#B8894D';
const INK = '#231710';
const MUTED = '#7a6a60';

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const prettyPhone = (p: string) => (/^\+91\d{10}$/.test(p) ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p);

const METHOD: Record<string, string> = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' };

export interface ReceiptInput {
  receiptNumber: string;
  issuedAt: Date | string;
  order: {
    number: string;
    created_at: string;
    paid_at: string | null;
    address: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
    subtotal_paise: number;
    discount_paise: number;
    shipping_paise: number;
    total_paise: number;
    coupon_code: string | null;
    shipping_method: string;
    payment_method: string | null;
    payment_ref: string | null;
  };
  customerPhone: string;
  items: { name: string; size: string; color: string; qty: number; unit_price_paise: number }[];
}

export function renderReceipt(r: ReceiptInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Receipt ${r.receiptNumber}`, Author: config.BUSINESS_NAME } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 48;
    const R = doc.page.width - 48;
    const W = R - L;

    // Header
    if (existsSync(LOGO)) doc.image(LOGO, L, 40, { width: 150 });
    else doc.font('Helvetica-Bold').fontSize(28).fillColor(MAROON).text(config.BUSINESS_NAME, L, 48);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(MAROON).text('PAYMENT RECEIPT', L, 48, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(`Receipt no. ${r.receiptNumber}`, L, 70, { width: W, align: 'right' });
    doc.text(`Issued ${fmtDate(r.issuedAt)}`, { width: W, align: 'right' });
    doc.text(`Order ${r.order.number}`, { width: W, align: 'right' });

    const biz = [config.BUSINESS_ADDRESS, config.BUSINESS_PHONE, config.BUSINESS_EMAIL, config.SITE_URL.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
    doc.moveTo(L, 112).lineTo(R, 112).lineWidth(1.2).strokeColor(GOLD).stroke();
    doc.fontSize(8.5).fillColor(MUTED).text(biz, L, 118, { width: W });

    // Billed to + payment
    const a = r.order.address;
    let y = 150;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD).text('BILLED TO', L, y);
    doc.text('PAYMENT', L + W / 2, y);
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    doc.text([a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, prettyPhone(a.phone)].filter(Boolean).join('\n'), L, y + 14, { width: W / 2 - 16, lineGap: 2 });
    doc.text(
      [
        `Status: Paid`,
        `Method: ${METHOD[r.order.payment_method ?? ''] ?? r.order.payment_method ?? 'Online'}`,
        r.order.payment_ref ? `Payment ID: ${r.order.payment_ref}` : '',
        r.order.paid_at ? `Paid on: ${fmtDate(r.order.paid_at)}` : '',
        `Delivery: ${r.order.shipping_method === 'express' ? 'Express' : 'Standard'}`,
      ].filter(Boolean).join('\n'),
      L + W / 2,
      y + 14,
      { width: W / 2, lineGap: 2 },
    );

    // Items table
    y = Math.max(doc.y, 230) + 20;
    const col = { item: L, size: L + W * 0.5, qty: L + W * 0.59, price: L + W * 0.64, amount: L + W * 0.81 };
    doc.rect(L, y, W, 22).fill('#F7F2EC');
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MAROON);
    doc.text('ITEM', col.item + 8, y + 7);
    doc.text('SIZE', col.size, y + 7);
    doc.text('QTY', col.qty, y + 7);
    doc.text('PRICE', col.price, y + 7, { width: W * 0.16, align: 'right' });
    doc.text('AMOUNT', col.amount, y + 7, { width: W * 0.19 - 8, align: 'right' });
    y += 30;
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const it of r.items) {
      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 60;
      }
      doc.text(it.name, col.item + 8, y, { width: W * 0.48 - 8 });
      if (it.color) doc.fontSize(8.5).fillColor(MUTED).text(`Colour: ${it.color}`, col.item + 8, doc.y + 1, { width: W * 0.48 - 8 }).fontSize(10).fillColor(INK);
      const rowBottom = doc.y;
      doc.text(it.size, col.size, y);
      doc.text(String(it.qty), col.qty, y);
      doc.text(formatInr(it.unit_price_paise), col.price, y, { width: W * 0.16, align: 'right' });
      doc.text(formatInr(it.unit_price_paise * it.qty), col.amount, y, { width: W * 0.19 - 8, align: 'right' });
      y = Math.max(rowBottom, y + 14) + 8;
      doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.5).strokeColor('#E8DDD2').stroke();
    }

    // Totals
    y += 8;
    const line = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(bold ? MAROON : INK);
      doc.text(label, L + W * 0.5, y, { width: W * 0.3 });
      doc.text(value, L + W * 0.8, y, { width: W * 0.2 - 8, align: 'right' });
      y += bold ? 20 : 16;
    };
    line('Subtotal', formatInr(r.order.subtotal_paise));
    if (r.order.discount_paise > 0) line(`Discount${r.order.coupon_code ? ` (${r.order.coupon_code})` : ''}`, '- ' + formatInr(r.order.discount_paise));
    line('Shipping', r.order.shipping_paise ? formatInr(r.order.shipping_paise) : 'Free');
    doc.moveTo(L + W * 0.5, y).lineTo(R, y).lineWidth(1).strokeColor(GOLD).stroke();
    y += 8;
    line('Total paid', formatInr(r.order.total_paise), true);

    // Footer
    const fy = doc.page.height - 110;
    doc.font('Helvetica-Oblique').fontSize(13).fillColor(MAROON).text('Thank you for shopping with Aribas.', L, fy, { width: W, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
      `This is a payment receipt, not a tax invoice. Returns are accepted within ${config.RETURN_WINDOW_DAYS} days of delivery for unworn items with tags. ` +
        `Need help? Reply to our WhatsApp message${config.BUSINESS_EMAIL ? ` or write to ${config.BUSINESS_EMAIL}` : ''}.`,
      L,
      fy + 24,
      { width: W, align: 'center' },
    );
    doc.end();
  });
}
