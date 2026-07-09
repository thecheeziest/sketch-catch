import { makeTheme } from 'dripsy';

export const colors = {
  // PRIMARY
  PRIMARY_100: '#FFD0E8',
  PRIMARY_200: '#FF88BB',
  PRIMARY_300: '#FF3388',
  PRIMARY_400: '#FF0077',
  PRIMARY_500: '#BB0055',

  // SECONDARY
  SECONDARY_100: '#E8CCFF',
  SECONDARY_200: '#BB77FF',
  SECONDARY_300: '#8833FF',
  SECONDARY_400: '#6600EE',
  SECONDARY_500: '#3B0099',

  // INFO
  INFO_100: '#CCE0FF',
  INFO_200: '#77AAFF',
  INFO_300: '#3377FF',
  INFO_400: '#0055FF',
  INFO_500: '#002ECC',

  // ERROR
  ERROR_100: '#FFD0CC',
  ERROR_200: '#FF7766',
  ERROR_300: '#FF3322',
  ERROR_400: '#FF1100',
  ERROR_500: '#BB0000',

  // ACCENT
  ACCENT_100: '#C8FFE4',
  ACCENT_200: '#72e0a2',
  ACCENT_300: '#08ec7b',
  ACCENT_400: '#04c165',
  ACCENT_500: '#046335',

  // SUCCESS
  SUCCESS_100: '#CCFFDD',
  SUCCESS_200: '#66FF99',
  SUCCESS_300: '#22FF66',
  SUCCESS_400: '#00FF44',
  SUCCESS_500: '#00AA22',

  // WARNING
  WARNING_100: '#FFFACC',
  WARNING_200: '#FFEE66',
  WARNING_300: '#FFE000',
  WARNING_400: '#FFCC00',
  WARNING_500: '#CC8800',

  // LIGHT
  LIGHT_100: '#FAFAFA',
  LIGHT_200: '#F5F5F5',
  LIGHT_300: '#E8E8E8',
  LIGHT_400: '#D4D4D4',
  LIGHT_500: '#BBBBBB',

  // DARK
  DARK_100: '#2D2B3D',
  DARK_200: '#1E1C2C',
  DARK_300: '#141220',
  DARK_400: '#0C0A16',
  DARK_500: '#06050C',

  GRAY: '#7A7660',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
} as const;

export const spacing = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
  XXXL: 64,
} as const;

export const fontFamily = {
  REGULAR: 'Galmuri11',
  BOLD: 'Mona12-Bold',
} as const;

export const textSizes = {
  H1: { fontSize: 28, lineHeight: 36 },
  H2: { fontSize: 26, lineHeight: 34 },
  H3: { fontSize: 24, lineHeight: 32 },
  T1: { fontSize: 22, lineHeight: 30 },
  T2: { fontSize: 20, lineHeight: 28 },
  T3: { fontSize: 18, lineHeight: 26 },
  B1: { fontSize: 16, lineHeight: 24 },
  B2: { fontSize: 14, lineHeight: 22 },
  B3: { fontSize: 12, lineHeight: 20 },
  B4: { fontSize: 10, lineHeight: 18 },
} as const;

export const theme = makeTheme({
  text: {
    body: { fontFamily: fontFamily.REGULAR, ...textSizes.B1 },
    bold: { fontFamily: fontFamily.BOLD },
    H1: textSizes.H1,
    H2: textSizes.H2,
    H3: textSizes.H3,
    T1: textSizes.T1,
    T2: textSizes.T2,
    T3: textSizes.T3,
    B1: textSizes.B1,
    B2: textSizes.B2,
    B3: textSizes.B3,
    B4: textSizes.B4,
  },
  colors: {
    $primary100: colors.PRIMARY_100,
    $primary200: colors.PRIMARY_200,
    $primary300: colors.PRIMARY_300,
    $primary400: colors.PRIMARY_400,
    $primary500: colors.PRIMARY_500,
    $secondary100: colors.SECONDARY_100,
    $secondary200: colors.SECONDARY_200,
    $secondary300: colors.SECONDARY_300,
    $secondary400: colors.SECONDARY_400,
    $secondary500: colors.SECONDARY_500,
    $info100: colors.INFO_100,
    $info200: colors.INFO_200,
    $info300: colors.INFO_300,
    $info400: colors.INFO_400,
    $info500: colors.INFO_500,
    $error100: colors.ERROR_100,
    $error200: colors.ERROR_200,
    $error300: colors.ERROR_300,
    $error400: colors.ERROR_400,
    $error500: colors.ERROR_500,
    $accent100: colors.ACCENT_100,
    $accent200: colors.ACCENT_200,
    $accent300: colors.ACCENT_300,
    $accent400: colors.ACCENT_400,
    $accent500: colors.ACCENT_500,
    $success100: colors.SUCCESS_100,
    $success200: colors.SUCCESS_200,
    $success300: colors.SUCCESS_300,
    $success400: colors.SUCCESS_400,
    $success500: colors.SUCCESS_500,
    $warning100: colors.WARNING_100,
    $warning200: colors.WARNING_200,
    $warning300: colors.WARNING_300,
    $warning400: colors.WARNING_400,
    $warning500: colors.WARNING_500,
    $light100: colors.LIGHT_100,
    $light200: colors.LIGHT_200,
    $light300: colors.LIGHT_300,
    $light400: colors.LIGHT_400,
    $light500: colors.LIGHT_500,
    $dark100: colors.DARK_100,
    $dark200: colors.DARK_200,
    $dark300: colors.DARK_300,
    $dark400: colors.DARK_400,
    $dark500: colors.DARK_500,
    $gray: colors.GRAY,
    $white: colors.WHITE,
    $black: colors.BLACK,
  },
});
