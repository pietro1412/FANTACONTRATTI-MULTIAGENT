/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ============ DYNAMIC THEME COLORS (CSS Variables) ============
        // These colors are set dynamically via ThemeContext
        theme: {
          bg: 'var(--bg)',
          card: 'var(--bg-card)',
          hover: 'var(--bg-hover)',
          text: 'var(--text)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
          border: 'var(--border)',
          primary: 'var(--primary)',
          'primary-bg': 'var(--primary-bg)',
          accent: 'var(--accent)',
          'accent-bg': 'var(--accent-bg)',
          success: 'var(--success)',
          danger: 'var(--danger)',
        },
        // Dark backgrounds - Stadium Nights theme (deeper, more immersive)
        dark: {
          50: '#252830',   // Lighter surface
          100: '#1a1c20',  // Card background
          200: '#111214',  // Elevated elements
          300: '#0a0a0b',  // Body background (main)
          400: '#050506',
          500: '#000000',
          // Legacy mappings for compatibility
          600: '#08090e',
          700: '#050609',
          800: '#020304',
          900: '#000000',
        },
        // Primary - Blu Stadio (stadium night lights) - MORE CALCISTIC than teal
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',   // New primary
          600: '#2563eb',   // New primary base
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Secondary - Verde Campo (THE football color)
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
        // Accent - Oro Trofeo (trophies, prestige, victories)
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
        // Passion - Arancio (high intensity moments)
        passion: {
          400: '#fb923c',
          500: '#ea580c',
          600: '#c2410c',
        },
        // Warning - Ambra (timer 10-5 sec)
        warning: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Danger - Red (cards, errors, timer < 5 sec)
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
        // Info - Blu chiaro (tooltips, information)
        info: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        // Surface colors for cards (adjusted for Stadium Nights)
        surface: {
          50: '#2d3139',   // Border color
          100: '#252830',  // Hover states
          200: '#1a1c20',  // Card background
          300: '#111214',  // Elevated elements
          400: '#0a0a0b',  // Body background
          500: '#050506',
          600: '#000000',
        },
        // Legacy teal colors for gradual transition (deprecated)
        legacy: {
          400: '#38b2ac',
          500: '#319795',
          600: '#2c7a7b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        sport: ['Oswald', 'Inter', 'system-ui', 'sans-serif'], // Stadium scoreboard style
        theme: ['var(--font-family)', 'system-ui', 'sans-serif'], // Dynamic theme font
      },
      backgroundImage: {
        'pitch-gradient': 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
        'stadium-gradient': 'linear-gradient(180deg, #1a1f2e 0%, #0f1318 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(42, 49, 66, 0.8) 0%, rgba(26, 31, 44, 0.9) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.3)',           // Blu stadio glow
        'glow-strong': '0 0 30px rgba(59, 130, 246, 0.5)',    // Stronger glow
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.3)',      // Gold/accent glow
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.3)',      // Success/verde campo
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.3)',     // Danger glow
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
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.8)' },
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
