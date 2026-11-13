import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { cartCount, useAuth, useCart, useUI, useWishlist } from '@/store';
import { cx } from '@/utils/format';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { ProductArt } from './ProductArt';

const ANNOUNCEMENTS = ['Free shipping on orders above ₹1,999', 'Use code ARIBAS10 for 10% off your first order', 'Easy 7-day returns & exchanges'];

export function Header() {
  const count = useCart((s) => cartCount(s.items));
  const wishCount = useWishlist((s) => s.ids.length);
  const user = useAuth((s) => s.user);
  const { setCartOpen, setMenuOpen, setSearchOpen } = useUI();
  const [scrolled, setScrolled] = useState(false);
  const [annIdx, setAnnIdx] = useState(0);
  const [megaOpen, setMegaOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setAnnIdx((i) => (i + 1) % ANNOUNCEMENTS.length), 4000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setMegaOpen(false);
  }, [location]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    cx('relative py-2 font-display text-[15px] uppercase tracking-[.08em] transition hover:text-brand', isActive && 'text-brand');

  return (
    <>
      <div className="bg-ink text-white md:rounded-t-[4px]">
        <p key={annIdx} className="container-x animate-fade-in py-2 text-center text-[11px] uppercase tracking-[.2em]">{ANNOUNCEMENTS[annIdx]}</p>
      </div>
      <header className={cx('sticky top-0 z-40 border-b transition', scrolled ? 'border-ink/10 bg-paper/90 backdrop-blur-md' : 'border-transparent bg-paper')}>
        <div className="container-x grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-[72px]">
          <div className="flex items-center gap-1">
            <button className="btn-ghost -ml-3 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" size={22} /></button>
            <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
              <div onMouseEnter={() => setMegaOpen(true)} onMouseLeave={() => setMegaOpen(false)}>
                <NavLink to="/shop" className={navCls} onFocus={() => setMegaOpen(true)}>
                  <span className="flex items-center gap-1">Shop <Icon name="chevronDown" size={14} /></span>
                </NavLink>
                {megaOpen && <MegaMenu />}
              </div>
              <NavLink to="/shop?sort=newest" className={() => navCls({ isActive: false })}>New In</NavLink>
              <NavLink to="/shop?occasion=Wedding" className={() => navCls({ isActive: false })}>Wedding</NavLink>
              <NavLink to="/about" className={navCls}>Our Story</NavLink>
            </nav>
          </div>
          <Logo />
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <button className="btn-ghost" onClick={() => setSearchOpen(true)} aria-label="Search"><Icon name="search" size={21} /></button>
            <Link to="/account" className="btn-ghost hidden sm:inline-flex" aria-label={user ? 'My account' : 'Sign in'}>
              <Icon name="user" size={21} />
            </Link>
            <Link to="/wishlist" className="btn-ghost relative hidden sm:inline-flex" aria-label={`Wishlist, ${wishCount} items`}>
              <Icon name="heart" size={21} />
              {wishCount > 0 && <Badge n={wishCount} />}
            </Link>
            <button className="btn-ghost relative -mr-3" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`}>
              <Icon name="bag" size={21} />
              {count > 0 && <Badge n={count} />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{n > 99 ? '99+' : n}</span>;
}

function MegaMenu() {
  return (
    <div className="absolute inset-x-0 top-full animate-fade-in border-t border-ink/5 bg-paper shadow-xl">
      <div className="container-x grid grid-cols-[1fr_2fr] gap-10 py-8">
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="eyebrow mb-3">Categories</p>
            <ul className="space-y-2.5">
              {CATEGORIES.map((c) => <li key={c.slug}><Link className="hover:text-brand" to={`/collections/${c.slug}`}>{c.name}</Link></li>)}
              <li><Link className="font-medium text-brand" to="/shop">View all →</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-3">Occasion</p>
            <ul className="space-y-2.5">
              {['Casual', 'Office', 'Festive', 'Party', 'Wedding'].map((o) => <li key={o}><Link className="hover:text-brand" to={`/shop?occasion=${o}`}>{o}</Link></li>)}
            </ul>
            <p className="eyebrow mb-3 mt-6">Fabric</p>
            <ul className="space-y-2.5">
              {['Cotton', 'Georgette', 'Silk', 'Chanderi'].map((f) => <li key={f}><Link className="hover:text-brand" to={`/shop?fabric=${f}`}>{f}</Link></li>)}
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {CATEGORIES.slice(0, 3).map((c) => (
            <Link key={c.slug} to={`/collections/${c.slug}`} className="group">
              <div className="tile aspect-[4/5] overflow-hidden rounded-xl">
                <div className="h-full transition duration-700 group-hover:scale-105">
                  <ProductArt art={{ pattern: c.pattern, silhouette: c.slug === 'anarkali' ? 'anarkali' : c.slug === 'kurtis' || c.slug === 'kurta-sets' || c.slug === 'straight' ? 'straight' : 'aline', bottom: c.slug === 'sharara' ? 'sharara' : 'pant' }} color={c.color} accent={c.accent} />
                </div>
              </div>
              <p className="mt-2 font-display uppercase text-brand group-hover:underline">{c.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
