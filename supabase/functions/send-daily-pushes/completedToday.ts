// Filtro puro del sender: descarta a los usuarios que ya completaron el set de hoy
// (leyeron sus 5), para no enviarles el recordatorio. La señal viene de user_streaks:
// bump_streak deja last_active_date = fecha del set al llegar a Completado, y con el
// drop a medianoche esa fecha es el día natural de Madrid (== `today` del sender).

export type StreakRow = { user_id: string; last_active_date: string | null };

// Devuelve los candidatos a los que SÍ toca enviar el push: los de `pending` que aún no
// han completado el set de `today`. `streakRows` son las filas de user_streaks de esos
// mismos usuarios (last_active_date === today ⟺ completó hoy).
export function pendingNotCompletedToday<T extends { user_id: string }>(
  pending: T[],
  streakRows: StreakRow[],
  today: string,
): T[] {
  const completed = new Set(
    streakRows.filter((r) => r.last_active_date === today).map((r) => r.user_id),
  );
  return pending.filter((u) => !completed.has(u.user_id));
}
