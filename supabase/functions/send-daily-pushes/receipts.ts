// Clasificación pura de los receipts de Expo: decide qué tokens están muertos
// (DeviceNotRegistered), qué filas de push_receipts borrar y qué errores loguear.
// Extraído de index.ts para testearlo con Jest sin levantar Supabase ni Deno.
// Sin red, sin BD, determinista.

// Fila pendiente leída de push_receipts.
export type ReceiptRow = {
  ticket_id: string;
  user_id: string;
  expo_push_token: string;
  created_at: string; // ISO
};

// Receipt tal cual lo devuelve POST /push/getReceipts en data[ticketId].
export type ExpoReceipt =
  | { status: "ok" }
  | { status: "error"; message?: string; details?: { error?: string } };

export type ClassifyResult = {
  deadTokens: { user_id: string; token: string }[]; // anular condicionalmente
  toDelete: string[]; // ticket_ids ya resueltos (o caducados)
  otherErrors: { ticket_id: string; message?: string }[]; // solo para loguear
};

// `receipts` es el mapa { ticketId: ExpoReceipt } de la respuesta de Expo. Un ticket
// puede no estar en el mapa si Expo aún no tiene el receipt (entonces se reintenta en
// la siguiente pasada, salvo que la fila sea más vieja que giveUpMs).
export function classifyReceipts(
  rows: ReceiptRow[],
  receipts: Record<string, ExpoReceipt>,
  nowMs: number,
  giveUpMs: number,
): ClassifyResult {
  const deadTokens: { user_id: string; token: string }[] = [];
  const toDelete: string[] = [];
  const otherErrors: { ticket_id: string; message?: string }[] = [];

  for (const r of rows) {
    const rec = receipts[r.ticket_id];

    if (!rec) {
      // Expo aún no tiene el receipt. Reintentar luego, salvo que ya sea muy viejo
      // (Expo retiene los receipts ~24h; pasado eso no llegará nunca).
      if (nowMs - new Date(r.created_at).getTime() > giveUpMs) toDelete.push(r.ticket_id);
      continue;
    }

    // Tenemos veredicto → la fila se borra pase lo que pase.
    toDelete.push(r.ticket_id);

    if (rec.status === "error") {
      if (rec.details?.error === "DeviceNotRegistered") {
        deadTokens.push({ user_id: r.user_id, token: r.expo_push_token });
      } else {
        otherErrors.push({ ticket_id: r.ticket_id, message: rec.message });
      }
    }
  }

  return { deadTokens, toDelete, otherErrors };
}
