/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './sidepanel.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1B1F6B',
          dark: '#13164D',
          light: '#2A3090',
        },
        orange: {
          DEFAULT: '#FD9B36',
          light: '#FEB76E',
          dark: '#E08020',
        },
        rust: {
          DEFAULT: '#C2410C',
          light: '#EA580C',
        },
        soft: '#FFFBF5',
      },
    },
  },
  plugins: [],
};
