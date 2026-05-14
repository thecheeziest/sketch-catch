export const theme = {
  colors: {
    background: '#FAFAF0',
    surface: '#EDE8D8',
    accentPrimary: '#C8A84B',
    accentSecondary: '#7BA05B',
    destructive: '#C0524A',
    textPrimary: '#2C2C1E',
    textSecondary: '#7A7660',
    border: '#C8C4A8',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  typography: {
    body: { fontSize: 14, lineHeight: 20 },
    label: { fontSize: 16, lineHeight: 22 },
    heading: { fontSize: 20, lineHeight: 28 },
    display: { fontSize: 28, lineHeight: 36 },
  },
  fontFamily: {
    regular: 'Galmuri11',
    bold: 'Galmuri11', // Bold 별도 파일 없을 경우 통일 (UI-SPEC §Typography 명시)
  },
} as const;

export type Theme = typeof theme;
