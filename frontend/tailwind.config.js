/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#f0f7f2', 100: '#dcefe2', 200: '#b9dfc6', 600: '#1f6b3d', 700: '#185a33', 800: '#14532d', 900: '#0f3d22', 950: '#0a2716' },
        emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857' },
        charcoal: { 400: '#6b7280', 500: '#4b5563', 600: '#374151', 700: '#2b3441', 800: '#1f2937', 900: '#111827' },
        canvas: '#f5f7f6',
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        lift: '0 8px 24px -6px rgba(16,24,40,0.12)',
      },
    },
  },
  plugins: [],
};
