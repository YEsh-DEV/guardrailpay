# QuoteSeal UI: Finovate-Style Design Spec + Build Plan (with Cool Silver)

> Design language taken from the supplied "Finovate" mockup image: dark fintech UI, violet/magenta accent, soft purple glow, phone-centered hero, giant lavender watermark backdrop.
> **Added by the product owner:** a third color layer, **Cool Silver `#E2E8F0`**.
> Goal: same look and feel, with **original** QuoteSeal content, logo and assets. Do not copy the "Finovate" name, logo, copy or the stock hand/phone photo.

**Note on accuracy:** values below were read from a single static image (pixel-sampled where possible). Anything marked `~` is an estimate; tune it by eye against the image. Motion is not visible in a still, so the motion section is a recommended design, not an extraction.

---

## 1. Color system (three layers)

### Layer 1: Black (base, ~60% of the surface)
| Token | Value | Use |
|---|---|---|
| `--black-950` | `#050505` | Page background, monitor/screen base |
| `--black-900` | `#0E0E0E` | Sections, nav background |
| `--black-850` | `#141414` | Cards (phone-screen cards sampled at `#141414`) |
| `--black-700` | `#262626` | Hairline borders, dividers |
| `--grey-500` | `#656663` | Muted body text (sampled `#656663`) |

### Layer 2: Violet / magenta (accent, ~30%)
| Token | Value | Use |
|---|---|---|
| `--violet-500` | `#D152F5` | Primary buttons ("Launch Demo", "Explore Now"), active states, key numbers |
| `--violet-400` | `#DD60F7` | Button hover / highlight (sampled `#DD60F7`) |
| `--violet-700` | `#7F359B` | Phone header gradient start, deep accents (sampled `#7F359B`) |
| `--violet-glow` | `#1B0B1C → #2B0A3D` | Radial glow behind the device on black (sampled `#1B0B1C`) |
| `--lavender-100` | `#F5D3FE` | Light poster/backdrop top (sampled `#F5D3FE`) |
| `--lavender-300` | `#EA9DFD` | Light backdrop mid (sampled `#EA9DFD`) |
| `--lavender-200` | `#F1BDFF` | Giant watermark fill (sampled `#F1BDFF`) |

Gradients:
- Accent gradient: `linear-gradient(135deg, #7F359B 0%, #D152F5 100%)`
- Glow: `radial-gradient(60% 60% at 70% 50%, #2B0A3D 0%, #1B0B1C 40%, transparent 75%)`
- Lavender backdrop: `linear-gradient(180deg, #F5D3FE 0%, #EA9DFD 100%)`
- Warm under-glow at the very bottom of the platform (a faint red-orange `~#FF3D1F` at 15 to 25% opacity), optional.

### Layer 3: Cool Silver `#E2E8F0` (NEW, ~10%)
This is the new layer. It is the "metal and light" color that keeps the black + violet from feeling flat, and it gives the UI a polished, premium, trustworthy feel.

| Token | Value | Use |
|---|---|---|
| `--silver-100` | `#F1F5F9` | Brightest highlights, specular glints |
| **`--silver-200`** | **`#E2E8F0`** | **Primary silver: headings, key text on dark, outline buttons, icons** |
| `--silver-400` | `#94A3B8` | Secondary text, muted icons, chart neutral series |
| `--silver-600` | `#64748B` | Disabled text, tertiary borders |
| `--silver-glass` | `rgba(226,232,240,0.06)` fill + `rgba(226,232,240,0.14)` 1px border | Glass cards, chips, inputs |

Where silver goes (be consistent):
1. **Headline text:** H1 uses a silver-to-grey vertical gradient (`#FFFFFF → #E2E8F0 → #94A3B8`) like the soft fade in the reference headline.
2. **Body and UI text on dark:** silver-200 for primary text, silver-400 for secondary.
3. **Secondary buttons:** transparent fill, 1px silver border, silver text; hover fills with `--silver-glass`.
4. **Glass cards / chips / inputs:** `--silver-glass` with `backdrop-filter: blur(12px)`.
5. **Metallic accents:** device bezels, ribbed platform highlights, divider lines with a silver shimmer sweep.
6. **Data viz:** neutral series and gridlines in silver-400 / silver-600; accent series in violet.
7. **Light sections:** on lavender backdrops, silver appears as card surfaces and borders so the page does not become all-purple.

Rule of thumb: **black = space, violet = action and emphasis, silver = information and structure.** Never use silver for primary CTAs, and never use violet for body text.

