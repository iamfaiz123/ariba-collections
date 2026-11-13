import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CartDrawer } from './CartDrawer';
import { ConsentBanner } from './ConsentBanner';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileMenu } from './MobileMenu';
import { SearchOverlay } from './SearchOverlay';
import { Toaster } from './Toaster';
import { SeoSync } from '@/seo/SeoSync';
import { auth, LIVE, onSessionChange } from '@/services/backend';
import { useAuth } from '@/store';

/** Live mode: restore the login on page load and keep the store in sync with the session. */
function useLiveSession() {
  const setUser = useAuth((s) => s.setUser);
  useEffect(() => {
    if (!LIVE) return;
    auth.restore().then((u) => u !== undefined && setUser(u)).catch(() => {});
    const off = onSessionChange(setUser);
    return () => {
      off();
    };
  }, [setUser]);
}

export function Layout() {
  const { pathname } = useLocation();
  useLiveSession();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return (
    <>
    <SeoSync />
    <div className="min-h-screen bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <div className="frame flex min-h-screen flex-col">
        <Header />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <CartDrawer />
      <MobileMenu />
      <SearchOverlay />
      <Toaster />
      <ConsentBanner />
    </div>
    </>
  );
}
