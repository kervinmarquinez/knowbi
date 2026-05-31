import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { classifyReceipts, type ExpoReceipt, type ReceiptRow } from "./receipts.ts";
import { pendingNotCompletedToday, type StreakRow } from "./completedToday.ts";

type PendingUser = {
  user_id: string;
  expo_push_token: string;
  categories: string[];
};

type DailyPillRow = {
  category: string;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId?: string;
  data?: Record<string, unknown>;
};

// Ticket que Expo devuelve por cada mensaje aceptado en su cola (≠ entregado).
type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } };

type Summary = {
  matched: number;
  skipped: number;
  sent: number;
  failed: number;
};

const EXPO_BATCH_SIZE = 100;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const DAILY_PILL_COUNT = 5;

// 2ª pasada de receipts: Expo no los tiene al instante; esperamos 15 min antes de
// consultarlos y los retiene ~24h (pasado eso, nos rendimos con esa fila).
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_GIVEUP_MS = 24 * 60 * 60 * 1000;
const RECEIPT_FETCH_LIMIT = 1000; // tope de IDs por llamada a getReceipts

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
// JWT service_role legacy para llamar a generate-pills (el gateway verify_jwt no acepta
// las claves nuevas sb_secret_ que lleva SUPABASE_SERVICE_ROLE_KEY).
const SERVICE_ROLE_JWT = requireEnv("SERVICE_ROLE_JWT");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Formatters Intl reutilizados (construirlos es caro: cargan datos de locale/timezone).
const MADRID_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const MADRID_DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Madrid HH:MM con formato 24h, 2 dígitos.
function nowMadridHHMM(): string {
  return MADRID_TIME_FMT.format(new Date());
}

