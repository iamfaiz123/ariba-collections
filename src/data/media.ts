/**
 * Site-wide media slots. Put your files in /public/media and set their paths here.
 * Empty slots fall back to a painted scene, so you can add them one at a time.
 * Video: MP4 (H.264), 1920x1080 for wide slots / 1080x1350 for portrait, under ~8 MB, no audio needed.
 */
export const MEDIA = {
  /** Homepage film. `image` is the poster shown while the video loads (and for reduced-motion users). */
  hero: { video: '/media/hero.mp4', image: '/media/hero.jpg' },
  /** Campaign section still (frame from the hero film). Add `video` here to make it moving. */
  heroTitle: { image: '/media/hero-title.jpg' } as { image: string; video?: string },
  // Empty slots below show the painted fallback. When you add a file, fill in its path, e.g.
  // banner: { video: '/media/banner.mp4', image: '/media/banner.jpg' }
  banner: {} as { video?: string; image?: string },
  footer: {} as { video?: string; image?: string },
  story: {} as { image?: string },
  spotlight: {} as { image?: string },
};

/**
 * Product photos & videos by slug. Put files in /public/products/<slug>/.
 * Example:
 *   'mehr-zari-anarkali': { images: ['/products/mehr-zari-anarkali/1.jpg', '/products/mehr-zari-anarkali/2.jpg'], video: '/products/mehr-zari-anarkali/video.mp4' },
 */
export const PRODUCT_MEDIA: Record<string, { images?: string[]; video?: string }> = {};
