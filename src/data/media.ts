/**
 * Site-wide media slots. Put compressed files in /public/media and set their paths here
 * (full-size originals go in source-assets/). Empty slots fall back to a painted scene.
 * Video: MP4 (H.264), 1920x1080 for wide slots / 1080x1350 for portrait, under ~8 MB, no audio needed.
 */
export const MEDIA = {
  /** Homepage film. `image` is the poster shown while the video loads (and for reduced-motion users). */
  hero: { video: '/media/hero.mp4', image: '/media/hero.jpg' },
  /** Home panel 2, "New collection": poster tiles (an image, or `kind: 'video'` with a `poster`). Each tile links to its own `to`, or to `href`. `w`/`h` keep each poster uncropped. */
  newCollection: {
    href: '/shop',
    tiles: [
      { kind: 'image', src: '/media/new-collection-1.jpg', w: 1194, h: 1600, alt: 'Aribas new collection: model smiling on a sofa in the bottle-green embroidered suit with tasselled dupatta' },
      { kind: 'image', src: '/media/effortless-elegance.jpg', w: 1208, h: 1500, alt: 'Aribas Effortless Elegance: model in a dusty-pink embroidered straight suit with a maroon printed dupatta, for the woman who leads' },
    ] as { kind: 'image' | 'video'; src: string; w: number; h: number; to?: string; poster?: string; alt: string }[],
  },
  // Empty slots below show the painted fallback. When you add a file, fill in its path, e.g.
  // banner: { video: '/media/banner.mp4', image: '/media/banner.jpg' }
  banner: {} as { video?: string; image?: string },
  /** Dark embroidered backdrop: gold lace border along the top, needle and hoop bottom-left. */
  footer: { image: '/media/footer.webp' } as { video?: string; image?: string },
  story: { image: '/media/our-story.jpg', alt: 'A busy clothing market street at night, stalls hung with ready-made kurtis and dupattas' } as { image?: string; alt?: string },
  spotlight: {} as { image?: string },
};

// Product photos and videos live with each product in src/data/catalogue.ts.
