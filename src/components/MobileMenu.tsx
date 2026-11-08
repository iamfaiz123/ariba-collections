import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CATEGORIES } from '@/data/categories';
import { useAuth, useUI } from '@/store';
import { Icon } from './Icon';
import { Logo } from './Logo';

export function MobileMenu() {
  const { menuOpen, setMenuOpen } = useUI();
  const user = useAuth((s) => s.user);
  const location = useLocation();
  useEffect(() => {
    setMenuOpen(false);
  }, [location, setMenuOpen]);
  if (!menuOpen) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setMenuOpen(false)} />
      <aside className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm animate-slide-in-left flex-col bg-paper">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <Logo />
          <button onClick={() => setMenuOpen(false)} className="btn-ghost -mr-3" aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-5 py-6">
          <p className="eyebrow mb-3">Shop by category</p>
          <ul className="divide-y divide-ink/5">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to={`/shop?category=${c.slug}`} className="flex items-center justify-between py-3.5 font-display text-xl uppercase text-brand">
                  {c.name} <Icon name="chevronRight" size={16} className="text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-3.5 text-sm">
            <li><Link to="/shop?sort=newest">New arrivals</Link></li>
            <li><Link to="/shop">Shop all</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
            <li><Link to="/about">Our story</Link></li>
            <li><Link to="/faq">Help & FAQs</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
          </ul>
        </nav>
        <div className="border-t border-ink/10 p-5">
          <Link to="/account" className="btn-primary w-full"><Icon name="user" size={16} /> {user ? `Hi, ${user.name.split(' ')[0]}` : 'Sign in / Register'}</Link>
        </div>
      </aside>
    </div>
  );
}
