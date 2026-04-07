import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#ea580c",
          "orange-dark": "#c2410c",
          blue: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Calibri", "Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
