import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        void: '#070713',
        panel: '#101426',
        neon: {
          cyan: '#35f3ff',
          pink: '#ff4fd8',
          violet: '#8b5cf6',
          lime: '#a3ff12',
        },
      },
      boxShadow: {
        neon: '0 0 32px rgba(53, 243, 255, 0.22)',
        panel: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        grid:
          'linear-gradient(rgba(53, 243, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(53, 243, 255, 0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
