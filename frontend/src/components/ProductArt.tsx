import { useId, useState } from 'react';
import type { Pattern, ProductArt as Art } from '@/types';

export type ArtView = 'front' | 'back' | 'detail' | 'dupatta';

interface Props {
  art: Art;
  color: string;
  accent: string;
  view?: ArtView;
  src?: string;
  alt?: string;
  className?: string;
  /** Transparent background (cut-out look). */
  bare?: boolean;
}

const KURTA: Record<Art['silhouette'], { d: string; hemY: number; hemX: [number, number] }> = {
  straight: { d: 'M118 72 Q150 100 182 72 L214 84 L236 168 L214 175 L198 128 L204 300 L96 300 L102 128 L86 175 L64 168 L86 84 Z', hemY: 300, hemX: [96, 204] },
  aline: { d: 'M118 72 Q150 100 182 72 L214 84 L236 168 L214 175 L198 128 L224 285 L76 285 L102 128 L86 175 L64 168 L86 84 Z', hemY: 285, hemX: [76, 224] },
  anarkali: { d: 'M118 72 Q150 100 182 72 L214 84 L236 168 L214 175 L196 128 L192 150 L254 342 L46 342 L108 150 L104 128 L86 175 L64 168 L86 84 Z', hemY: 342, hemX: [46, 254] },
};

const BOTTOM: Record<Art['bottom'], string> = {
  pant: 'M112 280 L188 280 L182 386 L157 386 L150 305 L143 386 L118 386 Z',
  palazzo: 'M108 270 L192 270 L216 386 L154 386 L150 312 L146 386 L84 386 Z',
  sharara: 'M110 270 L190 270 L193 322 L232 386 L153 386 L150 332 L147 386 L68 386 L107 322 Z',
  patiala: 'M104 262 L196 262 Q220 332 186 372 L182 386 L157 386 L150 320 L143 386 L118 386 L114 372 Q80 332 104 262 Z',
};

function PatternDef({ id, pattern, accent }: { id: string; pattern: Pattern; accent: string }) {
  switch (pattern) {
    case 'booti':
      return (
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <g fill={accent} opacity=".85">
            <circle cx="11" cy="11" r="1.8" />
            <circle cx="11" cy="7.4" r="1.3" /><circle cx="11" cy="14.6" r="1.3" />
            <circle cx="7.4" cy="11" r="1.3" /><circle cx="14.6" cy="11" r="1.3" />
            <circle cx="0" cy="0" r="1" /><circle cx="22" cy="0" r="1" /><circle cx="0" cy="22" r="1" /><circle cx="22" cy="22" r="1" />
          </g>
        </pattern>
      );
    case 'stripes':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <rect x="0" width="2.5" height="12" fill={accent} opacity=".6" />
          <rect x="6" width="1" height="12" fill={accent} opacity=".35" />
        </pattern>
      );
    case 'floral':
      return (
        <pattern id={id} width="38" height="38" patternUnits="userSpaceOnUse">
          <g fill={accent} opacity=".75" transform="translate(19 19)">
            {[0, 60, 120, 180, 240, 300].map((r) => (
              <ellipse key={r} cx="0" cy="-5.5" rx="2.6" ry="4.6" transform={`rotate(${r})`} />
            ))}
            <circle r="2.4" opacity=".9" />
          </g>
          <g fill={accent} opacity=".5"><circle cx="0" cy="0" r="1.4" /><circle cx="38" cy="0" r="1.4" /><circle cx="0" cy="38" r="1.4" /><circle cx="38" cy="38" r="1.4" /></g>
        </pattern>
      );
    case 'chevron':
      return (
        <pattern id={id} width="20" height="14" patternUnits="userSpaceOnUse">
          <path d="M0 10 L5 4 L10 10 L15 4 L20 10" fill="none" stroke={accent} strokeWidth="1.6" opacity=".7" />
        </pattern>
      );
    case 'paisley':
      return (
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={accent} strokeWidth="1.3" opacity=".85">
            <path d="M17 5 C27 6 28 21 17 27 C9 31 5 22 11 18 C15 15 20 17 18 21" />
            <circle cx="16" cy="13" r="1.2" fill={accent} />
          </g>
          <g fill={accent} opacity=".5"><circle cx="2" cy="31" r="1" /><circle cx="31" cy="2" r="1" /></g>
        </pattern>
      );
    default:
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r=".6" fill={accent} opacity=".35" />
        </pattern>
      );
  }
}

/**
 * Generated product illustration. Stands in for photography in the FE-only phase.
 * Pass `src` to render a real image instead.
 */