### Semantic status colors (for QuoteSeal verdicts only)
The palette has no natural "good/bad" colors, so use these sparingly, always with an icon and label (never color alone):

| Verdict | Color |
|---|---|
| PASS | `#34D399` |
| HOLD | `#FBBF24` |
| BLOCK | `#F43F5E` |
| UNVERIFIABLE | `--silver-400` `#94A3B8` |

### Contrast notes (measured / calculated)
- Silver `#E2E8F0` on near-black: about **16:1** (excellent).
- White text on the bright violet button is only about **2.3:1** in the reference, which is weak. **Use near-black text on the bright violet (`#D152F5`)**, or use the deeper `#7F359B` with white text.
- Keep body text at 4.5:1 or better.

---

## 2. Typography

- Family: a geometric grotesque in the style of **Manrope** (or Plus Jakarta Sans / Sora). Pick one from Google Fonts / Fontsource and use it everywhere.
- **Eyebrow:** uppercase, `12px`, letter-spacing `0.12em`, silver-400 (e.g. "SEALED, VERIFIED & AUTONOMOUS.").
- **H1:** `clamp(40px, 5.5vw, 80px)`, weight 500 to 600, line-height `1.05`, letter-spacing `-0.03em`, silver gradient fill, left-aligned, 3 lines.
- **H2:** `clamp(28px, 3.5vw, 48px)`, weight 600.
- **Body:** `16 to 18px`, weight 400, silver-400, max-width `46ch`.
- **Nav links:** `13 to 14px`, silver-200, centered group.
- **Numbers (balance):** large, weight 600, **currency symbol and cents smaller and lighter** (e.g. `$ 3,970` big, `.23` small).
- **Giant watermark word** (poster section): `28vw`, weight 600, lavender-200 on lavender gradient, partly cropped by the edge, sits **behind** the device.

---

## 3. Shape, depth and effects

- Buttons: radius `8 to 10px` (slightly squared pills, not fully round, per the reference), padding `12px 22px`.
- Cards: radius `16 to 24px`, `--black-850` fill, 1px `--black-700` border (or silver-glass).
- Device: black bezel, large radius, soft drop shadow; screen content uses a **violet wave** header (curved dark shape cutting into the gradient).
- Monitor/platform: ribbed (grooved) black platform with fine silver-highlight lines and perspective; faint warm glow at the base.
- Avatar stack with overlap + "+10K AI Transactions" stat in the lower-left of the hero.
- Backdrop glow: large blurred violet radial behind the phone; a slow-pulse option.

---

## 4. Layout (from the reference)

### Hero (dark)
- **Top bar:** logo left; centered nav (How it works, Features, Verification, Resources); primary violet button right.
- **Left column:** eyebrow → H1 (3 lines) → paragraph → violet "Launch Demo" button → below it an avatar stack with "+10K AI Agent Transactions".
- **Right column:** a floating phone showing the app (violet wave header, balance, account cards, "My balance" chips, "Pending payments" list) over the violet radial glow.
- Dark, generous spacing, content vertically centered.

### Poster / showcase band (light lavender)
- Full-width lavender gradient with the giant cropped watermark word behind a **monitor mockup** standing on the ribbed platform, showing the product UI. Use this once, as a "product showcase" section.

---

## 5. Motion (recommended)

| Effect | Spec |
|---|---|
| Smooth scroll | Lenis, `lerp 0.1`, synced with GSAP ticker |
| Hero entrance | Eyebrow, H1 lines (mask slide-up, stagger `80ms`), paragraph, button, avatar stack; phone rises + fades in |
| Phone | Gentle float (`translateY ±8px`, `6s` loop) + mouse-tilt parallax (`±6°`) |
| Glow | Slow pulse of the violet radial (`8 to 10s` loop), subtle parallax on scroll |
| Silver shimmer | A thin silver light sweep across card borders / dividers on hover and on enter |
| Headline | Gradient fill shifts slightly with scroll position |
| Platform | Ribbed lines parallax at a different speed from the monitor |
| Buttons | Hover: scale `1.03`, glow; secondary buttons fill with silver-glass |
| Cards | Stagger-rise on enter, hover lift with silver border brighten |
| Counters | Count-up on enter with tabular figures |
| Reduced motion | `prefers-reduced-motion`: disable float, parallax, shimmer, glow pulse |

Animate only `transform`, `opacity` and `filter`. Target 60 fps.
