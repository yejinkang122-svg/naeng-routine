export const theme = {
  colors: {
    ink: "#1d1d1f",
    inkMuted: "#7a7a7a",
    inkFaint: "#cccccc",
    canvas: "#ffffff",
    parchment: "#f5f5f7",
    surfacePearl: "#fafafc",
    divider: "#f0f0f0",
    hairline: "#e0e0e0",
    action: "#FF5500",
    actionFocus: "#FF7722",
    danger: "#c0392b"
  },
  radius: {
    card: "32px",
    lg: "18px",
    md: "14px",
    sm: "8px",
    pill: "9999px"
  },
  motion: {
    standard: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
    progress: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
  }
} as const;
