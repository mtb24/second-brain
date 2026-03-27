import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#1a1814',
          deep: '#0f0d0b',
        },
        surface: {
          DEFAULT: '#2a2520',
          muted: '#1e1b17',
        },
        ink: {
          primary: '#f0e8d8',
          secondary: '#a09882',
        },
        cobalt: {
          DEFAULT: '#0047AB',
          light: '#2563eb',
        },
        warmborder: '#3a3530',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'monospace',
        ],
      },
      letterSpacing: {
        nav: '0.05em',
      },
      boxShadow: {
        'cobalt-glow':
          '0 0 0 1px rgba(0, 71, 171, 0.35), 0 0 24px rgba(0, 71, 171, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
