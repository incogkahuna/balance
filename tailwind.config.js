/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Balance brand palette
        orbital: {
          bg: '#0d0f12',
          surface: '#161a1f',
          border: '#232830',
          muted: '#2a3040',
          text: '#e8eaf0',
          subtle: '#8b92a4',
        },
        status: {
          incoming: '#3b82f6',
          active: '#22c55e',
          wrap: '#f59e0b',
          completed: '#6b7280',
          flagged: '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
