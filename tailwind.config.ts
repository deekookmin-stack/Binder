import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#1B0F16",
        surface: "#221118",
        surfaceraised: "#2B1620",
        ink: "#F5E9EE",
        inkmuted: "#B08A97",
        line: "#3D2029",
        violet: {
          DEFAULT: "#A31E4E",
          dark: "#7E1739"
        },
        ruby: {
          DEFAULT: "#A31E4E",
          bright: "#D42A63",
          bg: "#3A1526"
        },
        gold: "#C9A15A",
        goldbright: "#E6C27A",
        blush: "#E091A8",
        complete: "#E091A8",
        completebg: "rgba(224,145,168,0.12)",
        progress: "#C9A15A",
        progressbg: "rgba(201,161,90,0.12)",
        notstarted: "#7A6169",
        notstartedbg: "rgba(122,97,105,0.15)",
        am: "#B87FD9",
        ambg: "rgba(184,127,217,0.12)",
        regular: "#7FB0D9",
        regularbg: "rgba(127,176,217,0.12)"
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-jakarta)", "sans-serif"]
      },
      borderRadius: {
        card: "14px"
      }
    }
  },
  plugins: []
};

export default config;
