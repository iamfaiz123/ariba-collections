import { useCallback, useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import type { CheckoutPayment } from '@/services/backend';
import { inr } from '@/utils/format';

type Choice = 'success' | 'failure' | 'dismiss';

/** Stand-in for the Razorpay window while the backend runs with PAYMENT_PROVIDER=mock. */
export function useMockPay() {
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const resolver = useRef<(c: Choice) => void>();
  const ask = useCallback(
    (p: CheckoutPayment) =>
      new Promise<Choice>((resolve) => {
        resolver.current = resolve;
        setPayment(p);
      }),
    [],
  );
  const answer = (c: Choice) => {
    setPayment(null);
    resolver.current?.(c);
  };
  return { payment, ask, answer };
}

export function MockPayDialog({ state }: { state: ReturnType<typeof useMockPay> }) {
  const p = state.payment;
  return (
    <Modal open={!!p} onClose={() => state.answer('dismiss')} title="Test payment">
      {p && (
        <div className="space-y-4 text-sm">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">The backend is in test mode (no Razorpay keys yet). No money moves.</p>
          <p>{p.description} · <b>{inr(p.amountPaise / 100)}</b></p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="btn-primary" onClick={() => state.answer('success')}>Pay</button>
            <button className="btn-outline" onClick={() => state.answer('failure')}>Fail</button>
            <button className="btn-ghost" onClick={() => state.answer('dismiss')}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
