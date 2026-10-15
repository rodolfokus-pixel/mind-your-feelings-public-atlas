import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
      colors: {
        atlas: {
          ink: "#f8fafc",
          night: "#07080d",
          deep: "#0d1222",
          mist: "#aab4c8",
          line: "rgba(255,255,255,0.13)",
        },
      },
      boxShadow: {
        aura: "0 0 60px rgba(125, 211, 252, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
