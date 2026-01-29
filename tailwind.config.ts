import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand navy - the existing accent color
        accent: "#1d3161",
        "accent-hover": "#172747",
        "accent-light": "#2a4480",
      },
    },
  },
  plugins: [],
};
export default config;
