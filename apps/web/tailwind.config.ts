import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'nuffle-gold': '#CBA135',
        'nuffle-red': '#7A1F1F',
        'nuffle-ivory': '#E9E2D0',
        'nuffle-anthracite': '#1E1E1E',
        'nuffle-bronze': '#6B4E2E',
      },
      fontFamily: {
        'logo': ['Cinzel Decorative', 'serif'],
        'heading': ['Cinzel', 'serif'],
        'subtitle': ['Montserrat', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'score': ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
