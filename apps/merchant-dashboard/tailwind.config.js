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
          base: '#060E1A',
          darker: '#030810',
          surface: '#0B192C',
          elevated: '#102A45',
        },
        tuyo: {
          canvas: '#E3F2FD',
          canvasMuted: '#D0E6FA',
          canvasDark: '#060E1A',
          canvasDarker: '#030810',
          ink: '#0A192F',
          inkSecondary: '#1E3A5F',
          inkMuted: '#5C7A99',
          mint: '#D0E8FF',
          mintText: '#0D47A1',
          peach: '#E3F2FD',
          peachText: '#0D47A1',
          sky: '#90CAF9',
          skyText: '#0A2540',
          butter: '#DCEBFA',
          butterText: '#0D47A1',
          butterLight: '#F0F7FF',
          lilac: '#C7E2FE',
          lilacText: '#0D3880',
          neon: '#2196F3',
          neonHover: '#1E88E5',
          neonLime: '#90CAF9',
        },
        neon: {
          green: '#2196F3',
          azure: '#2196F3',
          sapphire: '#0D47A1',
          sky: '#90CAF9',
          frost: '#E3F2FD',
          lime: '#90CAF9',
          cyan: '#00F5D4',
          danger: '#FF3B30',
          warning: '#FF9F0A',
        },
        brand: {
          textSecondary: '#90CAF9',
          textMuted: '#5C7A99',
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