export function ProductArt({ art, color, accent, view = 'front', src, alt = '', className = '', bare }: Props) {
  const uid = useId().replace(/:/g, '');
  const [broken, setBroken] = useState(false);
  // Real photo when available; falls back to the illustration if the file is missing.
  if (src && !broken) return <img src={src} alt={alt} onError={() => setBroken(true)} className={`h-full w-full object-cover ${className}`} loading="lazy" />;

  const k = KURTA[art.silhouette];
  const pat = `pat-${uid}`;
  const shade = `shade-${uid}`;
  const bg = `bg-${uid}`;
  const viewBox = view === 'detail' ? '88 58 124 165' : '0 0 300 400';

  return (
    <svg viewBox={viewBox} className={`h-full w-full ${className}`} role="img" aria-label={alt} preserveAspectRatio="xMidYMid slice">
      <defs>
        <PatternDef id={pat} pattern={art.pattern} accent={accent} />
        <linearGradient id={shade} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <radialGradient id={bg} cx=".5" cy=".42" r=".7">
          <stop offset="0" stopColor="#F2F0ED" />
          <stop offset="1" stopColor="#E6E3DF" />
        </radialGradient>
      </defs>
      {!bare && <rect x="0" y="0" width="300" height="400" fill={`url(#${bg})`} />}
      <ellipse cx="150" cy="392" rx="90" ry="8" fill="#000" opacity=".06" />

      {view === 'dupatta' ? (
        <g transform="rotate(-8 150 200)">
          <rect x="60" y="40" width="180" height="320" rx="4" fill={accent} opacity=".55" />
          <rect x="60" y="40" width="180" height="320" rx="4" fill={`url(#${pat})`} opacity=".9" />
          <rect x="60" y="40" width="180" height="320" rx="4" fill="none" stroke={color} strokeWidth="10" opacity=".85" />
          <rect x="70" y="50" width="160" height="300" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 4" opacity=".7" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={68 + i * 20} y1="360" x2={68 + i * 20} y2="376" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </g>
      ) : (
        <>
          {/* hanger */}
          <g fill="none" stroke="#6F6266" strokeWidth="2.2" strokeLinecap="round">
            <path d="M150 50 L150 42 Q150 30 160 30 Q169 30 169 38" />
            <path d="M150 52 L92 82 M150 52 L208 82" />
          </g>
          {/* bottoms */}
          <path d={BOTTOM[art.bottom]} fill={accent} />
          <path d={BOTTOM[art.bottom]} fill={`url(#${shade})`} />
          {art.bottom === 'patiala' && (
            <g stroke={color} strokeOpacity=".25" fill="none">
              <path d="M115 280 Q105 330 122 372M130 280 Q125 330 135 380M170 280 Q175 330 165 380M185 280 Q195 330 178 372" />
            </g>
          )}
          {/* kurta */}
          <path d={k.d} fill={color} />
          <path d={k.d} fill={`url(#${pat})`} />
          <path d={k.d} fill={`url(#${shade})`} />
          {/* neckline + yoke embroidery */}
          <path d={view === 'back' ? 'M120 73 Q150 84 180 73' : 'M118 72 Q150 100 182 72'} fill="none" stroke={accent} strokeWidth="4" strokeDasharray="1.5 3.5" strokeLinecap="round" />
          {view !== 'back' && <path d="M112 80 Q150 120 188 80" fill="none" stroke={accent} strokeWidth="1.6" opacity=".9" />}
          {view === 'back' && (
            <g stroke={accent} strokeWidth="1.5"><path d="M150 76 L146 120M150 76 L154 120" /><circle cx="146" cy="122" r="2.5" fill={accent} /><circle cx="154" cy="122" r="2.5" fill={accent} /></g>
          )}
          {/* cuffs */}
          <g stroke={accent} strokeWidth="3.5"><path d="M66 162 L86 169M234 162 L214 169" /></g>
          {/* hem border */}
          <line x1={k.hemX[0] + 3} y1={k.hemY - 7} x2={k.hemX[1] - 3} y2={k.hemY - 7} stroke={accent} strokeWidth="6" strokeDasharray="5 2" />
          <line x1={k.hemX[0] + 2} y1={k.hemY - 15} x2={k.hemX[1] - 2} y2={k.hemY - 15} stroke={accent} strokeWidth="1.2" opacity=".8" />
          {/* dupatta */}
          {view === 'front' && (
            <g>
              <path d="M90 84 C118 160 168 214 232 244 L242 230 C184 202 134 150 106 80 Z" fill={accent} opacity=".42" />
              <path d="M230 238 L252 360 L232 364 L214 248 Z" fill={accent} opacity=".42" />
              <path d="M90 84 C118 160 168 214 232 244 M106 80 C134 150 184 202 242 230" fill="none" stroke={accent} strokeWidth="1.6" strokeDasharray="2 3" />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
