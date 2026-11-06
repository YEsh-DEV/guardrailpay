/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Layer 1: Black Base (~60%)
        finovate: {
          950: '#050505',
          900: '#0E0E0E',
          850: '#141414',
          800: '#1A1A1A',
          700: '#262626',
          grey: '#656663',
        },
        // Layer 2: Violet / Magenta Accent (~30%)
        violet: {
          glow: '#2B0A3D',
          glowDark: '#1B0B1C',
          400: '#DD60F7',
          500: '#D152F5',
          600: '#B035D4',
          700: '#7F359B',
        },
        lavender: {
          100: '#F5D3FE',
          200: '#F1BDFF',
          300: '#EA9DFD',
        },
        // Layer 3: Cool Silver #E2E8F0 (~10%)
        silver: {
          100: '#F1F5F9',
          200: '#E2E8F0',
          400: '#94A3B8',
          600: '#64748B',
        },
        // Semantic Verdicts
        verdict: {
          pass: '#34D399',
          hold: '#FBBF24',
          block: '#F43F5E',
          unverified: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        btn: '10px',
        card: '20px',
        phone: '44px',
        platform: '28px',
      },
      boxShadow: {
        'violet-glow': '0 0 80px 20px rgba(209, 82, 245, 0.25)',
        'violet-btn': '0 4px 20px rgba(209, 82, 245, 0.4)',
        'silver-card': '0 20px 40px -15px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(226, 232, 240, 0.1)',
      },
    },
  },
  plugins: [],
};
