# QuoteSeal Design System & Exact Motion Specification

> Derived directly from live computed styles and headless browser extraction of [Tuyo.com](https://tuyo.com) (Awwwards Honorable Mention) at 1440px desktop & 390px mobile viewports.
> Applied with original QuoteSeal branding, copy, and autonomous agent payment guard architecture.

---

## 1. Real Computed Styles vs Initial Estimates

Every token previously estimated with `~` has been confirmed and updated against real computed browser values:

| Token / Property | Initial Spec Estimate (`~`) | Real Computed Value (from `tuyo.com`) | QuoteSeal Semantic Application |
|---|---|---|---|
| Signature Neon Green (`--accent`) | `~rgb(20, 255, 93)` (`#14FF5D`) | `rgb(0, 255, 89)` (`#00FF59`) | Primary action CTA, full-bleed band, PASS verdict |
| Accent Soft / Mint | `~#D9FFC9` | `rgb(226, 255, 213)` (`#E2FFD5`) | Focus cards, earnings pill, verified badge tint |
| Secondary Paragraph Grey | `~#8A8A8A` | `rgb(166, 166, 166)` (`#A6A6A6`) on dark, `rgb(114, 114, 114)` on light | Secondary explanation text & dimmed counter cents |
| Inactive Heading / Blur text | `~#C9C9C9` | `rgb(191, 191, 191)` (`#BFBFBF`) | Unfocused / blurred state in pinned stages |
| Primary Ink on Light / Accent | `#000000` | `rgb(0, 0, 0)` / `rgb(20, 20, 20)` (`#141414`) | Text on green CTA pills and alabaster light bands |
| Light Section Background | `#FFFFFF` | `#FFFFFF` (`rgb(255, 255, 255)`) & `#FAF9F6` | Main light feature sections |
| Dark Shell Background | `#000000` | `#000000` (`rgb(0, 0, 0)`) | Rounded hero container & footer |
| Phone Outer Frame Bezel | Radius `~48px` | `width: 358px`, `height: 754px`, `borderRadius: 57px`, `bg: #0A0A0A`, `border: 1.68px solid #4C4C4C` | Device frame component |
| Phone Inner Screen | Radius `~40px` | `width: 338px`, `height: 734px`, `borderRadius: 47px`, `inset: 10px` | Inner phone viewport |
| Phone Shadow | `Large blur, low opacity` | `box-shadow: rgba(0, 0, 0, 0.28) 0px 42px 75.6px 0px` | Realistic device elevation |
| Pill Button Metrics | `~10px 20px`, `14-16px` | `padding: 11px 20px`, `borderRadius: 999px`, `fontSize: 15px`, `fontFamily: "Manrope", sans-serif` | Hero & section CTA pills |
| Card Radius | `24 to 32px` | `24px` (container `20px` to `24px`, chat card `20px`) | Content & scenario cards |
| Section Vertical Padding | `~120 to 160px` | `padding: 32px 0 96px` (hero: `padding: 0 24px 100px`) | Desktop vertical rhythm |
| Hero Glow Blobs | `blue/violet/orange` | `filter: blur(100px); width: 822px; height: 822px; border-radius: 525px; bottom: -703px; left: 50%; transform: translate(-50%)` | Radial ambient glow at hero bottom |
| Green Wipe Panel | `~0.8s` | `height: 800px; background-color: rgb(0, 255, 89); padding: 0 220px` | Full-bleed interactive 3D card band |

---

## 2. Typography Hierarchy

Computed typography system:
- **Headings & Display**: `Manrope` / `SF Pro Rounded` (with `Instrument Serif` for hero editorial accent if desired).
  - **H1 (Hero)**: `fontSize: 60px` (desktop), `lineHeight: 60px`, `letterSpacing: -1.8px` (`-0.03em`), `fontWeight: 600`.
  - **H2 (Sections)**: `fontSize: 42px` (desktop), `lineHeight: 46.2px`, `letterSpacing: -1.26px` (`-0.03em`), `fontWeight: 600`.
  - **Body text**: `fontSize: 18px – 20px`, `lineHeight: 1.5`, `color: rgb(114, 114, 114)`.
  - **Mono / Numbers / Verdicts**: `IBM Plex Mono` / `font-variant-numeric: tabular-nums`, trailing digits dimmed.

---

## 3. Motion System & Physics

| Sequence | Real Easing & Timing |
|---|---|
| Smooth Scroll (Lenis) | `lerp: 0.1`, `wheelMultiplier: 1.0`, `touchMultiplier: 1.5` |
| Pinned Stages | GSAP `ScrollTrigger.create({ pin: true, scrub: 0.8 })` with inner screen `translateY` scrubbed `0 → -380px` |
| Focus-Pull Effect | Dual-threshold opacity & blur: `opacity: 0.25 → 1`, `filter: blur(8px) → blur(0px)`, `color: #BFBFBF → #000000` |
| Green Panel Wipe | `clipPath: inset(0 0 0 0)` reveal, `scaleY` smoothly entering with `power3.out` |
| Chat Sequence | Timed state timeline: 400ms typing indicator → spring pop (`stiffness: 300, damping: 24`) → status tick |
| Fan Review Carousel | Rotation curve `[-7deg, 0deg, +7deg]`, scale `[0.9, 1.0, 0.9]`, blur `[4px, 0px, 4px]` |
| Live Ticking Counter | `requestAnimationFrame` tick at 60fps, integer formatted with commas, last 6 decimals rendered in lighter opacity |

---

## 4. Next.js Implementation Mapping

- **Hero**: `apps/merchant-dashboard/app/components/HeroSection.tsx`
- **Feature A (Interest/Policy Checks)**: `apps/merchant-dashboard/app/components/FeatureSectionA.tsx`
- **Feature B (Money rails/Verdict Log)**: `apps/merchant-dashboard/app/components/FeatureSectionB.tsx`
- **Feature C (Invest/Safe Rotation)**: `apps/merchant-dashboard/app/components/FeatureSectionC.tsx`
- **Green Band & 3D Card**: `apps/merchant-dashboard/app/components/SafeRotationSection.tsx` / `TuyoCardBand.tsx`
- **AI Chat & Mesh**: `apps/merchant-dashboard/app/components/AIChatDemoSection.tsx`
- **Fan Carousel & Marquee**: `apps/merchant-dashboard/app/components/VerdictMarquee.tsx` & `AttackFanCarousel.tsx`
- **Live Counter & Footer**: `apps/merchant-dashboard/app/components/LiveCounterSection.tsx` & `FinalCTAAndFooter.tsx`
