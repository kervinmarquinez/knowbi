import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type PendingUser = {
  user_id: string;
  expo_push_token: string;
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

type Summary = {
  matched: number;
  sent: number;
  failed: number;
};

const EXPO_BATCH_SIZE = 100;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Madrid HH:MM con formato 24h, 2 dígitos.
function nowMadridHHMM(): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(new Date());
}

// Madrid YYYY-MM-DD.
function todayMadridISO(): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// Construye copy dinámico con la categoría más sorprendente disponible para hoy.
async function buildMessageForUser(userId: string, date: string): Promise<{ title: string; body: string } | null> {
  const { data, error } = await supabase
    .from("daily_pills")
    .select("category")
    .eq("user_id", userId)
    .eq("date", date);

  if (error) {
    console.error(`daily_pills lookup failed for ${userId}`, error);
    return null;
  }

  const rows = (data ?? []) as DailyPillRow[];
  if (rows.length === 0) return null;

  const category = pickRandom(rows.map((r) => r.category));
  const count = rows.length;
  return {
    title: "Knowbi",
    body: category
      ? `Tus ${count} del día están listas. Hay una de ${category} que te va a sorprender.`
      : `Tus ${count} del día están listas. Una te va a sorprender.`,
  };
}

async function sendBatchToExpo(messages: ExpoMessage[]): Promise<{ sent: number; failed: number }> {
  if (messages.length === 0) return { sent: 0, failed: 0 };

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
    return { sent: 0, failed: messages.length };
  }

  const data = await res.json();
  const tickets = (data?.data ?? []) as { status: "ok" | "error" }[];
  let sent = 0, failed = 0;
  for (const t of tickets) {
    if (t.status === "ok") sent++;
    else failed++;
  }
  return { sent, failed };
}

Deno.serve(async (_req) => {
  const hhmm = nowMadridHHMM();
  const date = todayMadridISO();

  const { data: users, error } = await supabase
    .from("user_preferences")
    .select("user_id, expo_push_token")
    .eq("notification_enabled", true)
    .eq("notification_time", hhmm)
    .not("expo_push_token", "is", null);

  if (error) {
    console.error("user_preferences query failed", error);
    return new Response(
      JSON.stringify({ error: "Error consultando user_preferences", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const pending = (users ?? []) as PendingUser[];
  const summary: Summary = { matched: pending.length, sent: 0, failed: 0 };

  if (pending.length === 0) {
    return new Response(JSON.stringify({ ...summary, hhmm, date }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`sender start: ${pending.length} users at ${hhmm} Madrid (${date})`);

  // Construye mensajes en paralelo.
  const messages: ExpoMessage[] = [];
  await Promise.all(
    pending.map(async (u) => {
      const msg = await buildMessageForUser(u.user_id, date);
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
    }),
  );

  // Expo limita batches a 100 mensajes.
  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const slice = messages.slice(i, i + EXPO_BATCH_SIZE);
    const { sent, failed } = await sendBatchToExpo(slice);
    summary.sent += sent;
    summary.failed += failed;
  }

  console.log("sender complete", summary);
  return new Response(JSON.stringify({ ...summary, hhmm, date }), {
    headers: { "Content-Type": "application/json" },
  });
});
