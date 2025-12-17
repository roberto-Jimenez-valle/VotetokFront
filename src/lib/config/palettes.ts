// Paletas de colores para el globo (sincronizadas con UnifiedThemeToggle)
export interface Palette {
  name: string;
  bg: string;
  sphere: string;
  stroke: string;
  noData: string;
  atmosphere: string;
}

export const DARK_PALETTES: Palette[] = [
  { name: "carbon", bg: "#0a0a0a", sphere: "#1a1a1a", stroke: "#2e2e2e", noData: "#141414", atmosphere: "#1a1a1a" },
  { name: "dark", bg: "#000000", sphere: "#161b22", stroke: "#30363d", noData: "#181a20", atmosphere: "#161b22" },
  { name: "slate", bg: "#0e1012", sphere: "#1a1e24", stroke: "#2e3640", noData: "#14181c", atmosphere: "#1a1e24" },
  { name: "steel", bg: "#0f1113", sphere: "#1c2026", stroke: "#303840", noData: "#151a1e", atmosphere: "#1c2026" },
  { name: "graphite", bg: "#0d0f10", sphere: "#191d20", stroke: "#2d3338", noData: "#13161a", atmosphere: "#191d20" },
  { name: "deep-purple", bg: "#0a0015", sphere: "#1a0b2e", stroke: "#3d1e6d", noData: "#16003e", atmosphere: "#1a0b2e" },
  { name: "midnight-purple", bg: "#0f0a1e", sphere: "#1a1234", stroke: "#2e2052", noData: "#150f28", atmosphere: "#1a1234" },
  { name: "violet-night", bg: "#100920", sphere: "#1e1238", stroke: "#3a2561", noData: "#180e2d", atmosphere: "#1e1238" },
  { name: "indigo-night", bg: "#08091a", sphere: "#0f1233", stroke: "#1e245c", noData: "#0c0e26", atmosphere: "#0f1233" },
  { name: "magenta-night", bg: "#1a001a", sphere: "#2e002e", stroke: "#4d004d", noData: "#240024", atmosphere: "#2e002e" },
  { name: "ocean-night", bg: "#001a2e", sphere: "#002642", stroke: "#284b63", noData: "#003049", atmosphere: "#002642" },
  { name: "cyber-blue", bg: "#000d1a", sphere: "#001a33", stroke: "#00334d", noData: "#00152b", atmosphere: "#001a33" },
  { name: "navy-deep", bg: "#00101c", sphere: "#001e36", stroke: "#003d5c", noData: "#001829", atmosphere: "#001e36" },
  { name: "arctic-night", bg: "#0a1420", sphere: "#14263d", stroke: "#284a66", noData: "#101d2e", atmosphere: "#14263d" },
  { name: "aqua-deep", bg: "#001a1a", sphere: "#002e2e", stroke: "#004d4d", noData: "#002424", atmosphere: "#002e2e" },
  { name: "teal-deep", bg: "#081615", sphere: "#0f2928", stroke: "#1a4d4a", noData: "#0c1f1e", atmosphere: "#0f2928" },
  { name: "turquoise-night", bg: "#001a15", sphere: "#002e26", stroke: "#004d42", noData: "#002219", atmosphere: "#002e26" },
  { name: "forest-dark", bg: "#0d1b0f", sphere: "#1b2e1f", stroke: "#2d4a33", noData: "#19291c", atmosphere: "#1b2e1f" },
  { name: "emerald-night", bg: "#081512", sphere: "#102822", stroke: "#1d4a3d", noData: "#0d1e19", atmosphere: "#102822" },
  { name: "jade-dark", bg: "#091713", sphere: "#112924", stroke: "#1f4a40", noData: "#0e201c", atmosphere: "#112924" },
  { name: "lime-dark", bg: "#0f1a00", sphere: "#1c2e00", stroke: "#304d00", noData: "#162200", atmosphere: "#1c2e00" },
  { name: "gold-dark", bg: "#1a1500", sphere: "#2e2600", stroke: "#4d4200", noData: "#221c00", atmosphere: "#2e2600" },
  { name: "amber-dark", bg: "#1a1200", sphere: "#2e2200", stroke: "#524000", noData: "#221a00", atmosphere: "#2e2200" },
  { name: "orange-night", bg: "#1a0800", sphere: "#2e1400", stroke: "#4d2400", noData: "#220e00", atmosphere: "#2e1400" },
  { name: "copper-night", bg: "#1a0d00", sphere: "#2e1800", stroke: "#4d2800", noData: "#221100", atmosphere: "#2e1800" },
  { name: "bronze-night", bg: "#1a0f00", sphere: "#2e1c00", stroke: "#523600", noData: "#221400", atmosphere: "#2e1c00" },
  { name: "crimson-dark", bg: "#1a0000", sphere: "#2b0808", stroke: "#4a1414", noData: "#1f0303", atmosphere: "#2b0808" },
  { name: "ruby-night", bg: "#180005", sphere: "#2a0a10", stroke: "#4d1a25", noData: "#1e0408", atmosphere: "#2a0a10" },
  { name: "burgundy", bg: "#150008", sphere: "#26000f", stroke: "#45001f", noData: "#1b000c", atmosphere: "#26000f" },
  { name: "pink-dark", bg: "#1a0010", sphere: "#2e001e", stroke: "#4d0033", noData: "#220016", atmosphere: "#2e001e" },
];

