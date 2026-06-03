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
    id: 'mind',
    name: 'Mind Nutrition',
    description: 'Verde calmo com apoio rosado.',
    colors: {
      ink: '#2F3430',
      paper: '#F7FAF7',
      accent: '#4F9A83',
      accentPink: '#C1849E',
      accentLight: '#DDEFE8',
      accentPinkLight: '#F1DFE7',
      line: 'rgba(47, 52, 48, 0.13)',
    },
  },
  {
    id: 'citrus',
    name: 'Citrus Vivo',
    description: 'Fresco, claro e energético.',
    colors: {
      ink: '#26312E',
      paper: '#F9FBF5',
      accent: '#2F9F8E',
      accentPink: '#E2A146',
      accentLight: '#D9F2EC',
      accentPinkLight: '#F8E7C8',
      line: 'rgba(38, 49, 46, 0.14)',
    },
  },
  {
    id: 'berry',
    name: 'Berry Suave',
    description: 'Acolhedor com contraste elegante.',
    colors: {
      ink: '#332E36',
      paper: '#FAF7FA',
      accent: '#6D8F7D',
      accentPink: '#B85E8A',
      accentLight: '#E2ECE5',
      accentPinkLight: '#F2DDEA',
      line: 'rgba(51, 46, 54, 0.14)',
    },
  },
  {
    id: 'ocean',
    name: 'Oceano Claro',
    description: 'Azul esverdeado limpo e sereno.',
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

export const DEFAULT_THEME_ID = 'mind';
