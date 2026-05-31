import { madridNowParts, windowDate, minutesUntilNextDrop, formatTimeUntil } from '../dropWindow';

// Toda la lógica de dropWindow lee `new Date()` y lo interpreta en Europe/Madrid.
// Fijamos el instante con fake timers para que los tests sean deterministas e
// independientes del reloj y la zona de la máquina que los corre.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// iso en UTC. Mayo = CEST (UTC+2); enero = CET (UTC+1).
function setNow(iso: string) {
  jest.setSystemTime(new Date(iso));
}

describe('madridNowParts', () => {
  it('devuelve fecha/hora/minuto en hora de Madrid (CEST en mayo)', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 en Madrid
    expect(madridNowParts()).toEqual({ dateISO: '2026-05-27', hour: 9, minute: 30 });
  });

  it('la fecha es la de Madrid, no la de UTC (cruce de día por el offset)', () => {
    setNow('2026-05-31T22:30:00Z'); // 2026-06-01 00:30 en Madrid
    expect(madridNowParts()).toEqual({ dateISO: '2026-06-01', hour: 0, minute: 30 });
  });
});

describe('windowDate', () => {
  it('devuelve siempre la fecha natural de hoy en Madrid (drop a medianoche)', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(windowDate()).toBe('2026-05-27');
  });

  it('de madrugada ya es el set del nuevo día (justo pasado el drop)', () => {
    setNow('2026-05-27T00:30:00Z'); // 02:30 Madrid
    expect(windowDate()).toBe('2026-05-27');
  });

  it('cruza de día con el offset de Madrid, no con el de UTC', () => {
    setNow('2026-05-31T22:30:00Z'); // 2026-06-01 00:30 Madrid
    expect(windowDate()).toBe('2026-06-01');
  });

  it('usa la hora de Madrid en invierno (CET, UTC+1)', () => {
    setNow('2026-01-15T23:30:00Z'); // 2026-01-16 00:30 Madrid
    expect(windowDate()).toBe('2026-01-16');
  });
});

describe('minutesUntilNextDrop', () => {
  it('cuenta los minutos hasta la próxima medianoche de Madrid', () => {
    setNow('2026-05-27T19:00:00Z'); // 21:00 Madrid → 3 h
    expect(minutesUntilNextDrop()).toBe(180);
  });

  it('justo antes de medianoche quedan pocos minutos', () => {
    setNow('2026-05-27T21:45:00Z'); // 23:45 Madrid
    expect(minutesUntilNextDrop()).toBe(15);
  });

  it('recién pasada la medianoche faltan casi 24 h', () => {
    setNow('2026-05-26T22:01:00Z'); // 00:01 Madrid
    expect(minutesUntilNextDrop()).toBe(1439);
  });

  it('usa la hora de Madrid en invierno (CET)', () => {
    setNow('2026-01-15T20:00:00Z'); // 21:00 Madrid → 3 h
    expect(minutesUntilNextDrop()).toBe(180);
  });
});

describe('formatTimeUntil', () => {
  it('formatea horas y minutos', () => {
    expect(formatTimeUntil(200)).toBe('3 h 20 min');
  });

  it('solo minutos cuando es menos de una hora', () => {
    expect(formatTimeUntil(45)).toBe('45 min');
  });

  it('solo horas cuando no hay minutos sueltos', () => {
    expect(formatTimeUntil(120)).toBe('2 h');
    expect(formatTimeUntil(60)).toBe('1 h');
  });
});
