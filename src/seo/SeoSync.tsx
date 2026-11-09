import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyHead } from './head';
import { getSeo } from './seo';

/** Mounted once in <Layout>: keeps <title>, meta, canonical and JSON-LD in sync with the current route. */
export function SeoSync() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    applyHead(getSeo(pathname, search));
  }, [pathname, search]);
  return null;
}
