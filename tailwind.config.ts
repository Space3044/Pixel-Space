import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // 全部走 CSS 变量，让 `bg-void/90` / `text-neon-cyan/60` 等 alpha 变体
        // 直接消费当前主题 token。
        void: 'rgb(var(--c-bg) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
        neon: {
          cyan: 'rgb(var(--c-cyan) / <alpha-value>)',
          pink: 'rgb(var(--c-pink) / <alpha-value>)',
          violet: 'rgb(var(--c-violet) / <alpha-value>)',
          lime: 'rgb(var(--c-lime) / <alpha-value>)',
        },
      },
      boxShadow: {
        neon: '0 0 32px rgb(var(--c-cyan) / 0.22)',
        panel: '0 24px 80px rgb(var(--c-shadow) / var(--c-shadow-soft-alpha))',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        grid:
          'linear-gradient(rgb(var(--c-grid-line) / var(--c-grid-line-alpha)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-grid-line) / var(--c-grid-line-alpha)) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
