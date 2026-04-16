/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // Hard edges — no soft rounding anywhere except full circles
    borderRadius: {
      'none': '0px',
      'sm':   '1px',
      DEFAULT: '2px',
      'md':   '2px',
      'lg':   '2px',
      'xl':   '2px',
      '2xl':  '2px',
      '3xl':  '3px',
      'full': '9999px',
    },
    extend: {
      colors: {
        orbital: {
          // Charcoal base — not navy, not pure black.
          // Matches the tone of DaVinci Resolve / Unreal Engine panels.
          bg:      '#131416',   // page background
          surface: '#1a1b1e',   // panel / card surface
          panel:   '#1f2024',   // elevated surface (modals, popovers)
          border:  '#27282e',   // default 1px separator
          chrome:  '#353640',   // active / hover border
          muted:   '#101113',   // recessed / inset areas
          text:    '#d0d1d5',   // primary readable text
          subtle:  '#6e6f78',   // secondary / de-emphasised text
          dim:     '#35363e',   // placeholder / disabled
        },
        status: {
          incoming:  '#3b82f6',  // blue
          active:    '#22c55e',  // green
          wrap:      '#f59e0b',  // amber
          completed: '#52525b',  // zinc muted
          flagged:   '#ef4444',  // red
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      // Minimal animation set — only functional, no decorative
      animation: {
        'indicator-pulse': 'indicator-pulse 2.5s ease-in-out infinite',
        'hud-in':          'hud-in 0.15s ease-out forwards',
      },
      keyframes: {
        'indicator-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.25' },
        },
        'hud-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'overlay': '0 4px 24px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
}
