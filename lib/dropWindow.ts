// Lógica del "drop" diario: a las 00:00 (hora de Madrid) aparece el set nuevo del día,
// igual para todos. "Tus 5 de hoy" = el día natural. La hora del aviso (push) es
// independiente del drop y la elige el usuario en Ajustes (user_preferences.notification_time,
// que ahora solo gobierna el push, no cuándo se ven las píldoras).
//
// Toda la app asume Europe/Madrid (mercado español del MVP), igual que el sender.
// Mismo patrón Intl.DateTimeFormat({ timeZone }) que send-daily-pushes.

const MADRID_TZ = 'Europe/Madrid';

// Formatters Intl reutilizados: construirlos es caro (cargan datos de locale/timezone),
// así que se crean una sola vez a nivel de módulo en lugar de en cada llamada.
const MADRID_DATE_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: MADRID_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const MADRID_TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: MADRID_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// Partes del "ahora" en hora de Madrid, independientes de la zona del dispositivo.
export function madridNowParts(): { dateISO: string; hour: number; minute: number } {
  const now = new Date();
  const dateISO = MADRID_DATE_FMT.format(now); // YYYY-MM-DD en Madrid
  const hhmm = MADRID_TIME_FMT.format(now); // HH:MM 24h en Madrid
  const [hour, minute] = hhmm.split(':').map(Number);
  return { dateISO, hour, minute };
}

// Fecha (YYYY-MM-DD) del set que el usuario debe ver AHORA. Como el drop es a medianoche,
// siempre es la fecha natural de hoy en Madrid.
export function windowDate(): string {
  return madridNowParts().dateISO;
}

// Minutos desde ahora (Madrid) hasta el próximo drop (la próxima medianoche). Para la
// cuenta atrás de la pantalla Completado.
export function minutesUntilNextDrop(): number {
  const { hour, minute } = madridNowParts();
  return 24 * 60 - (hour * 60 + minute);
}

// Formatea minutos restantes como texto legible: "3 h 20 min", "45 min", "1 h".
export function formatTimeUntil(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
