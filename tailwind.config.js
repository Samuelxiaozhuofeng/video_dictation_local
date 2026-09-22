/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.tsx', './components/**/*.tsx', './hooks/**/*.{ts,tsx}', './utils/**/*.ts'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F1E6',
        page: '#FFFDF7',
        line: '#DED5C2',
        ink: '#2B2521',
        mute: '#7A7066',
        green: '#2F6B4F',
        'green-soft': '#DCEBDF',
        ochre: '#B8702A',
        'ochre-soft': '#F5E3C6',
        highlight: '#FBEFB4',
        rose: '#B94A3A',
        'rose-soft': '#F5D9D2',
        shade: '#E8E1D2',
      },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces Variable"', '"Songti SC"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(43,37,33,.05), 0 6px 16px rgba(43,37,33,.06)',
        lift: '0 2px 4px rgba(43,37,33,.08), 0 16px 40px rgba(43,37,33,.14)',
      },
    },
  },
}
