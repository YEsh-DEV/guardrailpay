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
        bg: {
          base: '#081014',
          darker: '#05090C',
          surface: '#0E171D',
          elevated: '#14222B',
        },
        neon: {
          green: '#00FF59',
          lime: '#9AEA62',
          cyan: '#00F5D4',
          danger: '#FF3B30',
          warning: '#FF9F0A',
        },
        brand: {
          textSecondary: '#9BA9B2',
          textMuted: '#586974',
        },
      },
      fontFamily: {
        display: ['var(--font-instrument)', 'Instrument Serif', 'Georgia', 'serif'],
        sans: ['var(--font-manrope)', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        card: '24px',
        container: '38px',
        outer: '48px',
      },
      boxShadow: {
        'glow-green': '0 0 35px -5px rgba(0, 255, 89, 0.35)',
        'glow-danger': '0 0 35px -5px rgba(255, 59, 48, 0.4)',
        'ambient-card': '0 42px 76px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 35s linear infinite',
        'marquee-reverse': 'marquee-reverse 35s linear infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0%)' },
        },
      },
    },
  },
  plugins: [],
};

