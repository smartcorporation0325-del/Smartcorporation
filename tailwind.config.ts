import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B1D33", // dark blue
        mist: "#F5F7FA", // soft gray
        cloud: "#E7EBF0",
        accent: "#0F9D8C", // teal/green accent
        accentDark: "#0B7A6D",
        danger: "#C0392B",
        warn: "#B8860B",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,29,51,0.06), 0 1px 8px rgba(11,29,51,0.05)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
