/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"] },
      colors: {
        primary: { DEFAULT: "#4F46E5", light: "#6366F1", dark: "#4338CA" },
        secondary: { DEFAULT: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
      },
      boxShadow: { soft: "0 4px 6px rgba(0,0,0,0.08)" },
      borderRadius: { xl: "1rem", "2xl": "1.5rem" },
    },
  },
  plugins: [],
};
