import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageView } from '@/services/analytics';
import { applyHead } from './head';
import { getSeo } from './seo';

/** Mounted once in <Layout>: keeps <title>, meta, canonical and JSON-LD in sync with the current route. */
export function SeoSync() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    applyHead(getSeo(pathname, search));
    pageView();
  }, [pathname, search]);
  return null;
}
