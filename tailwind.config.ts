import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF7FB",
        surface: "#FFFFFF",
        ink: "#241B2F",
        inkmuted: "#6B5E76",
        line: "#E7DFEB",
        violet: {
          DEFAULT: "#7C5CBF",
          dark: "#5C3E9E"
        },
        blush: "#E8A0BF",
        complete: "#3F8F6E",
        completebg: "#E4F3EC",
        progress: "#C97B3D",
        progressbg: "#FBEBDC",
        notstarted: "#8A7E96",
        notstartedbg: "#EFEAF2",
        am: "#9457C9",
        ambg: "#F1E7FA",
        regular: "#3D7FBF",
        regularbg: "#E3EFFA"
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
