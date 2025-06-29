/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#5217E5",
        secondary: "F2F0F5",
        secondaryBackground: "#6E6387",
        background: "#fff",

      },
      fontFamily: {
        sans: ["Inter", "System"],
      },
    },
  },
  plugins: [],
}