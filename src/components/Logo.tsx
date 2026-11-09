import { Link } from 'react-router-dom';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-baseline gap-1.5 leading-none" aria-label="Aribas home">
      <span className={`font-display text-[26px] font-bold uppercase tracking-[.06em] sm:text-[30px] ${light ? 'text-white' : 'text-brand'}`}>Aribas</span>
    </Link>
  );
}
