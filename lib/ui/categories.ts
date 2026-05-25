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
  Gastronomía: { bg: '#FAEEDA', text: '#633806' },
  Economía: { bg: '#FAEEDA', text: '#633806' },
};
