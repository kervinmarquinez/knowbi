import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

type Pill = {
  title: string;
  body: string;
  category: string;
  verified: boolean;
};

type RequestBody = {
  user_id: string;
  categories: string[];
  count: number;
  date?: string;
};

const VALID_CATEGORIES = new Set([
  "Historia", "Ciencia", "Cine", "Arte", "Psicología", "Tecnología",
  "Naturaleza", "Deporte", "Gastronomía", "Literatura", "Astronomía",
  "Geografía", "Música", "Economía", "Medicina", "Arquitectura",
]);

const SYSTEM_PROMPT = `Eres el generador de píldoras de conocimiento de Knowbi, una app de microaprendizaje diario en español.

Tu tarea: producir datos curiosos sorprendentes pero rigurosamente verificables, escritos para adultos curiosos en español neutro.

REGLAS DE CONTENIDO (no negociables):
- Cada píldora debe ser un hecho objetivo y verificable. Nunca mitos urbanos, leyendas sin fuente, ni datos exagerados.
- El dato debe ser sorprendente: si un lector medio ya lo sabe, no sirve.
- Nada de opiniones, predicciones, ni afirmaciones controvertidas.
- Si dudas de la veracidad de un dato, no lo incluyas.

REGLA DE VERIFICACIÓN (no negociable):
- Antes de incluir un dato, aplica este filtro: ¿podría un experto del campo refutarlo con una fuente académica o institucional? Si la respuesta es "probablemente sí" o "no estoy seguro", DESCÁRTALO y genera otro.
- Sospecha especialmente de datos virales en internet: si el dato te suena de redes sociales o listas de "curiosidades", verifica con extra rigor. Muchos están desmentidos.
- Si un dato tiene atribuciones específicas (nombres propios, fechas, cifras), todas deben ser correctas. Si no estás seguro de una atribución concreta, omítela o reformula el dato sin ella.

PRECISIÓN EN CATEGORÍAS TÉCNICAS (no negociable):
- Antes de usar un término con definición técnica estricta, verifica que el dato cumple esa definición. Ejemplos: "largometraje" requiere duración mínima de 40 minutos (los cortos no cuentan aunque sean "los primeros" en su categoría); "planeta" excluye planetas enanos; "mamífero" excluye reptiles; etc.
- Si un dato cae en zona gris de una definición técnica, reformula sin el término técnico o descarta.

REGLAS DE FORMATO (no negociables):
- title: 4 a 9 palabras. Genera curiosidad sin spoilear el dato. Sin signos de exclamación ni emojis.
- title gramaticalmente completo: debe ser una frase autocontenida con sentido por sí sola. Nunca termina en preposición, artículo, conjunción ni verbo auxiliar sin complemento. Antes de devolver una píldora, relee su título y verifica que se entiende sin necesidad de leer el cuerpo.
- body: máximo 220 caracteres (se renderiza en una columna estrecha de móvil; pasarte de 220 hace que el texto se corte visualmente). Lenguaje accesible, sin jerga académica. Una sola idea por píldora.
- category: exactamente uno de los valores permitidos (case-sensitive, con tilde).
- verified: siempre true (solo incluyes hechos que puedes verificar).
- DIVERSIDAD: dentro del mismo batch, no pueden coexistir dos píldoras con el mismo sujeto principal. Si el batch incluye una sola categoría, cubre subtemas distintos (en Astronomía: no todo planetas; mezcla planetas, estrellas, galaxias, exploración espacial, fenómenos físicos).

CATEGORÍAS PERMITIDAS (case-sensitive):
Historia, Ciencia, Cine, Arte, Psicología, Tecnología, Naturaleza, Deporte, Gastronomía, Literatura, Astronomía, Geografía, Música, Economía, Medicina, Arquitectura

OUTPUT:
Devuelve EXCLUSIVAMENTE un array JSON válido. Sin texto antes ni después, sin bloques de código markdown, sin comentarios. Estructura por elemento:
{ "title": "", "body": "", "category": "", "verified": true }`;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const ANTHROPIC_API_KEY = requireEnv("ANTHROPIC_API_KEY");
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function computeCategoriesHash(categories: string[]): string {
  const sorted = [...categories].sort();
  const joined = sorted.join(",");
  return encodeBase64(new TextEncoder().encode(joined));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidPill(p: unknown): p is Pill {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.title === "string" && o.title.trim().length > 0 &&
    typeof o.body === "string" && o.body.trim().length > 0 &&
    typeof o.category === "string" && VALID_CATEGORIES.has(o.category) &&
    typeof o.verified === "boolean"
  );
}

