import type { Category } from '@/types';

export const CATEGORIES: Category[] = [
  { slug: 'anarkali', name: 'Anarkali Suits', tagline: 'Flowing, flared & regal', color: '#7E2647', accent: '#D9B677', pattern: 'paisley' },
  { slug: 'straight', name: 'Straight Suits', tagline: 'Clean lines, everyday grace', color: '#2F5D62', accent: '#E9D8A6', pattern: 'booti' },
  { slug: 'sharara', name: 'Sharara Sets', tagline: 'Statement silhouettes for celebrations', color: '#A23E48', accent: '#F2C57C', pattern: 'floral' },
  { slug: 'palazzo', name: 'Palazzo Suits', tagline: 'Breezy comfort, effortless style', color: '#3E5C9A', accent: '#F1E3C8', pattern: 'chevron' },
  { slug: 'patiala', name: 'Patiala Suits', tagline: 'Classic Punjabi charm', color: '#C06C2B', accent: '#FBE7C6', pattern: 'stripes' },
  { slug: 'unstitched', name: 'Unstitched Fabric', tagline: 'Tailor it your way', color: '#5B4B8A', accent: '#E8D9A8', pattern: 'plain' },
];

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
