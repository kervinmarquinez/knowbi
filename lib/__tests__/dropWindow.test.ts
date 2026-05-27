import {
  madridNowParts,
  windowDate,
  dropHourFromHHMM,
  currentMadridDropHHMM,
  minutesUntilDrop,
} from '../dropWindow';

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

describe('dropHourFromHHMM', () => {
  it('extrae la hora de un HH:MM válido', () => {
    expect(dropHourFromHHMM('09:30')).toBe(9);
    expect(dropHourFromHHMM('23:00')).toBe(23);
    expect(dropHourFromHHMM('00:00')).toBe(0);
  });

  it('cae al default 9 con entradas inválidas', () => {
    expect(dropHourFromHHMM(null)).toBe(9);
    expect(dropHourFromHHMM(undefined)).toBe(9);
    expect(dropHourFromHHMM('')).toBe(9);
    expect(dropHourFromHHMM('abc')).toBe(9);
    expect(dropHourFromHHMM('25:00')).toBe(9); // fuera de rango por arriba
    expect(dropHourFromHHMM('-1:00')).toBe(9); // fuera de rango por abajo
  });
});

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
  it('a partir de la hora de drop devuelve el set de hoy', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(windowDate(9)).toBe('2026-05-27');
  });

  it('antes de la hora de drop devuelve el set de ayer', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(windowDate(10)).toBe('2026-05-26');
  });

  it('de madrugada (antes del drop) devuelve ayer cruzando medianoche', () => {
    setNow('2026-05-27T00:30:00Z'); // 02:30 Madrid
    expect(windowDate(9)).toBe('2026-05-26');
  });

  it('retrocede correctamente a través de un cambio de mes', () => {
    setNow('2026-05-31T22:30:00Z'); // 2026-06-01 00:30 Madrid
    expect(windowDate(9)).toBe('2026-05-31');
  });

  it('usa la hora de Madrid en invierno (CET, UTC+1), no la de UTC', () => {
    // 08:30Z en enero = 09:30 Madrid. Si usara la hora UTC (8) daría el set de ayer.
    setNow('2026-01-15T08:30:00Z');
    expect(windowDate(9)).toBe('2026-01-15'); // 9 >= 9 → hoy
    expect(windowDate(10)).toBe('2026-01-14'); // 9 < 10 → ayer
  });
});

describe('minutesUntilDrop', () => {
  it('cuenta los minutos hasta un drop posterior en el mismo día', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(minutesUntilDrop(11)).toBe(90);
    expect(minutesUntilDrop(10)).toBe(30);
  });

  it('si el drop ya pasó hoy, cuenta hasta el de mañana (+24h)', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(minutesUntilDrop(9)).toBe(1410); // 1440 - 30
  });

  it('envuelve correctamente cerca de medianoche', () => {
    setNow('2026-05-27T21:45:00Z'); // 23:45 Madrid
    expect(minutesUntilDrop(0)).toBe(15);
  });
});

describe('currentMadridDropHHMM', () => {
  it('hace floor a la hora en punto de Madrid', () => {
    setNow('2026-05-27T07:30:00Z'); // 09:30 Madrid
    expect(currentMadridDropHHMM()).toBe('09:00');

    setNow('2026-05-27T21:45:00Z'); // 23:45 Madrid
    expect(currentMadridDropHHMM()).toBe('23:00');

    setNow('2026-05-27T00:30:00Z'); // 02:30 Madrid
    expect(currentMadridDropHHMM()).toBe('02:00');
  });
});
