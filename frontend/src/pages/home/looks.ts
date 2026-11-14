import { PALETTE } from '@/data/products';
import type { CategorySlug, ColorOption, ProductArt } from '@/types';

/** A styled outfit shown in the home page showcases (illustrated until real photos are added). */
export interface Look {
  name: string;
  category: CategorySlug;
  color: ColorOption;
  art: ProductArt;
}

const look = (name: string, category: CategorySlug, color: keyof typeof PALETTE, art: ProductArt): Look => ({ name, category, color: PALETTE[color], art });

/** "Try the Look" lineup. */
export const LOOKS: Look[] = [
  look('Wine Anarkali', 'anarkali', 'wine', { pattern: 'paisley', silhouette: 'anarkali', bottom: 'pant' }),
  look('Teal Straight Suit', 'straight', 'teal', { pattern: 'booti', silhouette: 'straight', bottom: 'pant' }),
  look('Rani Pink Sharara Set', 'sharara', 'rani', { pattern: 'floral', silhouette: 'aline', bottom: 'sharara' }),
  look('Mustard Patiala Suit', 'patiala', 'mustard', { pattern: 'stripes', silhouette: 'straight', bottom: 'patiala' }),
  look('Navy Palazzo Suit', 'palazzo', 'navy', { pattern: 'chevron', silhouette: 'aline', bottom: 'palazzo' }),
];

/** "On the rail": everything hanging in the studio. */
export const RAIL: Look[] = [
  look('Maroon Booti Kurti', 'kurtis', 'maroon', { pattern: 'booti', silhouette: 'straight', bottom: 'pant' }),
  look('Mint Floral Kurti', 'kurtis', 'mint', { pattern: 'floral', silhouette: 'straight', bottom: 'pant' }),
  look('Bottle Green Kurta Set', 'kurta-sets', 'bottle', { pattern: 'floral', silhouette: 'straight', bottom: 'pant' }),
  look('Peach Kurta Set', 'kurta-sets', 'peach', { pattern: 'booti', silhouette: 'straight', bottom: 'pant' }),
  look('Rani Pink Anarkali', 'anarkali', 'rani', { pattern: 'paisley', silhouette: 'anarkali', bottom: 'pant' }),
  look('Lavender Anarkali', 'anarkali', 'lavender', { pattern: 'floral', silhouette: 'anarkali', bottom: 'pant' }),
  look('Rust Sharara Set', 'sharara', 'rust', { pattern: 'floral', silhouette: 'aline', bottom: 'sharara' }),
  look('Powder Blue Palazzo Suit', 'palazzo', 'powder', { pattern: 'chevron', silhouette: 'aline', bottom: 'palazzo' }),
  look('Ivory Straight Suit', 'straight', 'ivory', { pattern: 'booti', silhouette: 'straight', bottom: 'pant' }),
  look('Olive Kurti', 'kurtis', 'olive', { pattern: 'stripes', silhouette: 'straight', bottom: 'pant' }),
];
