module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        cyscom: '#00B4D8',
        pagebg: '#0D1117',
        cyberblue: {
          100: '#E0FBFC',
          200: '#BEF8FD',
          300: '#8AECF7',
          400: '#48D7EB',
          500: '#00B4D8',
          600: '#0098B7',
          700: '#007090',
          800: '#005566',
          900: '#003B47'
        },
        cyberdark: {
          700: '#1A2130',
          800: '#131A24', 
          900: '#0D1117'
        }
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 180, 216, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 180, 216, 0.7)' }
        }
      },
    },
  },
  plugins: [],
}
