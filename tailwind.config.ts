import type { Config } from "tailwindcss";

// Paleta inspirada en el cliente de League of Legends
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#010A13", // fondo principal (negro azulado)
          900: "#0A0E13",
          800: "#111418",
          700: "#1E2328", // gris de paneles
          600: "#2A2E33",
          500: "#3C3C41", // bordes
        },
        gold: {
          50: "#F0E6D2", // blanco hueso
          100: "#E3D4AE",
          200: "#C8AA6E", // dorado LoL
          300: "#C89B3C", // amarillo de la "L"
          400: "#A47D35",
          500: "#785A28", // café / bronce
          600: "#5B4520",
          700: "#463714", // café oscuro
        },
        hex: {
          100: "#CDFAFA",
          200: "#0AC8B9", // azul hextech
          300: "#0397AB",
          400: "#005A82",
          500: "#0A323C",
        },
        stone: { 300: "#A09B8C", 400: "#7B7A72" },
        blood: "#E84057",
        win: "#2DD4A8",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(200,170,110,.35), 0 8px 30px -10px rgba(200,155,60,.35)",
        hex: "0 0 24px -6px rgba(10,200,185,.55)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg,#C8AA6E 0%,#C89B3C 45%,#785A28 100%)",
        "gold-line": "linear-gradient(90deg,transparent,#C8AA6E,transparent)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(10,200,185,.5)" },
          "100%": { boxShadow: "0 0 0 12px rgba(10,200,185,0)" },
        },
      },
      animation: {
        shimmer: "shimmer 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
