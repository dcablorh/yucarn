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
        carbon: '#000000',
        paper: '#ffffff',
        'sky-wash': '#dceeff',
        'concrete-gray': '#cccccc',
        'soft-mist': '#e9e9e9',
        'electric-blue': '#4da2ff',
        'mint-pop': '#55db9c',
        lavender: '#e9ccff',
        ember: '#fb4903',
        sunburst: '#ffd731',
        'voltage-violet': '#5c4ade',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        'pill': '1600px',
        'card': '24px',
        'card-lg': '32px',
      },
      boxShadow: {
        'sticker': '2px 2px 0px 0px #000000',
        'sticker-lg': '3px 3px 0px 0px #000000',
        'sticker-sm': '1.5px 1.5px 0px 0px #000000',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out forwards',
      }
    },
  },
  plugins: [],
}

