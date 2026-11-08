import { Link } from 'react-router-dom';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-baseline gap-1.5 leading-none" aria-label="Ariba Collections home">
      <span className={`font-display text-[26px] font-bold uppercase tracking-[.06em] sm:text-[30px] ${light ? 'text-white' : 'text-brand'}`}>Ariba</span>
      <span className={`hidden font-serif text-lg italic sm:inline ${light ? 'text-white/80' : 'text-brand/80'}`}>collections</span>
    </Link>
  );
}
