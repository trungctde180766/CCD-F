/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        brand: {
          50: '#fdf6f3',
          100: '#fbeae3',
          200: '#f7d5c8',
          300: '#f0b6a0',
          400: '#e58e6e',
          500: '#d96b43',
          600: '#c6532d',
          700: '#a54224',
          800: '#873822',
          900: '#6f3120',
        },
      },
    },
  },
  plugins: [],
};
