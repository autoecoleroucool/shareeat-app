/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#49e619',
        'primary-dark': '#3acc0f',
        'bg-light': '#f6f8f6',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 8px 30px rgba(0,0,0,0.06)',
        'sheet': '0 -10px 40px rgba(0,0,0,0.10)',
      },
    },
  },
  plugins: [],
};
