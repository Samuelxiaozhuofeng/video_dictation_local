/** @type {import('tailwindcss').Config} */
// One accent (warm yellow) + a grey ramp on deep ink-teal. Nothing else.
export default {
  content: ['./index.html', './*.tsx', './components/**/*.tsx', './hooks/**/*.{ts,tsx}', './utils/**/*.ts'],
  theme: {
    extend: {
      colors: {
        paper: '#12262B',   // app background
        page: '#172E34',    // raised surfaces: dialogs, drawers, menus
        shade: '#1B3237',   // quiet fills: inputs, pills, hover
        line: '#26414A',    // hairlines
        faint: '#3E5A60',   // placeholders, empty word slots
        mute: '#7F8F8E',    // secondary text
        ink: '#EFE8DA',     // primary text
        accent: '#F2C94C',  // the one colour: caret, current word, primary action
        'accent-soft': '#313D30',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', '"Songti SC"', 'Georgia', 'serif'],
        mono: ['"Instrument Sans"', '"PingFang SC"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.25)',
        lift: '0 12px 32px rgba(0,0,0,.35)',
      },
    },
  },
}
