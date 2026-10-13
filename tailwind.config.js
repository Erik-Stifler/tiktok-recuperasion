/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-cyan': '#25f4ee',
        'brand-red': '#fe2c55',
      },
    },
  },
  plugins: [],
}