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
        'logo': ['var(--font-cinzel-decorative)', 'serif'],
        'heading': ['var(--font-cinzel)', 'serif'],
        'subtitle': ['var(--font-montserrat)', 'sans-serif'],
        'body': ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'score': ['var(--font-bebas-neue)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
