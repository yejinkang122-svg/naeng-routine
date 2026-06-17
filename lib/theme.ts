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

export const themeBackgroundColors: Record<string, string> = {
  summer_surf: "#19b7e9",
  autumn_walk: "#9bbb97",
  winter_room: "#f5f5f7",
  spring_flower: "#f39cc9"
};

export const themeBackgrounds: Record<string, string> = {
  summer_surf:
    'linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12)), url("/background_summer.gif") center / cover no-repeat, #19b7e9',
  autumn_walk: "#9bbb97",
  winter_room: "#f5f5f7",
  spring_flower: "#f39cc9"
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function getAccessibleHeaderTextColor(themeKey = "summer_surf") {
  const background = themeBackgroundColors[themeKey] || themeBackgroundColors.summer_surf;
  const muted = theme.colors.inkMuted;

  if (contrastRatio(muted, background) >= 4.5) {
    return muted;
  }

  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}

export function applyThemeToDocument(themeKey = "summer_surf") {
  const background = themeBackgrounds[themeKey] || themeBackgrounds.summer_surf;
  const backgroundColor = themeBackgroundColors[themeKey] || themeBackgroundColors.summer_surf;
  const headerColor = getAccessibleHeaderTextColor(themeKey);

  document.documentElement.style.setProperty("--header-text-color", headerColor);
  document.body.style.background = background;
  document.body.style.backgroundColor = backgroundColor;
}
