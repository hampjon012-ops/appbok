export const ONBOARDING_THEME_PRESETS = [
  {
    id: 'hair-warm-walnut',
    industryIds: ['hair', 'barber', 'sport', 'custom'],
    name: 'Warm Walnut',
    description: 'Boutique-salong med varm valnot, speglar och mjuk belysning.',
    bg: '#fbf4ea',
    text: '#2d2218',
    primary: '#7c4a2d',
    accent: '#ead9c8',
    image: '/images/onboarding/hair-warm-walnut.jpg',
  },
  {
    id: 'hair-nordic-studio',
    industryIds: ['hair', 'custom'],
    name: 'Nordic Studio',
    description: 'Ljust, rent och skandinaviskt med mjuk salongskansla.',
    bg: '#ffffff',
    text: '#111827',
    primary: '#000000',
    accent: '#f3f4f6',
    image: '/images/onboarding/hair-nordic-studio.jpg',
  },
  {
    id: 'hair-soft-blonde',
    industryIds: ['hair', 'custom'],
    name: 'Soft Blonde',
    description: 'Varm champagne, mjuka blonda toner och elegant beauty-kansla.',
    bg: '#fffaf3',
    text: '#2f241b',
    primary: '#9a6a3f',
    accent: '#f2e7d8',
    image: '/images/onboarding/hair-soft-blonde.jpg',
  },
  {
    id: 'hair-noir-salon',
    industryIds: ['hair', 'barber', 'tattoo', 'custom'],
    name: 'Noir Salon',
    description: 'Morkt, exklusivt och high-end med subtila metallreflektioner.',
    bg: '#0f0f10',
    text: '#f8fafc',
    primary: '#f4f4f5',
    primaryText: '#111827',
    accent: '#1a1a1c',
    surface: '#151517',
    footer: '#18181b',
    image: '/images/onboarding/hair-noir-salon.jpg',
  },
  {
    id: 'hair-barber-steel',
    industryIds: ['barber', 'custom'],
    name: 'Barber Steel',
    description: 'Maskulint barber-uttryck med lader, stal och varmt tra.',
    bg: '#11100f',
    text: '#f7f2eb',
    primary: '#9a5f38',
    primaryText: '#fff7ed',
    accent: '#201c18',
    surface: '#171412',
    footer: '#1d1915',
    image: '/images/onboarding/hair-barber-steel.jpg',
  },
];

export function onboardingThemeToSalonTheme(theme) {
  if (!theme) return null;
  return {
    backgroundColor: theme.bg,
    primaryAccent: theme.primary,
    secondaryColor: theme.accent,
    textColor: theme.text,
    backgroundImageUrl: theme.image,
    themePreset: theme.id,
  };
}

export function findOnboardingThemePreset(themeId) {
  return ONBOARDING_THEME_PRESETS.find((theme) => theme.id === themeId) || null;
}
