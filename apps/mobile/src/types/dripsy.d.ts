import { theme } from '@/shared/config/theme'

type DripsyTheme = typeof theme;

declare module 'dripsy' {
  interface DripsyCustomTheme extends DripsyTheme {}
}
