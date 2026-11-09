import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { MEDIA } from '@/data/media';
import { subscribeNewsletter } from '@/services/api';
import { useUI } from '@/store';
import { Icon } from './Icon';
import { Media } from './Media';
import { Spinner } from './ui';

export function Newsletter({ dark }: { dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useUI((s) => s.toast);
  if (done) return <p className={dark ? 'text-white' : 'text-brand'}>Thank you! Your 10% code is on its way. ✨</p>;
  return (
    <form
      className={`flex w-full max-w-md items-center border-b ${dark ? 'border-white/60' : 'border-ink/30'}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Please enter a valid email', 'error');
        setBusy(true);
        await subscribeNewsletter(email);
        setBusy(false);
        setDone(true);
      }}
    >
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Email address"
        className={`flex-1 bg-transparent py-3 text-sm outline-none ${dark ? 'text-white placeholder:text-white/70' : 'placeholder:text-ink-400'}`} />
      <button className={`p-2 ${dark ? 'text-white' : 'text-brand'}`} disabled={busy} aria-label="Subscribe">{busy ? <Spinner /> : <Icon name="arrowUpRight" size={18} />}</button>
    </form>
  );
}

const COLS: { title: string; links: [string, string][] }[] = [
  { title: 'Aribas', links: [['Our story', '/about'], ['Contact', '/contact'], ['FAQs', '/faq']] },
  { title: 'Discover', links: [['New in', '/shop?sort=newest'], ['Bestsellers', '/shop'], ['Wedding edit', '/shop?occasion=Wedding']] },
  { title: 'Collections', links: CATEGORIES.slice(0, 4).map((c) => [c.name, `/collections/${c.slug}`] as [string, string]) },
  { title: 'Account', links: [['Sign in', '/account'], ['Track order', '/account'], ['Wishlist', '/wishlist']] },
];

export function Footer() {
  return (
    <footer className="mt-24">
      <Media {...MEDIA.footer} className="min-h-[560px]">
        <div className="absolute inset-0 bg-gradient-to-b from-paper via-paper/10 to-black/55" />
        <div className="relative flex min-h-[560px] flex-col justify-between px-6 pb-8 pt-10 sm:px-10">
          <div className="text-center">
            <Link to="/shop" className="link-cta">Explore now <Icon name="arrowUpRight" size={18} /></Link>
            <p className="mt-4 select-none font-display text-[22vw] font-bold uppercase leading-[.8] text-brand md:text-[15vw] xl:text-[200px]" aria-hidden>Aribas</p>
          </div>
          <div className="grid gap-10 text-white lg:grid-cols-[1.2fr_2fr]">
            <div>
              <Newsletter dark />
              <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-white/75">We will use your email to send you new drops, festive edits and offers. Unsubscribe anytime.</p>
              <div className="mt-5 flex gap-2">
                {(['instagram', 'facebook', 'youtube'] as const).map((n) => (
                  <a key={n} href="#" aria-label={n} className="grid h-9 w-9 place-items-center rounded-full border border-white/40 transition hover:bg-white hover:text-brand"><Icon name={n} size={16} /></a>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {COLS.map((c) => (
                <div key={c.title}>
                  <p className="mb-3 font-display text-sm uppercase tracking-wider text-white/70">{c.title}</p>
                  <ul className="space-y-2 text-sm">
                    {c.links.map(([l, to]) => <li key={l}><Link to={to} className="hover:underline">{l}</Link></li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Media>
      <div className="flex flex-col items-center justify-between gap-2 px-6 py-5 text-[11px] uppercase tracking-wider text-ink-600 sm:flex-row sm:px-10">
        <p>© {new Date().getFullYear()} Aribas · Lucknow, India</p>
        <p className="flex gap-4"><span>UPI</span><span>Visa</span><span>Mastercard</span><span>RuPay</span><span>COD</span></p>
      </div>
    </footer>
  );
}
