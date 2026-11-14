/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Oxblood brand red — headings, CTAs, prices
        brand: { DEFAULT: '#6E0F1C', 50: '#FBF1F2', 100: '#F3DADD', 300: '#C9727F', 600: '#7D1424', 700: '#6E0F1C', 800: '#560A15', 900: '#3D0710' },
        // Off-white page surface inside the frame
        paper: { DEFAULT: '#F6F5F3', 100: '#EFEDEA', 200: '#E7E4E0' },
        // Pink cloud backdrop
        blush: { 100: '#FBE6EA', 200: '#F6CCD4', 300: '#EFA9B6', 400: '#E48596' },
        gold: { DEFAULT: '#B8893B', 100: '#F3E7D1', 300: '#D9B677', 500: '#B8893B', 700: '#8A6427' },
        ink: { DEFAULT: '#141414', 600: '#55524F', 400: '#8E8A86', 200: '#D8D4CF' },
      },
      fontFamily: {
        display: ['Oswald', 'Impact', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        /** The Aribas logo lettering (logos/2-script-signature). */
        script: ['"Pinyon Script"', 'cursive'],
      },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        drift: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(3%,-2%) scale(1.06)' } },
        'word-in': { from: { opacity: '0', transform: 'translateY(40%)', filter: 'blur(6px)' }, to: { opacity: '1', transform: 'none', filter: 'none' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        sway: { '0%,100%': { transform: 'rotate(-1.5deg)' }, '50%': { transform: 'rotate(1.5deg)' } },
        'ken-burns': { from: { transform: 'scale(1.12)' }, to: { transform: 'scale(1)' } },
      },
      animation: {
        'slide-in': 'slide-in .3s ease-out',
        'slide-in-left': 'slide-in-left .3s ease-out',
        'fade-in': 'fade-in .2s ease-out',
        rise: 'rise .35s ease-out',
        drift: 'drift 18s ease-in-out infinite',
        'word-in': 'word-in .9s cubic-bezier(.2,.7,.2,1) both',
        marquee: 'marquee 40s linear infinite',
        sway: 'sway 3.2s ease-in-out infinite',
        'ken-burns': 'ken-burns 2.4s cubic-bezier(.2,.7,.2,1) both',
      },
    },
  },
  plugins: [],
};
