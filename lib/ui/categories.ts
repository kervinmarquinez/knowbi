import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type Category =
  | 'Historia'
  | 'Geografía'
  | 'Literatura'
  | 'Ciencia'
  | 'Naturaleza'
  | 'Medicina'
  | 'Arte'
  | 'Arquitectura'
  | 'Cine'
  | 'Psicología'
  | 'Astronomía'
  | 'Tecnología'
  | 'Música'
  | 'Deporte'
  | 'Gastronomía'
  | 'Economía';

export const CATEGORIES: Category[] = [
  'Ciencia',
  'Historia',
  'Astronomía',
  'Arte',
  'Tecnología',
  'Música',
  'Gastronomía',
  'Naturaleza',
  'Cine',
  'Psicología',
  'Literatura',
  'Geografía',
  'Medicina',
  'Deporte',
  'Economía',
  'Arquitectura',
];

export const CATEGORY_RAMPS: Record<Category, { bg: string; text: string }> = {
  Historia: { bg: '#F1EFE8', text: '#444441' },
  Geografía: { bg: '#F1EFE8', text: '#444441' },
  Literatura: { bg: '#F1EFE8', text: '#444441' },
  Ciencia: { bg: '#E1F5EE', text: '#085041' },
  Naturaleza: { bg: '#E1F5EE', text: '#085041' },
  Medicina: { bg: '#E1F5EE', text: '#085041' },
  Arte: { bg: '#FAECE7', text: '#993C1D' },
  Arquitectura: { bg: '#FAECE7', text: '#993C1D' },
  Cine: { bg: '#FAECE7', text: '#993C1D' },
  Psicología: { bg: '#EEEDFE', text: '#3C3489' },
  Astronomía: { bg: '#EEEDFE', text: '#3C3489' },
  Tecnología: { bg: '#E6F1FB', text: '#0C447C' },
  Música: { bg: '#E6F1FB', text: '#0C447C' },
  Deporte: { bg: '#E6F1FB', text: '#0C447C' },
  Gastronomía: { bg: '#FBEAF1', text: '#8A2D5C' },
  Economía: { bg: '#ECF0E4', text: '#4C5A2E' },
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_ICONS: Record<Category, IoniconName> = {
  Ciencia: 'flask',
  Historia: 'hourglass',
  Astronomía: 'planet',
  Arte: 'color-palette',
  Tecnología: 'hardware-chip',
  Música: 'musical-notes',
  Gastronomía: 'restaurant',
  Naturaleza: 'leaf',
  Cine: 'film',
  Psicología: 'happy',
  Literatura: 'book',
  Geografía: 'earth',
  Medicina: 'medkit',
  Deporte: 'fitness',
  Economía: 'trending-up',
  Arquitectura: 'business',
};
