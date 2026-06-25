/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "SF Mono", "ui-monospace", "monospace"],
      },
      colors: {
        primary: { DEFAULT: "#4F46E5", light: "#6366F1", dark: "#4338CA" },
        secondary: { DEFAULT: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
        success: { DEFAULT: "#22C55E", light: "#4ADE80", dark: "#16A34A" },
        warning: { DEFAULT: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
        danger: { DEFAULT: "#EF4444", light: "#F87171", dark: "#DC2626" },
        info: { DEFAULT: "#3B82F6", light: "#60A5FA", dark: "#2563EB" },
        surface: {
          1: "#0F172A",
          2: "#1E293B",
          3: "#334155",
        },
      },
      boxShadow: { soft: "0 4px 6px rgba(0,0,0,0.08)" },
      borderRadius: { xl: "1rem", "2xl": "1.5rem" },
    },
  },
  plugins: [],
};
