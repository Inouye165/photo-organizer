import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f7f1e7",
        ink: "#1c1f21",
        moss: "#4c6444",
        clay: "#b86432",
        mist: "#d9e3e2",
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        serif: ["'Newsreader'", "serif"],
      },
      boxShadow: {
        panel: "0 24px 70px rgba(28, 31, 33, 0.12)",
      },
      backgroundImage: {
        "hero-wash": "radial-gradient(circle at top left, rgba(184,100,50,0.18), transparent 28%), radial-gradient(circle at top right, rgba(76,100,68,0.14), transparent 24%), linear-gradient(180deg, #f7f1e7 0%, #fefbf7 42%, #eef3ef 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
