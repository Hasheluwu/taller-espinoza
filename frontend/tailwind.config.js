export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontSize: {
        '2xs': 'var(--text-2xs)',
        xs: 'var(--text-xs)',
        sm: 'var(--text-small)',
        base: 'var(--text-body)',
        lg: 'var(--text-body-lg)',
        xl: 'var(--text-subtitle)',
        '2xl': 'var(--text-h)',
        '3xl': 'var(--text-title)',
      },
    },
  },
  plugins: [],
}