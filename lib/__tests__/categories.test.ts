import { CATEGORIES, CATEGORY_RAMPS, CATEGORY_ICONS } from '../ui/categories';

// Color amber reservado a la racha (CLAUDE.md regla 2) y su tinte/texto.
const RESERVED_AMBER = ['#EF9F27', '#FAEEDA', '#633806'];

describe('CATEGORY_RAMPS', () => {
  it('tiene una rampa para cada categoría', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_RAMPS[c]).toBeDefined();
      expect(CATEGORY_RAMPS[c].bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(CATEGORY_RAMPS[c].text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('ninguna rampa usa el amber reservado a la racha', () => {
    for (const c of CATEGORIES) {
      const { bg, text } = CATEGORY_RAMPS[c];
      expect(RESERVED_AMBER).not.toContain(bg.toUpperCase());
      expect(RESERVED_AMBER).not.toContain(text.toUpperCase());
    }
  });

  it('Gastronomía y Economía tienen los colores reasignados', () => {
    expect(CATEGORY_RAMPS['Gastronomía']).toEqual({ bg: '#FBEAF1', text: '#8A2D5C' });
    expect(CATEGORY_RAMPS['Economía']).toEqual({ bg: '#ECF0E4', text: '#4C5A2E' });
  });
});

describe('CATEGORY_ICONS', () => {
  it('tiene un icono para cada categoría', () => {
    for (const c of CATEGORIES) {
      expect(typeof CATEGORY_ICONS[c]).toBe('string');
      expect(CATEGORY_ICONS[c].length).toBeGreaterThan(0);
    }
  });
});
