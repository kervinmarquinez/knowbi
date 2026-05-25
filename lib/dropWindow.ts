// Lógica de la "hora de drop" personal: a partir de esa hora (Madrid) el usuario ve su
// set nuevo del día y, si tiene notificaciones activas, salta el aviso. La hora se guarda
// reutilizando user_preferences.notification_time (formato 'HH:MM').
//
// Toda la app asume Europe/Madrid (mercado español del MVP), igual que el sender.
// Mismo patrón Intl.DateTimeFormat({ timeZone }) que send-daily-pushes.

const MADRID_TZ = 'Europe/Madrid';

// Partes del "ahora" en hora de Madrid, independientes de la zona del dispositivo.
export function madridNowParts(): { dateISO: string; hour: number; minute: number } {
  const now = new Date();
  // YYYY-MM-DD en Madrid.
  const dateISO = new Intl.DateTimeFormat('sv-SE', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // HH:MM 24h en Madrid.
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: MADRID_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const [hour, minute] = hhmm.split(':').map(Number);
  return { dateISO, hour, minute };
}

// Resta un día de calendario a un 'YYYY-MM-DD' (aritmética en UTC puro sobre la fecha).
function previousDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Fecha (YYYY-MM-DD) del set que el usuario debe ver AHORA:
//   antes de su hora de drop → el set de ayer (sigue teniendo contenido)
//   a partir de su hora de drop → el set de hoy (el nuevo)
export function windowDate(dropHour: number): string {
  const { dateISO, hour } = madridNowParts();
  return hour >= dropHour ? dateISO : previousDate(dateISO);
}

// 'HH:MM' → hora entera (0-23). Devuelve 9 si el formato es inválido.
export function dropHourFromHHMM(hhmm: string | null | undefined): number {
  if (!hhmm) return 9;
  const h = Number(hhmm.split(':')[0]);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 9;
}

// Hora de Madrid actual, floor a la hora en punto, como 'HH:00'. Se usa al terminar el
// onboarding para fijar la hora de drop (≈ created_at) sin que el usuario tenga que elegir.
export function currentMadridDropHHMM(): string {
  const { hour } = madridNowParts();
  return `${String(hour).padStart(2, '0')}:00`;
}

// Minutos desde ahora (Madrid) hasta el próximo drop. Para la cuenta atrás / pantalla de espera.
export function minutesUntilDrop(dropHour: number): number {
  const { hour, minute } = madridNowParts();
  const nowMin = hour * 60 + minute;
  const dropMin = dropHour * 60;
  const diff = dropMin - nowMin;
  return diff > 0 ? diff : diff + 24 * 60;
}
