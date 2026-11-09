# Source assets (not published)

Original, full-size files. The website uses compressed copies in `public/`.
This folder is git-ignored: keep a backup of it (Google Drive, iCloud) — it is not on GitHub.

| Folder | What | Used on the site as |
|---|---|---|
| `reference/design-reference.mp4` | Screen recording of the third-party design we took inspiration from. **Do not publish.** | — |
| `brand-film/hero-film-original.mp4` | Gemini-generated brand film (has the Gemini ✦ watermark) | `public/media/hero.mp4` + `hero.jpg` |
| `posters/new-collection-sofa.jpeg` | "New Collection" poster, seated | `public/media/new-collection-1.jpg` |
| `posters/new-collection-standing.jpeg` | "New Collection" poster, standing | not used right now |
| `posters/effortless-elegance.jpg` | "Effortless Elegance" poster (pink suit) | `public/media/effortless-elegance.jpg` |
| `posters/our-story-market.jpg` | Sepia market-street photo for Our Story | `public/media/our-story.jpg` |
| `products/<slug>/` | Original product photos and videos | `public/products/<slug>/` |

## Adding a new product

1. Put the originals in `source-assets/products/<slug>/` (e.g. `noor-pink-chikankari-suit`).
2. Ask Claude to add it, or follow "Adding products" in the main README.
