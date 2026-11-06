# QuoteSeal Design System & Motion Specification

> Reference: [Tuyo — Banking from the Future](https://tuyo.com) (Awwwards Honorable Mention by Owi Sixseven)  
> Adapted for **QuoteSeal: Payment Guard for Autonomous AI Agents**

---

## 1. Reference Architecture & Visual Audit

Our audit of `https://tuyo.com` at desktop (1440px) and mobile (390px) reveals a distinctive aesthetic combining ultra-clean neo-banking minimalism with futuristic spatial web touches:
- **Base Aesthetic**: Deep obsidian / slate navy foundation (`#081014`, `#060A0D`) contrasted against electric, radiant accents (`#00FF59`, `#9AEA62`, `#00F5D4`).
- **Typography Pairing**: Humanist elegance meets high-tech precision. A high-contrast editorial display serif (`Instrument Serif`) contrasted with an ultra-legible, geometric sans (`Manrope`) and precise monospace (`IBM Plex Mono`).
- **Atmospheric Depth**: Multi-layered backdrop blurs (`backdrop-filter: blur(16px) saturate(180%)`), subtle 1px luminous borders (`rgba(255, 255, 255, 0.08)` to `rgba(0, 255, 89, 0.2)`), and deep ambient drop shadows (`0 42px 76px rgba(0,0,0,0.47)`).
- **Motion Philosophy**: Physics-driven spring animations, continuous smooth velocity via Lenis, scroll-pinned stage reveals (phone & card), masked split-text reveals (`translateY(100%)` to `0`), and interactive 3D spatial tilts.

---

## 2. Design Tokens

### 2.1 Color Palette

| Token Name | Hex Code | Computed RGB / Alpha | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--color-bg-base` | `#081014` | `rgb(8, 16, 20)` | Deep slate canvas background |
| `--color-bg-darker` | `#05090C` | `rgb(5, 9, 12)` | Darkest recesses, modals, canvas base |
| `--color-bg-surface` | `#0E171D` | `rgb(14, 23, 29)` | Primary card & section surface |
| `--color-bg-surface-elevated`| `#14222B` | `rgb(20, 34, 43)` | Hovered cards, dropdowns, sticky bar |
| `--color-accent-primary` | `#00FF59` | `rgb(0, 255, 89)` | Electric Neon Emerald (QuoteSeal primary action/verdict PASS) |
| `--color-accent-lime` | `#9AEA62` | `rgb(154, 234, 98)` | Secondary neon highlight, badges, charts |
| `--color-accent-cyan` | `#00F5D4` | `rgb(0, 245, 212)` | Gradient terminal for 3D reflections & holographic sheen |
| `--color-accent-danger` | `#FF3B30` | `rgb(255, 59, 48)` | Verdict BLOCK, attack detection, alert banners |
| `--color-accent-warning` | `#FF9F0A` | `rgb(255, 159, 10)` | Verdict HOLD / Time-lock delay warning |
| `--color-text-primary` | `#FFFFFF` | `rgb(255, 255, 255)` | Main headings and high-contrast labels |
| `--color-text-secondary` | `#9BA9B2` | `rgb(155, 169, 178)` | Descriptive paragraphs, subtitles |
| `--color-text-muted` | `#586974` | `rgb(88, 105, 116)` | Metadata, disclaimers, timestamps |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.08)` | `rgba(255,255,255,0.08)` | Default card borders |
| `--color-border-highlight` | `rgba(0, 255, 89, 0.25)` | `rgba(0,255,89,0.25)` | Active states, hover glow borders |

### 2.2 Typography Scale

- **Display Serif**: `Instrument Serif` (Google Fonts), `serif`
- **Primary Body Sans**: `Manrope` (Google Fonts), `sans-serif`
- **Monospace / Technical Data**: `IBM Plex Mono` (Google Fonts), `monospace`

| Style | Font Family | Size (Desktop) | Size (Mobile) | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | Instrument Serif | `84px` – `104px` | `44px` – `52px` | 400 (Italic/Regular) | 1.05 | `-0.03em` |
| **Heading 1** | Manrope / Inst. | `56px` – `64px` | `36px` | 600 / 400 | 1.15 | `-0.025em` |
| **Heading 2** | Manrope | `40px` – `48px` | `28px` | 600 | 1.2 | `-0.02em` |
| **Heading 3** | Manrope | `28px` – `32px` | `22px` | 600 | 1.25 | `-0.015em` |
| **Body Large** | Manrope | `20px` – `22px` | `18px` | 400 / 500 | 1.5 | `-0.01em` |
| **Body Base** | Manrope | `16px` | `15px` | 400 | 1.6 | `0em` |
| **Caption / Mono** | IBM Plex Mono | `13px` – `14px` | `12px` | 400 / 500 | 1.4 | `+0.02em` |

### 2.3 Geometry & Radius System

- **Pill / Maximum**: `9999px` (Buttons, nav bar, live badge chips, verdict tags)
- **Container / Modal**: `38px` – `48px` (Main section frames, floating app windows)
- **Card Surface**: `24px` (Profile card, attack cards, mockup screens)
- **Inner Element / Input**: `14px` – `16px` (Form fields, sub-bubbles, buttons)

### 2.4 Shadows & Atmospheric Blur

- **Floating Glass Nav**: `backdrop-filter: blur(16px) saturate(180%); background: rgba(8, 16, 20, 0.75); border: 1px solid rgba(255, 255, 255, 0.1);`
- **Card Ambient Drop**: `box-shadow: 0 42px 76px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06);`
- **Neon Glow (Green)**: `box-shadow: 0 0 35px -5px rgba(0, 255, 89, 0.35);`
- **Neon Glow (Red Block)**: `box-shadow: 0 0 35px -5px rgba(255, 59, 48, 0.4);`

---

## 3. Motion Language & Scroll Choreography

### 3.1 Smooth Scroll Spec (Lenis)
```ts
const lenisOptions = {
  duration: 1.2,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.5,
};
```

### 3.2 Global Easing Curves
- **Snappy Entrance**: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- **Dramatic Reveal**: `cubic-bezier(0.65, 0, 0.35, 1)`
- **Gentle Hover / Float**: `cubic-bezier(0.25, 0.1, 0.25, 1)`
- **Spring Physics (Framer Motion)**: `stiffness: 260, damping: 20, mass: 0.8`

### 3.3 Scroll-Linked Sequences Spec

1. **Floating Navigation**:
   - `scrollY > 50`: Add glass blur and subtle shadow.
   - Scrolling Down: `translateY(-100%)` with duration `0.35s`, `ease: [0.2, 0.8, 0.2, 1]`.
   - Scrolling Up: `translateY(0)` immediately.
2. **Hero Rotating Headlines**:
   - 3 headline states cycle every `3.6s`:
     1. *"Your agent's payment guard."*
     2. *"Verified before it signs."*
     3. *"Autonomous, but never blind."*
   - Animation: Vertical masked slide-up (`y: '100%' -> '0%' -> '-100%'`, `opacity: 0 -> 1 -> 0`), staggered letter/word reveals.
3. **Hero 3D Sealed Quote**:
   - R3F Canvas with interactive holographic card / seal.
   - Mouse move updates `rotationX` and `rotationY` with soft spring damping (`lerp(current, target, 0.08)`).
   - Continuous gentle ambient hover (`Math.sin(clock.elapsedTime * 1.5) * 0.1`).
4. **Feature Section A (Sticky ENS Verification Phone/Mockup)**:
   - Left side: 3 sequential explanatory steps with scroll highlight.
   - Right side: Sticky phone mockup. When step 1 is active, shows query to `researchpro.eth`. Step 2: resolves text records (`x402.payTo`). Step 3: shows glowing PASS verdict badge.
5. **Feature Section B (The 3D Profile Card)**:
   - 3D interactive card showing `researchpro.eth`, active `payTo`, network `Hedera 296`, max limit `$50.00`, version `v2.4`.
   - Cursor movement calculates 3D tilt up to +/- 18deg.
   - Holographic sheen layer moves in reverse angle to cursor.
   - Click flips card 180deg on Y-axis to reveal ENS text records and cryptographic signature proofs.
6. **Feature Section C (Horizontal Payment Flow Rail)**:
   - Nodes: `[AI Agent]` -> `[QuoteSeal Guard]` -> `[Hedera Network]` -> `[HashScan]`.
   - Connecting SVG bezier curve animates `stroke-dashoffset` as the user scrolls into view.
   - Glow pulse travels along the wire; each node lights up with green beacon pulse when reached.
7. **AI Chat Demo Section**:
   - Chat window with agent prompt typing effect: *"Pay ResearchPro 5 USDC for research report..."*.
   - QuoteSeal inspector bubble renders 402 Payment Required response.
   - Toggle switch: **[Attack: OFF]** shows valid payee `0x71C...` and green PASS verdict; **[Attack: ON]** shows hijacked `payTo: 0x999...` and red animated BLOCK verdict: *"Recipient mismatch. Signer never called."*
8. **Safe Rotation Section**:
   - 4-card sequence: `1. Propose` -> `2. World ID Check` -> `3. 48h Time-Lock Delay` -> `4. Activate`.
   - Interactive selection scales active card to `1.03` with spring.
   - Countdown ring animates circular SVG progress `2d 00h 00m 00s`.
9. **Attack Scenario Marquee**:
   - Dual-track infinite marquee smoothly scrolling left at `40px/s`.
   - Pauses cleanly on hover.
   - Cards display real agent attack vectors: *payTo substitution*, *look-alike origin*, *amount drift*, *unannounced rotation*, *stale offer*, *RPC sybil*.
10. **Live Realtime Counter**:
    - Odometer rolling digit effect.
    - Counts up verified micro-settlements since page open: `$1,842,910.42089` ticking with sub-cent precision.
11. **Final CTA & Magnetic Button**:
    - Magnetic button follows cursor within 40px bounding box.
    - Gradient border shines on hover.

---

## 4. Product UI Specifications (/merchant & /buyer)

- **Merchant Dashboard (`/merchant`)**:
  - Live ENS profile status (`researchpro.eth`).
  - Active payout address, daily budget cap, emergency pause switch.
  - Payout Rotation Manager with 3-step proposal wizard (New address -> World ID verification -> 48h time-lock status).
  - EAC Roles & permissions grid (Signer, Admin, Operator).
- **Buyer Demo Console (`/buyer`)**:
  - Agent terminal with real-time JSON RPC stream.
  - Live Verdict Timeline (filter by `ALL`, `PASS`, `BLOCK`, `HOLD`).
  - Attack Simulator proxy toggle (`Tamper payTo`, `Fuzz amount`, `Invalid nonce`).
  - Hedera Testnet HashScan deep links for settled transactions.

