import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dce6ff",
          200: "#b8ccff",
          300: "#8aa9ff",
          400: "#5c7fff",
          500: "#3855f5",
          600: "#2a3fd1",
          700: "#2431a6",
          800: "#212a80",
          900: "#1d2566",
        },
      },
    },
  },
  plugins: [],
};
export default config;
