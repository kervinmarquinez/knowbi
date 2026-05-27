import { contrastRatio } from '../contrast';
import { CATEGORIES, CATEGORY_RAMPS } from '../ui/categories';

const BODY_TEXT = '#444441'; // color del cuerpo de la píldora

describe('contrastRatio', () => {
  it('da ~21 entre negro y blanco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#444441', '#E1F5EE')).toBeCloseTo(
      contrastRatio('#E1F5EE', '#444441'),
      5,
    );
  });
});

describe('guard AA: cuerpo sobre el tinte de cada categoría', () => {
  it('todas las rampas cumplen AA (≥ 4.5:1) para el texto del cuerpo', () => {
    for (const c of CATEGORIES) {
      const ratio = contrastRatio(BODY_TEXT, CATEGORY_RAMPS[c].bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
