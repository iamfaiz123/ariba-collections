import { payments, type CheckoutPayment } from './backend';

/**
 * Opens the payment window and reports how it ended.
 *  - paid:       verified by the server (order is being confirmed)
 *  - processing: the customer paid but the server is still confirming (webhook/poller will finish it)
 *  - dismissed:  the customer closed the window; the order stays payable for a while
 * The order page polls the server either way, so a lost callback never loses an order.
 */
export type PayOutcome = 'paid' | 'processing' | 'dismissed' | 'failed';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open(): void; on(event: string, fn: (r: unknown) => void): void };
  }
}

let loader: Promise<void> | null = null;
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loader ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

/** For the backend's mock gateway (local testing): the page supplies a "Pay / Fail" dialog. */
export type MockAsk = (p: CheckoutPayment) => Promise<'success' | 'failure' | 'dismiss'>;

export async function startPayment(p: CheckoutPayment, askMock: MockAsk): Promise<PayOutcome> {
  if (p.provider === 'mock') {
    const choice = await askMock(p);
    if (choice === 'dismiss') return 'dismissed';
    const r = await payments.mockPay(p.providerOrderId, choice);
    if (r.status !== 'captured') return 'failed';
    return (await payments.verify(r)).status === 'paid' ? 'paid' : 'processing';
  }

  await loadRazorpay();
  return new Promise<PayOutcome>((resolve) => {
    const rzp = new window.Razorpay!({
      key: p.keyId,
      amount: p.amountPaise,
      currency: p.currency,
      order_id: p.providerOrderId,
      name: p.name,
      description: p.description,
      prefill: p.prefill,
      theme: { color: '#6E0F1C' },
      // Customers may retry inside the window after a failed attempt, so failures don't end the flow.
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const v = await payments.verify(resp);
          resolve(v.status === 'paid' ? 'paid' : v.status === 'failed' ? 'failed' : 'processing');
        } catch {
          resolve('processing');
        }
      },
      modal: { ondismiss: () => resolve('dismissed'), confirm_close: true },
    });
    rzp.open();
  });
}
