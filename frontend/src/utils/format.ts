export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export const discountPercent = (price: number, mrp: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const deliveryEstimate = (days: [number, number]) => {
  const fmt = (d: number) => {
    const date = new Date();
    date.setDate(date.getDate() + d);
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  return `${fmt(days[0])} – ${fmt(days[1])}`;
};
