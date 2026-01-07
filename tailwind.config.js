/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark backgrounds - Football Manager style
        dark: {
          50: '#1a1f2e',
          100: '#171b27',
          200: '#141722',
          300: '#11141d',
          400: '#0e1018',
          500: '#0b0d13',
          600: '#08090e',
          700: '#050609',
          800: '#020304',
          900: '#000000',
        },
        // Primary - Deep blue/teal (stadium lights)
        primary: {
          50: '#e6fffa',
          100: '#b2f5ea',
          200: '#81e6d9',
          300: '#4fd1c5',
          400: '#38b2ac',
          500: '#319795',
          600: '#2c7a7b',
          700: '#285e61',
          800: '#234e52',
          900: '#1d4044',
          950: '#134e4a',
        },
        // Secondary - Stadium green (pitch)
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Accent - Gold (trophies, prestige)
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Danger - Red (cards, errors)
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        // Surface colors for cards
        surface: {
          50: '#2a3142',
          100: '#252b3a',
          200: '#1f2533',
          300: '#1a1f2c',
          400: '#151925',
          500: '#10131e',
          600: '#0b0d17',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'pitch-gradient': 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
        'stadium-gradient': 'linear-gradient(180deg, #1a1f2e 0%, #0f1318 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(42, 49, 66, 0.8) 0%, rgba(26, 31, 44, 0.9) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(49, 151, 149, 0.3)',
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.3)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shake': 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'modal-in': 'modalIn 0.2s ease-out',
        'modal-out': 'modalOut 0.15s ease-in',
        'backdrop-in': 'backdropIn 0.2s ease-out',
        'backdrop-out': 'backdropOut 0.15s ease-in',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(49, 151, 149, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(49, 151, 149, 0.8)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        modalOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
        },
        backdropIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        backdropOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
