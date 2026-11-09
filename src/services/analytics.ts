import { TRACKING } from '@/data/content';

/**
 * Google Analytics 4, loaded only after the visitor accepts (India's DPDP Act expects consent).
 * Does nothing until TRACKING.googleAnalyticsId is set in src/data/content.ts.
 */
const KEY = 'aribas-analytics-consent';
type Consent = 'granted' | 'denied';
type Gtag = (...args: unknown[]) => void;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag } }

export const analyticsEnabled = () => !!TRACKING.googleAnalyticsId;

export function getConsent(): Consent | null {
  try { const v = localStorage.getItem(KEY); return v === 'granted' || v === 'denied' ? v : null; } catch { return null; }
}

export function setConsent(v: Consent) {
  try { localStorage.setItem(KEY, v); } catch { /* private mode: ask again next visit */ }
  if (v === 'granted') { load(); pageView(); }
}

let loaded = false;
function load() {
  const id = TRACKING.googleAnalyticsId;
  if (loaded || !id || getConsent() !== 'granted') return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  window.gtag('js', new Date());
  // Page views are sent manually on every route change (this is a single-page app).
  window.gtag('config', id, { send_page_view: false });
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/** Call after each route change, once the new <title> is in place. */
export function pageView() {
  load();
  if (!loaded || !window.gtag) return;
  window.gtag('event', 'page_view', { page_location: location.href, page_path: location.pathname + location.search, page_title: document.title });
}