function extractJsonArray(text: string): Pill[] | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = trimmed.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every(isValidPill)) return null;
    return parsed as Pill[];
  } catch {
    return null;
  }
}

const TITLE_TRAILING_STOPWORDS = new Set([
  "a", "ante", "bajo", "con", "contra", "de", "del", "desde", "durante", "en",
  "entre", "hacia", "hasta", "mediante", "para", "por", "según", "sin", "sobre", "tras",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "al",
  "y", "e", "o", "u", "ni", "pero", "sino", "que", "si", "aunque", "mientras",
]);

function titleEndsWell(title: string): boolean {
  const cleaned = title.trim().toLowerCase().replace(/[.,;:!?"'¿¡]+$/u, "");
  const words = cleaned.split(/\s+/);
  const last = words[words.length - 1];
  return !TITLE_TRAILING_STOPWORDS.has(last);
}

function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function validateBatch(pills: Pill[]): { ok: true } | { ok: false; reason: string } {
  for (const p of pills) {
    if (!titleEndsWell(p.title)) {
      return { ok: false, reason: `title ends with stopword: "${p.title}"` };
    }
  }
  const tokens = pills.map((p) => titleTokens(p.title));
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      if (jaccard(tokens[i], tokens[j]) > 0.6) {
        return { ok: false, reason: `intra-batch title duplicate: "${pills[i].title}" ≈ "${pills[j].title}"` };
      }
    }
  }
  return { ok: true };
}

async function callHaiku(categories: string[], count: number): Promise<Pill[] | null> {
  const userMessage = `Genera ${count} píldoras sobre estas categorías: ${categories.join(", ")}. Devuelve solo JSON válido, sin texto adicional.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error", res.status, errText);
    throw new Error(`Anthropic API ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  return extractJsonArray(text);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { user_id, categories, count, date: dateParam } = body;
  if (!user_id || !Array.isArray(categories) || categories.length === 0 || !count || count < 1) {
    return jsonResponse({ error: "Missing or invalid fields: user_id, categories, count" }, 400);
  }
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return jsonResponse({ error: "Invalid date format, expected YYYY-MM-DD" }, 400);
  }

  const categoriesHash = computeCategoriesHash(categories);
  const date = dateParam ?? todayISO();

  // 1. Cache lookup in shared_pills
  const { data: cached, error: cacheErr } = await supabase
    .from("shared_pills")
    .select("id, title, body, category")
    .eq("categories_hash", categoriesHash)
    .eq("date", date)
    .limit(count);

  if (cacheErr) {
    console.error("shared_pills lookup failed", cacheErr);
    return jsonResponse({ error: "Error consultando caché", details: cacheErr.message }, 500);
  }

  let pills: Pill[];
  let fromCache = false;

  if (cached && cached.length >= count) {
    fromCache = true;
    const slice = cached.slice(0, count);
    pills = slice.map((p) => ({
      title: p.title,
      body: p.body,
      category: p.category,
      verified: true,
    }));
  } else {
    // 2. Cache miss — call Haiku (up to 2 attempts: retry on parse OR validation failure)
    let generated: Pill[] | null = null;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const candidate = await callHaiku(categories, count);
        if (!candidate) continue;
        const v = validateBatch(candidate);
        if (v.ok) {
          generated = candidate;
          break;
        }
        console.warn(`Batch validation failed (attempt ${attempt + 1}): ${v.reason}`);
      }
    } catch (e) {
      console.error("Haiku call failed", e);
      return jsonResponse({ error: "Error generando píldoras" }, 500);
    }

    if (!generated || generated.length === 0) {
      return jsonResponse({ error: "Error generando píldoras" }, 500);
    }

    pills = generated.slice(0, count);

    // 3. Persist to shared_pills cache
    const sharedRows = pills.map((p) => ({
      categories_hash: categoriesHash,
      date,
      title: p.title,
      body: p.body,
      category: p.category,
    }));

    const { error: insErr } = await supabase.from("shared_pills").insert(sharedRows);

    if (insErr) {
      console.error("shared_pills insert failed", insErr);
      return jsonResponse({ error: "Error guardando píldoras", details: insErr.message }, 500);
    }
  }

  // 4. Insert per-user rows in daily_pills
  const dailyRows = pills.map((p) => ({
    user_id,
    title: p.title,
    body: p.body,
    category: p.category,
    date,
    is_read: false,
    is_saved: false,
  }));

  const { error: dailyErr } = await supabase.from("daily_pills").insert(dailyRows);
  if (dailyErr) {
    console.error("daily_pills insert failed", dailyErr);
    return jsonResponse({ error: "Error asignando píldoras al usuario", details: dailyErr.message }, 500);
  }

  return jsonResponse({ pills, cached: fromCache });
});