export const LIGHT_PALETTES: Palette[] = [
  { name: "cloud", bg: "#d0d2d4", sphere: "#bcc0c4", stroke: "#a8adb2", noData: "#c4c7ca", atmosphere: "#bcc0c4" },
  { name: "pearl", bg: "#d3d3d3", sphere: "#c0c0c0", stroke: "#adadad", noData: "#c8c8c8", atmosphere: "#c0c0c0" },
  { name: "silver", bg: "#c8cacc", sphere: "#b5b8bb", stroke: "#a1a5a9", noData: "#bdc0c3", atmosphere: "#b5b8bb" },
  { name: "cream", bg: "#d7d7d7", sphere: "#c7c7c7", stroke: "#b7b7b7", noData: "#cfcfcf", atmosphere: "#c7c7c7" },
  { name: "ivory", bg: "#d8d8d6", sphere: "#c8c8c4", stroke: "#b8b8b2", noData: "#d0d0cd", atmosphere: "#c8c8c4" },
  { name: "lavender-mist", bg: "#d0cfe0", sphere: "#bdbccf", stroke: "#aaa8be", noData: "#c6c5d8", atmosphere: "#bdbccf" },
  { name: "lilac-dream", bg: "#d2d0e1", sphere: "#bfbdd1", stroke: "#aca9c0", noData: "#c8c6d9", atmosphere: "#bfbdd1" },
  { name: "purple-haze", bg: "#c5c3d8", sphere: "#b2b0c5", stroke: "#9e9bb2", noData: "#bbb9ce", atmosphere: "#b2b0c5" },
  { name: "violet-soft", bg: "#d8d0e0", sphere: "#c5bdd1", stroke: "#b0a8be", noData: "#cec6d8", atmosphere: "#c5bdd1" },
  { name: "sky-whisper", bg: "#c8d7e1", sphere: "#b5c7d1", stroke: "#a0b6c0", noData: "#becfd9", atmosphere: "#b5c7d1" },
  { name: "ice-blue", bg: "#c9d8e2", sphere: "#b6c8d2", stroke: "#a1b7c1", noData: "#bfd0da", atmosphere: "#b6c8d2" },
  { name: "ocean-mist", bg: "#c0d0d8", sphere: "#adc0c8", stroke: "#98afb7", noData: "#b6c8d0", atmosphere: "#adc0c8" },
  { name: "steel-blue", bg: "#b8c8d0", sphere: "#a5b8c0", stroke: "#90a7af", noData: "#aec0c8", atmosphere: "#a5b8c0" },
  { name: "aqua-light", bg: "#c0d8d8", sphere: "#adc8c8", stroke: "#98b7b7", noData: "#b6d0d0", atmosphere: "#adc8c8" },
  { name: "turquoise-soft", bg: "#b8e0d8", sphere: "#a5d0c8", stroke: "#90bfb6", noData: "#add8d0", atmosphere: "#a5d0c8" },
  { name: "mint-breeze", bg: "#c9d8d0", sphere: "#b6c8be", stroke: "#a1b7ab", noData: "#bfd0c6", atmosphere: "#b6c8be" },
  { name: "sage-whisper", bg: "#cad9d0", sphere: "#b7c9be", stroke: "#a2b8ab", noData: "#c0d1c6", atmosphere: "#b7c9be" },
  { name: "forest-mist", bg: "#c0d0c8", sphere: "#adc0b5", stroke: "#98afa0", noData: "#b6c8be", atmosphere: "#adc0b5" },
  { name: "emerald-light", bg: "#b8d0c8", sphere: "#a5c0b5", stroke: "#90afa0", noData: "#aec8be", atmosphere: "#a5c0b5" },
  { name: "lime-light", bg: "#d0e0b8", sphere: "#c0d0a5", stroke: "#afbf90", noData: "#c8d8ad", atmosphere: "#c0d0a5" },
  { name: "gold-light", bg: "#e0d8b0", sphere: "#d0c89d", stroke: "#bfb688", noData: "#d8d0a6", atmosphere: "#d0c89d" },
  { name: "sand", bg: "#d8d0c8", sphere: "#c5bdb5", stroke: "#b0a89f", noData: "#cec6be", atmosphere: "#c5bdb5" },
  { name: "beige", bg: "#d8d0c0", sphere: "#c5bdad", stroke: "#b0a898", noData: "#cec6b6", atmosphere: "#c5bdad" },
  { name: "orange-light", bg: "#e0c8b8", sphere: "#d0b8a5", stroke: "#bfa690", noData: "#d8c0ad", atmosphere: "#d0b8a5" },
  { name: "copper-soft", bg: "#e0c8b0", sphere: "#d0b89d", stroke: "#bfa688", noData: "#d8c0a6", atmosphere: "#d0b89d" },
  { name: "peach-silk", bg: "#dcd2ce", sphere: "#c9bfb9", stroke: "#b6aba4", noData: "#d6c8c3", atmosphere: "#c9bfb9" },
  { name: "terracotta", bg: "#d0c0b8", sphere: "#bdada5", stroke: "#a89890", noData: "#c6b6ae", atmosphere: "#bdada5" },
  { name: "rose-blush", bg: "#dcd0d3", sphere: "#c9bdc0", stroke: "#b6a9ad", noData: "#d6c6c9", atmosphere: "#c9bdc0" },
  { name: "coral-soft", bg: "#d8c8c8", sphere: "#c5b5b5", stroke: "#b0a0a0", noData: "#cebebe", atmosphere: "#c5b5b5" },
  { name: "pink-soft", bg: "#e0c0d0", sphere: "#d0adc0", stroke: "#bf98af", noData: "#d8b6c8", atmosphere: "#d0adc0" },
];

// Obtener paleta por nombre o índice, con soporte para tema claro/oscuro
export function getPalette(param: string | null, theme: string = 'dark'): Palette | null {
  if (!param) return null;
  
  const palettes = theme === 'light' ? LIGHT_PALETTES : DARK_PALETTES;
  
  // Intentar como índice numérico
  const index = parseInt(param, 10);
  if (!isNaN(index) && index >= 0 && index < palettes.length) {
    return palettes[index];
  }
  
  // Intentar como nombre (case-insensitive)
  const normalized = param.toLowerCase().replace(/\s+/g, '-');
  return palettes.find(p => p.name === normalized) || null;
}

// Obtener paleta por defecto según el tema
export function getDefaultPalette(theme: string = 'dark'): Palette {
  return theme === 'light' ? LIGHT_PALETTES[0] : DARK_PALETTES[0];
}
