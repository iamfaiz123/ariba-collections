import type { Category } from '@/types';

export const CATEGORIES: Category[] = [
  { slug: 'anarkali', name: 'Anarkali Suits', tagline: 'Flowing, flared & regal', color: '#7E2647', accent: '#D9B677', pattern: 'paisley', intro: 'Shop Anarkali suits for women online in India: floor-length georgette, chanderi, velvet and organza Anarkalis with zari, gota patti and thread embroidery for weddings, festivals and parties.' },
  { slug: 'straight', name: 'Straight Suits', tagline: 'Clean lines, everyday grace', color: '#2F5D62', accent: '#E9D8A6', pattern: 'booti', intro: 'Shop straight suits for women online in India: chikankari, block-print, silk and lawn kurta sets with pants and dupatta, for office, everyday and festive wear.' },
  { slug: 'sharara', name: 'Sharara Sets', tagline: 'Statement silhouettes for celebrations', color: '#A23E48', accent: '#F2C57C', pattern: 'floral', intro: 'Shop sharara and gharara sets online in India: mirror work, gota and embroidered kurtis with flared shararas, made for mehendi, sangeet and wedding functions.' },
  { slug: 'palazzo', name: 'Palazzo Suits', tagline: 'Breezy comfort, effortless style', color: '#3E5C9A', accent: '#F1E3C8', pattern: 'chevron', intro: 'Shop palazzo suits for women online in India: rayon, cotton, georgette and chanderi kurtas with wide-leg palazzos, comfortable for office, casual and party wear.' },
  { slug: 'patiala', name: 'Patiala Suits', tagline: 'Classic Punjabi charm', color: '#C06C2B', accent: '#FBE7C6', pattern: 'stripes', intro: 'Shop Patiala suits online in India: phulkari, striped and silk short kurtas with a full Patiala salwar and dupatta, in classic Punjabi style.' },
  { slug: 'unstitched', name: 'Unstitched Fabric', tagline: 'Tailor it your way', color: '#5B4B8A', accent: '#E8D9A8', pattern: 'plain', intro: 'Shop unstitched suit fabric online in India: lawn, georgette and chanderi 3-piece sets (shirt, bottom and dupatta) to tailor to your exact fit.' },
];

export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
