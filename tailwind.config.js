/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    './public/**/*.html',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        synapse: {
          bg: '#0a0a0f',
          surface: '#13131a',
          elevated: '#1c1c26',
          border: '#2a2a36',
          text: '#e8e8f0',
          muted: '#8a8a9a',
          accent: '#7c5cff',
          accent2: '#2dd4bf',
          danger: '#f87171',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
