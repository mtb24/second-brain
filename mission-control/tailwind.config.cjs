/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617',
        },
        mission: {
          shell: 'rgb(var(--mc-shell) / <alpha-value>)',
          rail: 'rgb(var(--mc-rail) / <alpha-value>)',
          cobalt: 'rgb(var(--mc-cobalt) / <alpha-value>)',
          gold: 'rgb(var(--mc-gold) / <alpha-value>)',
          canvas: 'rgb(var(--mc-canvas) / <alpha-value>)',
          surface: 'rgb(var(--mc-surface) / <alpha-value>)',
          ink: 'rgb(var(--mc-ink) / <alpha-value>)',
          muted: 'rgb(var(--mc-muted) / <alpha-value>)',
          border: 'rgb(var(--mc-border) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
