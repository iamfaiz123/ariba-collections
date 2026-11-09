import { Link } from 'react-router-dom';

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-baseline gap-1.5 leading-none" aria-label="Aribas home">
      {/* The Aribas logo: Pinyon Script lettering (see logos/2-script-signature) */}
      <span className={`font-script text-[38px] leading-none sm:text-[44px] ${light ? 'text-white' : 'text-brand'}`}>Aribas</span>
    </Link>
  );
}
