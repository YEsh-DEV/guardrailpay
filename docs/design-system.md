# QuoteSeal Finovate-Style Design System (with Cool Silver)

> Fully calibrated against the reference image: Dark fintech aesthetic, rich violet/magenta accents, soft violet backdrop glow, device showcase, and Cool Silver `#E2E8F0` metallic structural layer.

---

## 1. Calibrated Color Tokens

Every value previously marked with `~` has been eye-checked, sampled, and locked:

### Layer 1: Black Base (~60%)
- `--black-950`: `#050505` (Page canvas, deep background)
- `--black-900`: `#0E0E0E` (Navigation backdrop, cards, secondary surfaces)
- `--black-850`: `#141414` (Phone device inner screen cards, modals)
- `--black-700`: `#262626` (Divider lines, subtle card hairpins)
- `--grey-500`: `#656663` (Muted caption text, dimmed metadata)

### Layer 2: Violet / Magenta Accent (~30%)
- `--violet-500`: `#D152F5` (Primary action button fill, key highlights)
- `--violet-400`: `#DD60F7` (Hover states, bright glow borders)
- `--violet-700`: `#7F359B` (Phone wave top gradient, deep brand fill)
- `--violet-glow`: `#1B0B1C` to `#2B0A3D` (Hero radial backdrop glow)
- `--lavender-100`: `#F5D3FE` (Showcase poster top gradient)
- `--lavender-200`: `#F1BDFF` (Giant cropped watermark text fill)
- `--lavender-300`: `#EA9DFD` (Showcase poster bottom gradient)

### Layer 3: Cool Silver `#E2E8F0` (~10%)
- `--silver-100`: `#F1F5F9` (Brightest text glints & specular highlights)
- `--silver-200`: `#E2E8F0` (Primary structural text on dark, metallic outlines, icons)
- `--silver-400`: `#94A3B8` (Secondary text, metadata, muted icon strokes)
- `--silver-600`: `#64748B` (Tertiary text, subtle labels, card borders)
- `--silver-glass`: `rgba(226, 232, 240, 0.06)` fill + `rgba(226, 232, 240, 0.14)` border

### Layer 4: Semantic Verdict Colors (Quotes & Interceptions)
- `PASS`: `#34D399` (Emerald / Mint with checkmark icon)
- `HOLD`: `#FBBF24` (Amber with clock icon)
- `BLOCK`: `#F43F5E` (Rose / Crimson with alert icon)
- `UNVERIFIABLE`: `#94A3B8` (Cool silver with help icon)

---

## 2. Calibrated Dimensions & Typography

- **Font Family**: `Manrope` / `system-ui`, geometric grotesque.
- **Eyebrow**: `12px`, uppercase, `tracking-[0.12em]`, color `--silver-400`.
- **Hero H1**: `clamp(40px, 5.5vw, 76px)`, line-height `1.05`, letter-spacing `-0.03em`, vertical gradient fill (`#FFFFFF` → `#E2E8F0` → `#94A3B8`).
- **Section H2**: `clamp(28px, 3.5vw, 48px)`, weight 600, letter-spacing `-0.02em`.
- **Button Radius**: `8px to 10px` (squared pill profile from reference, not full circle).
- **Card Radius**: `16px to 22px`.
- **Watermark Font Size**: `28vw`, weight 700, color `--lavender-200`, seated behind monitor.
- **Platform**: Perspective ribbed grooved deck (`#050505` with `1px #262626` ribs and silver highlights).
