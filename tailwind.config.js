/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary accent — navigation, primary actions, links. NOT used for
        // status/urgency, so "what to tap" and "what needs attention" never
        // collide in the same color. Royal blue — vivid, saturated, still
        // matte (flat fill, no gloss/highlight).
        brand: {
          50: "#EBF1FE",
          100: "#CBDBFC",
          400: "#5A82E8",
          DEFAULT: "#1D4ED8",
          dark: "#1638A8",
          light: "#EBF1FE",
        },
        // Reserved urgency/alert color — active incidents that need attention.
        // Used nowhere else in the app, so its meaning stays unambiguous.
        alert: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          DEFAULT: "#DC2626",
          dark: "#B91C1C",
        },
        // Darker than typical "muted text" grays on purpose — high
        // contrast over softness, per direction: flat, not washed out.
        ink: {
          DEFAULT: "#0B0F19",
          soft: "#374151",
          faint: "#4B5563",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
