/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary accent — navigation, primary actions, links. NOT used for
        // status/urgency, so "what to tap" and "what needs attention" never
        // collide in the same color. Imperial Blue (#021F94) - the
        // resident-provided reference palette, rolled out app-wide (it had
        // been scoped to bot.tsx only at first). Shades below are tints/
        // shades derived from that one hex, not independently chosen.
        brand: {
          50: "#E3E6F4",
          100: "#C7CCEA",
          400: "#5B6DB9",
          DEFAULT: "#021F94",
          dark: "#011760",
          light: "#E3E6F4",
        },
        // Reserved urgency/alert color — active incidents, urgent contacts
        // (directory.tsx), and the Emergency quick-access icon (home.tsx)
        // are the intentional uses. Never use for a purely
        // navigational/non-urgent element.
        //
        // Deepened to match Imperial Blue's weight: the old #DC2626 was a
        // bright, saturated "warning-label" red sitting next to a very
        // dark, saturated navy - the two didn't read as one family, the
        // red looked lighter/louder by comparison even at equal sizes.
        // This value is picked at roughly the same lightness as
        // brand.DEFAULT (~29-30% L) so red and blue carry the same visual
        // weight as a pair, the way they're actually used together
        // (PrimaryEmergencyBar vs. ContactRow's call segment).
        alert: {
          50: "#FEF2F2",
          100: "#FBDEDE",
          DEFAULT: "#8B1220",
          dark: "#5C0C15",
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
