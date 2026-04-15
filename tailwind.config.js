/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // Hard-edge scale — override Tailwind defaults so no component
    // accidentally gets soft corners. rounded-full is preserved for
    // circular avatar / indicator elements only.
    borderRadius: {
      'none': '0px',
      'sm':   '1px',
      DEFAULT:'2px',
      'md':   '2px',
      'lg':   '2px',
      'xl':   '3px',
      '2xl':  '3px',
      '3xl':  '4px',
      'full': '9999px',
    },
    extend: {
      colors: {
        orbital: {
          bg:      '#03070d',   // deep space black
          surface: '#060e1a',   // instrument panel
          panel:   '#091624',   // raised surface
          border:  '#1e3248',   // chrome divider — visible against dark
          chrome:  '#274660',   // highlighted chrome
          muted:   '#1a2d42',   // recessed surface
          text:    '#d4e2f0',   // cool white — primary text
          subtle:  '#7090a8',   // secondary text — readable blue-gray
          dim:     '#2a3f55',   // very muted tint
        },
        status: {
          incoming:  '#3b82f6',
          active:    '#22c55e',
          wrap:      '#f59e0b',
          completed: '#475569',
          flagged:   '#ef4444',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      // ── Custom animations ──────────────────────────────────────────────────
      animation: {
        'ambient':        'ambient 25s ease-in-out infinite',
        'scan-line':      'scan-line 10s linear infinite',
        'glow-pulse':     'glow-pulse 3s ease-in-out infinite',
        'data-flicker':   'data-flicker 5s ease-in-out infinite',
        'corner-draw':    'corner-draw 0.4s ease-out forwards',
        'hud-in':         'hud-in 0.25s ease-out forwards',
        'lock-blink':     'lock-blink 1.2s step-end infinite',
        'indicator-pulse':'indicator-pulse 2.5s ease-in-out infinite',
      },
      keyframes: {
        ambient: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%':      { opacity: '0.6', transform: 'scale(1.08)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-10px)', opacity: '0' },
          '5%':   { opacity: '1' },
          '95%':  { opacity: '1' },
          '100%': { transform: 'translateY(100vh)', opacity: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 8px currentColor' },
          '50%':      { opacity: '0.4', boxShadow: '0 0 2px currentColor' },
        },
        'data-flicker': {
          '0%, 100%':  { opacity: '1' },
          '91%, 93%':  { opacity: '0.7' },
          '92%':       { opacity: '0.2' },
        },
        'corner-draw': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'hud-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'lock-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'indicator-pulse': {
          '0%, 100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':      { opacity: '0.35',transform: 'scale(0.85)' },
        },
      },
      boxShadow: {
        'chrome':        'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.6)',
        'chrome-active': 'inset 0 1px 0 rgba(255,255,255,0.09), 0 0 0 1px rgba(14,165,233,0.4), 0 0 20px rgba(14,165,233,0.08)',
        'panel':         '0 4px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
        'glow-blue':     '0 0 20px rgba(14,165,233,0.25)',
        'glow-green':    '0 0 20px rgba(34,197,94,0.2)',
        'glow-red':      '0 0 20px rgba(239,68,68,0.2)',
        'inset-well':    'inset 0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