// Madrid YYYY-MM-DD.
function todayMadridISO(): string {
  return MADRID_DATE_FMT.format(new Date());
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchPillCategories(userId: string, date: string): Promise<DailyPillRow[] | null> {
  const { data, error } = await supabase
    .from("daily_pills")
    .select("category")
    .eq("user_id", userId)
    .eq("date", date);

  if (error) {
    console.error(`daily_pills lookup failed for ${userId}`, error);
    return null;
  }
  return (data ?? []) as DailyPillRow[];
}

// Red de seguridad: si el batch nocturno no generó las píldoras del usuario, las generamos
// aquí just-in-time para no saltarnos el push en silencio. Best-effort: si falla, el push
// simplemente no sale (igual que antes). generate-pills es idempotente y cachea en shared_pills.
async function generatePillsForUser(userId: string, categories: string[], date: string): Promise<void> {
  if (!Array.isArray(categories) || categories.length === 0) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-pills`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_JWT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, categories, count: DAILY_PILL_COUNT, date }),
    });
    if (!res.ok) {
      console.error(`safety-net generate-pills failed for ${userId}`, res.status, await res.text());
    }
  } catch (e) {
    console.error(`safety-net generate-pills threw for ${userId}`, e);
  }
}

// Construye copy dinámico con la categoría más sorprendente disponible para hoy.
async function buildMessageForUser(userId: string, categories: string[], date: string): Promise<{ title: string; body: string } | null> {
  let rows = await fetchPillCategories(userId, date);
  if (rows === null) return null;

  if (rows.length === 0) {
    await generatePillsForUser(userId, categories, date);
    rows = await fetchPillCategories(userId, date);
    if (rows === null || rows.length === 0) return null;
  }

  const category = pickRandom(rows.map((r) => r.category));
  const count = rows.length;
  return {
    title: "Knowbi",
    body: category
      ? `Tus ${count} del día están listas. Hoy una es de ${category}.`
      : `Tus ${count} del día están listas. Una te va a sorprender.`,
  };
}

// Devuelve los tickets de Expo en el MISMO orden que los mensajes (garantía de Expo),
// o null si la llamada HTTP falló (en ese caso el slice entero cuenta como fallido).
async function sendBatchToExpo(messages: ExpoMessage[]): Promise<ExpoTicket[] | null> {
  if (messages.length === 0) return [];

  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error("Expo push API error", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return (data?.data ?? []) as ExpoTicket[];
}

// 2ª pasada: lee los receipts de los push ya aceptados (>15 min) y limpia tokens
// muertos (DeviceNotRegistered → expo_push_token = NULL, la app re-registra al abrir).
// Best-effort: cualquier fallo se loguea y NO rompe el envío. Idempotente, así que
// solapes entre invocaciones del cron de cada minuto son inocuos.
async function processReceipts(): Promise<{ checked: number; cleared: number }> {
  const cutoff = new Date(Date.now() - RECEIPT_DELAY_MS).toISOString();
  const { data: rows, error } = await supabase
    .from("push_receipts")
    .select("ticket_id, user_id, expo_push_token, created_at")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(RECEIPT_FETCH_LIMIT);

  if (error) {
    console.error("push_receipts query failed", error);
    return { checked: 0, cleared: 0 };
  }
  if (!rows || rows.length === 0) return { checked: 0, cleared: 0 };

  let receipts: Record<string, ExpoReceipt> = {};
  try {
    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: rows.map((r) => r.ticket_id) }),
    });
    if (!res.ok) {
      console.error("Expo getReceipts API error", res.status, await res.text());
      return { checked: 0, cleared: 0 };
    }
    const data = await res.json();
    receipts = (data?.data ?? {}) as Record<string, ExpoReceipt>;
  } catch (e) {
    console.error("Expo getReceipts threw", e);
    return { checked: 0, cleared: 0 };
  }

  const { deadTokens, toDelete, otherErrors } = classifyReceipts(
    rows as ReceiptRow[],
    receipts,
    Date.now(),
    RECEIPT_GIVEUP_MS,
  );

  for (const e of otherErrors) {
    console.error("push receipt error", e.ticket_id, e.message);
  }

  // Anular tokens muertos. Condicional al token: si el usuario re-registró otro en la
  // ventana de 15 min, no lo pisamos.
  for (const d of deadTokens) {
    const { error: updErr } = await supabase
      .from("user_preferences")
      .update({ expo_push_token: null })
      .eq("user_id", d.user_id)
      .eq("expo_push_token", d.token);
    if (updErr) console.error("failed to null dead token", d.user_id, updErr);
  }

  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from("push_receipts").delete().in("ticket_id", toDelete);
    if (delErr) console.error("failed to delete processed receipts", delErr);
  }

  return { checked: rows.length, cleared: deadTokens.length };
}

Deno.serve(async (_req) => {
  // 2ª pasada de receipts: corre cada minuto, independiente del envío de hoy.
  const receipts = await processReceipts();

  const hhmm = nowMadridHHMM();
  const date = todayMadridISO();

  const { data: users, error } = await supabase
    .from("user_preferences")
    .select("user_id, expo_push_token, categories")
    .eq("notification_enabled", true)
    .eq("notification_time", hhmm)
    .not("expo_push_token", "is", null)
    // Dedup diario: excluir a quien ya recibió su push hoy (p.ej. cambió su hora a una
    // posterior el mismo día). Un push al día por usuario.
    .or(`last_push_date.is.null,last_push_date.neq.${date}`);

  if (error) {
    console.error("user_preferences query failed", error);
    return new Response(
      JSON.stringify({ error: "Error consultando user_preferences" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const candidates = (users ?? []) as PendingUser[];

  if (candidates.length === 0) {
    const summary: Summary = { matched: 0, skipped: 0, sent: 0, failed: 0 };
    return new Response(JSON.stringify({ ...summary, receipts, hhmm, date }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // No molestar a quien ya completó el set de hoy: al llegar a Completado (las 5 leídas)
  // bump_streak deja user_streaks.last_active_date = hoy. El sender usa service-role, así
  // que RLS no bloquea leer estas filas. Si la consulta falla, no filtramos a nadie
  // (mejor enviar de más que silenciar por error).
  const { data: streakRows, error: streakErr } = await supabase
    .from("user_streaks")
    .select("user_id, last_active_date")
    .in("user_id", candidates.map((u) => u.user_id));
  if (streakErr) console.error("user_streaks lookup failed", streakErr);

  const pending = pendingNotCompletedToday(candidates, (streakRows ?? []) as StreakRow[], date);
  const summary: Summary = {
    matched: candidates.length,
    skipped: candidates.length - pending.length,
    sent: 0,
    failed: 0,
  };

  if (pending.length === 0) {
    return new Response(JSON.stringify({ ...summary, receipts, hhmm, date }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(
    `sender start: ${pending.length} users at ${hhmm} Madrid (${date}) (${summary.skipped} ya completaron)`,
  );

  // Construye mensajes en paralelo.
  const messages: ExpoMessage[] = [];
  const sentUserIds: string[] = [];
  await Promise.all(
    pending.map(async (u) => {
      const msg = await buildMessageForUser(u.user_id, u.categories, date);
      if (!msg) {
        summary.failed += 1;
        return;
      }
      messages.push({
        to: u.expo_push_token,
        title: msg.title,
        body: msg.body,
        sound: "default",
        channelId: "daily-pills",
        data: { type: "daily-pills", date },
      });
      sentUserIds.push(u.user_id);
    }),
  );

  // Expo limita batches a 100 mensajes. Guardamos los ticket IDs aceptados para leer
  // sus receipts ~15 min después (processReceipts).
  const receiptInserts: { ticket_id: string; user_id: string; expo_push_token: string }[] = [];
  const immediateDead: { user_id: string; token: string }[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const slice = messages.slice(i, i + EXPO_BATCH_SIZE);
    const tickets = await sendBatchToExpo(slice);
    if (tickets === null) {
      summary.failed += slice.length;
      continue;
    }
    // Expo devuelve los tickets en el mismo orden que los mensajes del slice.
    for (let j = 0; j < tickets.length; j++) {
      const t = tickets[j];
      const user_id = sentUserIds[i + j];
      const token = slice[j].to;
      if (t.status === "ok") {
        summary.sent += 1;
        receiptInserts.push({ ticket_id: t.id, user_id, expo_push_token: token });
      } else {
        summary.failed += 1;
        // A veces Expo ya marca el token como muerto en el propio ticket.
        if (t.details?.error === "DeviceNotRegistered") immediateDead.push({ user_id, token });
        else console.error("Expo ticket error", t.message, t.details);
      }
    }
  }

  // Guardar los ticket IDs para la 2ª pasada (best-effort; created_at lo pone el DEFAULT).
  if (receiptInserts.length > 0) {
    const { error: insErr } = await supabase.from("push_receipts").insert(receiptInserts);
    if (insErr) console.error("push_receipts insert failed", insErr);
  }

  // Tokens muertos detectados ya en el ticket (sin esperar al receipt).
  for (const d of immediateDead) {
    const { error: updErr } = await supabase
      .from("user_preferences")
      .update({ expo_push_token: null })
      .eq("user_id", d.user_id)
      .eq("expo_push_token", d.token);
    if (updErr) console.error("failed to null dead token (immediate)", d.user_id, updErr);
  }

  // Marca el día de envío SOLO para usuarios cuyo ticket aceptó Expo. Si Expo devolvió
  // error (HTTP fail o ticket rechazado), no marcamos: así el cron de mañana reintenta
  // en vez de enmascarar el fallo y bloquear al usuario en silencio.
  const deliveredUserIds = receiptInserts.map((r) => r.user_id);
  if (deliveredUserIds.length > 0) {
    const { error: markErr } = await supabase
      .from("user_preferences")
      .update({ last_push_date: date })
      .in("user_id", deliveredUserIds);
    if (markErr) console.error("failed to mark last_push_date", markErr);
  }

  console.log("sender complete", summary, "receipts", receipts);
  return new Response(JSON.stringify({ ...summary, receipts, hhmm, date }), {
    headers: { "Content-Type": "application/json" },
  });
});
