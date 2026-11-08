import { useState, type ReactNode } from 'react';
import { cx } from '@/utils/format';

interface Props {
  image?: string;
  video?: string;
  alt?: string;
  className?: string;
  /** Rendered under the media; shown on its own until a real file loads. */
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * Photo / video slot. Drop files into /public/media (see src/data/media.ts) and they
 * appear automatically; until then a painted scene is shown so the layout never breaks.
 */
export function Media({ image, video, alt = '', className, fallback, children }: Props) {
  const [imgOk, setImgOk] = useState(false);
  const [vidOk, setVidOk] = useState(false);
  return (
    <div className={cx('relative overflow-hidden', className)}>
      <div className="absolute inset-0">{fallback ?? <SceneFallback />}</div>
      {image && <img src={image} alt={alt} onLoad={() => setImgOk(true)} className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', imgOk ? 'opacity-100' : 'opacity-0')} />}
      {video && (
        <video
          className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', vidOk ? 'opacity-100' : 'opacity-0')}
          autoPlay muted loop playsInline preload="metadata" aria-hidden
          onLoadedData={() => setVidOk(true)}
        >
          <source src={video} type="video/mp4" />
        </video>
      )}
      {children}
    </div>
  );
}

/** Painted dusk-field scene with drifting blush clouds and poppies. */
export function SceneFallback() {
  return (
    <div className="scene-fallback absolute inset-0">
      <div className="absolute left-[15%] top-[18%] h-[45%] w-[45%] animate-drift rounded-full bg-blush-200/80 blur-3xl" />
      <div className="absolute right-[10%] top-[10%] h-[35%] w-[35%] animate-drift rounded-full bg-white/60 blur-3xl [animation-delay:-6s]" />
      <svg className="absolute inset-x-0 bottom-0 h-[55%] w-full" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 70 }, (_, i) => {
          const x = (i * 53) % 400;
          const h = 60 + ((i * 37) % 110);
          return <path key={i} d={`M${x} 200 Q${x + 4} ${200 - h / 2} ${x + ((i % 5) - 2) * 3} ${200 - h}`} stroke="#B07A45" strokeOpacity=".55" fill="none" strokeWidth="1" />;
        })}
        {Array.from({ length: 26 }, (_, i) => {
          const x = (i * 71 + 13) % 400;
          const y = 200 - (50 + ((i * 29) % 120));
          return (
            <g key={i}>
              <path d={`M${x} 200 L${x} ${y}`} stroke="#6B5A2E" strokeWidth=".8" />
              <circle cx={x} cy={y} r={3 + (i % 3)} fill="#D7262F" />
              <circle cx={x} cy={y} r={1.4} fill="#7A0F17" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
