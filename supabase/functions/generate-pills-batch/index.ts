import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type UserPref = {
  user_id: string;
  categories: string[];
};

type GenerateResponse = {
  pills?: { title: string; body: string; category: string; verified: boolean }[];
  cached?: boolean;
  error?: string;
};

type Summary = {
  processed: number;
  generated: number;
  cached: number;
  errors: number;
  skipped: number;
};

const BATCH_SIZE = 50;
const DAILY_PILL_COUNT = 5;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function userHasPillsForDate(userId: string, date: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("daily_pills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function callGeneratePills(
  userId: string,
  categories: string[],
  count: number,
  date: string,
): Promise<GenerateResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-pills`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, categories, count, date }),
  });

  const json = (await res.json().catch(() => ({}))) as GenerateResponse;
  if (!res.ok) {
    throw new Error(json.error ?? `generate-pills returned ${res.status}`);
  }
  return json;
}

async function processUser(user: UserPref, date: string, summary: Summary): Promise<void> {
  try {
    if (await userHasPillsForDate(user.user_id, date)) {
      summary.skipped += 1;
      return;
    }

    const count = DAILY_PILL_COUNT;
    if (!Array.isArray(user.categories) || user.categories.length === 0) {
      summary.errors += 1;
      console.error(`user ${user.user_id} has no categories`);
      return;
    }

    const result = await callGeneratePills(user.user_id, user.categories, count, date);
    summary.processed += 1;
    if (result.cached) {
      summary.cached += 1;
    } else {
      summary.generated += 1;
    }
  } catch (e) {
    summary.errors += 1;
    console.error(`user ${user.user_id} failed`, e);
  }
}

Deno.serve(async (_req) => {
  const date = tomorrowISO();
  const summary: Summary = { processed: 0, generated: 0, cached: 0, errors: 0, skipped: 0 };

  // Activo = abrió la app en las últimas 24h.
  // No filtramos por notification_enabled aquí: el sender se encarga de eso.
  // categories es NOT NULL por schema; basta con que la fila exista.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: users, error } = await supabase
    .from("user_preferences")
    .select("user_id, categories")
    .gte("last_active_at", since);

  if (error) {
    console.error("user_preferences query failed", error);
    return new Response(
      JSON.stringify({ error: "Error consultando user_preferences", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const list = (users ?? []) as UserPref[];
  console.log(`batch start: ${list.length} active users, target date ${date}`);

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((u) => processUser(u, date, summary)));
    console.log(`batch ${i / BATCH_SIZE + 1} done; running summary`, summary);
  }

  console.log("batch complete", summary);

  return new Response(JSON.stringify(summary), {
    headers: { "Content-Type": "application/json" },
  });
});
