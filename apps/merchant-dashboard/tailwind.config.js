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
        gabrun: {
          blue: '#1A6CFF',
          blueDark: '#0052E0',
          blueLight: '#E8F1FF',
          blueMuted: '#D0E2FF',
          ink: '#0F172A',
          slate: '#64748B',
          canvas: '#FFFFFF',
          canvasSubtle: '#F8FAFC',
        },
        bg: {
          base: '#03045E',
          darker: '#02033B',
          surface: '#050875',
          elevated: '#081096',
        },
        tuyo: {
          canvas: '#FAF9F6',
          canvasMuted: '#F9F6EC',
          canvasDark: '#081014',
          canvasDarker: '#05090C',
          ink: '#141414',
          inkSecondary: '#242422',
          inkMuted: '#586974',
          mint: '#D6E3CB',
          mintText: '#293B26',
          peach: '#F2D9CD',
          peachText: '#493128',
          sky: '#CBDDEB',
          skyText: '#263948',
          butter: '#F2E890',
          butterText: '#33321F',
          butterLight: '#FFF8CB',
          lilac: '#DCD5EF',
          lilacText: '#352D48',
          neon: '#00FF59',
          neonHover: '#00E650',
          neonLime: '#9AEA62',
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
        'glow-cyan': '0 0 35px -5px rgba(0, 180, 216, 0.45)',
        'glow-cerulean': '0 0 35px -5px rgba(0, 119, 182, 0.45)',
        'glow-green': '0 0 35px -5px rgba(0, 180, 216, 0.45)',
        'glow-danger': '0 0 35px -5px rgba(255, 59, 48, 0.4)',
        'ambient-card': '0 42px 76px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        'tuyo-light': '0 24px 48px -12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
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
