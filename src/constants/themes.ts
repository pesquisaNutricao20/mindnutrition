export type AppTheme = {
  id: string;
  name: string;
  description: string;
  colors: {
    ink: string;
    paper: string;
    accent: string;
    accentPink: string;
    accentLight: string;
    accentPinkLight: string;
    line: string;
  };
};

export const APP_THEMES: AppTheme[] = [
  {
    id: 'ocean',
    name: 'Oceano Azul',
    description: 'A identidade visual exclusiva do Mind Nutrition.',
    colors: {
      ink: '#273238',
      paper: '#F5FAFB',
      accent: '#31889B',
      accentPink: '#7B91C8',
      accentLight: '#D6EEF2',
      accentPinkLight: '#E4E8F7',
      line: 'rgba(39, 50, 56, 0.14)',
    },
  },
];

export const DEFAULT_THEME_ID = 'ocean';
