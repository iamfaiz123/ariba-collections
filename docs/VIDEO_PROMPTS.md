# Ariba Collections — AI Video Prompts

Prompts for turning your own clothing photos into website videos. Each prompt below is tied to a slot that already exists on the site.

Works with image-to-video tools such as **Kling**, **Runway (Gen-4)**, **Google Veo**, **Hailuo / MiniMax**, **Luma** or **Pika**. Upload your photo as the *start frame / reference image*, then paste the prompt.

---

## 0. Before you start: get the most from your photos

| Your photo is… | Do this first |
|---|---|
| Suit **worn by a model** | Animate it directly with the prompts below. |
| Suit **flat-lay / on hanger / mannequin** | First make a model image with a *virtual try-on* or image tool (prompt in §7), then animate that image. |
| Phone photo with a busy background | Remove the background (Canva / remove.bg), then place the suit on a plain light-grey (#ECEAE7) background. |

**Rules that keep the garment accurate** (add to any prompt if the AI changes your design):

> Keep the outfit exactly as in the reference image: same colour, same embroidery pattern, same neckline, same dupatta border. Do not add or remove embellishment. Do not change the fabric.

**Universal negative prompt** (paste it into the tool's "negative prompt" box if there is one):

> text, watermark, logo, extra fingers, deformed hands, distorted face, changing outfit, colour shift, warped embroidery, flicker, blurry, low resolution, fast cuts, western clothing

**Settings:** 5–8 seconds · 24 fps · highest quality · no audio needed · ask for a *seamless loop* when the tool supports it.

---

## 1. Hero: wordmark section → `public/media/hero.mp4` (16:9, 1920×1080)

The big **ARIBA** wordmark sits over the top 40% of this video, so the top must stay bright and empty.

**Option A: scenery only (no photo needed, text-to-video)**
> Cinematic wide shot of a golden wheat-grass meadow dotted with red poppies, soft pastel blue sky with pink cotton-candy clouds drifting slowly. The top half of the frame is bright, hazy, almost white sky. Gentle breeze sways the grass. Dreamy, soft-focus, editorial fashion film look, warm afternoon light. Static camera, very slow push-in. Seamless loop.

**Option B: your suit in the scene (upload a model photo)**
> The woman in the reference image stands far away in a golden meadow full of red poppies, wearing the exact outfit from the reference. She sits in the lower third of the frame and is small in it. The sky above is bright, hazy and pastel pink. Her dupatta flows gently in the breeze. Slow cinematic push-in, shallow depth of field, editorial fashion film, warm golden-hour light. The upper 40% of the frame is empty bright sky.

---

## 2. Campaign hero, "The festive edit is here" → `public/media/hero-title.mp4` (16:9)

The white headline sits top-left and a glass testimonial card sits bottom-right, so keep the subject centred or slightly right.

> Editorial fashion campaign film. The model from the reference image walks slowly towards the camera through a field of tall golden grass and red poppies, wearing the exact Anarkali / suit from the reference. Pink smoky clouds rise softly behind her. The dupatta trails and floats in the wind and the flared hem swirls with each step. Camera: slow dolly backward at waist height, 35mm lens, shallow depth of field. Warm, soft, dreamy pastel grade with luxurious Indian festive mood. Subject centred, with empty space at top-left.

**Variation (twirl):**
> The model from the reference image does one slow, graceful twirl in a sunlit poppy field, and the Anarkali flare opens fully like a flower. Slow motion at 60%, pastel pink haze, soft backlight that makes the embroidery glint. Camera orbits slowly around her.

---

## 3. Manifesto banner, "We don't chase trends" → `public/media/banner.mp4` (4:5 portrait, 1080×1350)

> Close, playful fashion portrait of the model from the reference image wearing the exact outfit, surrounded by soft pink clouds and fresh red roses on a cream background. She slowly lowers oversized sunglasses and smiles at the camera. Surreal, bold and modern Indian fashion editorial. Smooth, slow movement, static camera.

**Craft variation (works with flat-lay photos):**
> Extreme macro close-up of the embroidery from the reference image. Slow slide across the zari and thread-work, with light glinting on the sequins and mirror work. A hand-needle enters frame and pulls a golden thread through the fabric. Warm, intimate, artisanal mood with shallow depth of field.

---

## 4. Footer → `public/media/footer.mp4` (16:9)

A large **ARIBA** wordmark sits at the top and white links sit along the bottom, so the bottom third should be darker.

> Wide, low-angle shot through a dense meadow of red poppies and golden dry grass, with a bright hazy pastel sky above. Poppies sway in the foreground, slightly out of focus. Slow sideways tracking shot. Golden hour, warm tones, the bottom third of the frame naturally darker. Calm and dreamy. Seamless loop.

---

## 5. Product videos → `public/products/<slug>/video.mp4` (4:5 or 9:16)

These play first in each product's gallery. Make one per product from that product's photo.

**Studio twirl (best conversion):**
> The model from the reference image stands on a seamless light-grey studio backdrop (#ECEAE7), wearing the exact outfit from the reference. She turns slowly 360° to show the front, side and back, then lifts the dupatta to show its border. Soft, even studio lighting with true-to-life colour. Full body in frame, static camera. Clean e-commerce product video.

**Detail walk:**
> The model from the reference image walks three steps towards the camera on a light-grey studio backdrop, then stops and poses with one hand on her hip. The camera tilts slowly from the hem up to the neckline to show the embroidery. True colours, soft studio light, full body in frame.

**Flat-lay / unstitched fabric:**
> Top-down shot of the folded fabric set from the reference image on a light-grey surface. The dupatta slowly unfolds and drifts across the frame as if blown by a gentle breeze, revealing the border and the embroidered panel. Soft daylight and true-to-life colour.

**Hanger float (no model):**
> The outfit from the reference image hangs on a wooden hanger against a light-grey background and sways gently as if touched by a breeze. The dupatta flutters softly. Slow camera push-in towards the embroidered yoke. True colour and soft studio light.

---

## 6. "Our best product" spotlight → `public/media/spotlight.png`

This is a still image, not a video. Take your best product photo, remove the background so the PNG is transparent, and crop it to 3:4. It floats between the four black feature cards.

---

## 7. Model image from a flat-lay or hanger photo (image generation)

Use this with an image generator or virtual try-on tool when you don't have a model shot:

> Full-length fashion photograph of a graceful South Asian woman in her late 20s wearing the exact outfit from the reference image: same colour, same embroidery, same neckline, same dupatta with the same border. Natural pose with a soft smile, hair in loose waves, minimal gold jhumkas. Seamless light-grey studio backdrop, soft diffused lighting, true-to-life colour, high-end e-commerce catalogue style, 4:5 crop with the full body visible.

---

## 8. Compress before uploading (keeps the site fast)

Run this in Terminal (needs `ffmpeg`, which is already installed on this Mac):

```bash
# Wide hero/footer video → ~3–6 MB, no audio, plays everywhere
ffmpeg -i input.mp4 -an -vf "scale=1920:-2,fps=24" -c:v libx264 -crf 26 -preset slow -movflags +faststart -pix_fmt yuv420p public/media/hero.mp4

# Poster image (shown while the video loads)
ffmpeg -i public/media/hero.mp4 -frames:v 1 -q:v 3 public/media/hero.jpg

# Portrait product video
ffmpeg -i input.mp4 -an -vf "scale=1080:-2,fps=24" -c:v libx264 -crf 26 -preset slow -movflags +faststart -pix_fmt yuv420p public/products/mehr-zari-anarkali/video.mp4
```

## 9. Where the files go

| Slot | File |
|---|---|
| Wordmark hero | `public/media/hero.mp4` + `hero.jpg` |
| Campaign hero | `public/media/hero-title.mp4` + `hero-title.jpg` |
| Manifesto banner | `public/media/banner.mp4` or `banner.jpg` |
| Footer | `public/media/footer.mp4` + `footer.jpg` |
| Our story page | `public/media/story.jpg` |
| Best-product spotlight | `public/media/spotlight.png` (transparent) |
| Product photos/video | `public/products/<slug>/1.jpg, 2.jpg… , video.mp4`, then register them in `src/data/media.ts` → `PRODUCT_MEDIA` |

The site-wide media slots in the table appear automatically as soon as the file exists. Product photos and videos also need the `PRODUCT_MEDIA` entry. A missing file shows the painted placeholder instead, so the layout never breaks.
