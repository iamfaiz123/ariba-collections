import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchSuggestions } from '@/services/api';
import { useUI } from '@/store';
import type { Product } from '@/types';
import { inr } from '@/utils/format';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';
import { Spinner } from './ui';

const POPULAR = ['Anarkali', 'Chikankari', 'Sharara', 'Cotton', 'Wedding', 'Organza'];

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUI();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!searchOpen) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSearchOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      searchSuggestions(q).then((r) => alive && (setResults(r), setLoading(false)));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  if (!searchOpen) return null;
  const close = () => {
    setSearchOpen(false);
    setQ('');
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={close} />
      <div className="relative animate-rise bg-paper shadow-2xl">
        <div className="container-x py-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!q.trim()) return;
              navigate(`/shop?q=${encodeURIComponent(q.trim())}`);
              close();
            }}
            className="flex items-center gap-3 border-b border-ink/20 pb-3"
          >
            <Icon name="search" size={22} className="text-ink-400" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suits, fabrics, colours…" className="flex-1 bg-transparent font-display text-2xl outline-none placeholder:text-ink-400 sm:text-3xl" aria-label="Search products" />
            {loading && <Spinner className="text-brand" />}
            <button type="button" onClick={close} className="btn-ghost" aria-label="Close search"><Icon name="close" /></button>
          </form>
          <div className="max-h-[65vh] overflow-y-auto py-5">
            {!q.trim() ? (
              <div>
                <p className="eyebrow mb-3">Popular searches</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map((p) => <button key={p} onClick={() => setQ(p)} className="chip">{p}</button>)}
                </div>
              </div>
            ) : results.length === 0 && !loading ? (
              <p className="text-sm text-ink-600">No results for “{q}”. Try another fabric, colour or style.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link to={`/product/${p.slug}`} onClick={close} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white">
                      <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg"><ProductArt art={p.art} color={p.colors[0].hex} accent={p.colors[0].accent} src={p.images?.[0]} /></div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-ink-400">{p.fabric} · {p.occasion}</p>
                        <p className="mt-1 text-sm">{inr(p.price)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {q.trim() && results.length > 0 && (
              <Link to={`/shop?q=${encodeURIComponent(q.trim())}`} onClick={close} className="link mt-4 inline-block text-sm">See all results for “{q}”</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
