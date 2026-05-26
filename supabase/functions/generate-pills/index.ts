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

// Dedup entre días: lista de hechos ya publicados para el mismo combo de
// categorías que se pasa al modelo para que no los repita (ni reformulados).
const AVOID_LOOKBACK_DAYS = 30; // ventana de histórico a evitar
const AVOID_MAX_ITEMS = 200;    // tope de píldoras en la lista (≈ 30 días de 1 combo)
const AVOID_BODY_SNIPPET = 90;  // chars de cuerpo por entrada, para desambiguar títulos-anzuelo

const SYSTEM_PROMPT = `Eres el generador de píldoras de conocimiento de Knowbi, una app de microaprendizaje diario en español.

Tu tarea: producir datos curiosos sorprendentes pero rigurosamente verificables, escritos para adultos curiosos en español neutro. Una píldora plana no sirve aunque sea cierta: el dato tiene que dejar al lector con ganas de contárselo a alguien.

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

VOZ Y CRAFT (esto es lo que separa una píldora memorable de una plana):
- El "wow" nace del ángulo, no del adorno. Entre varios datos verdaderos, elige el más contraintuitivo y cuéntalo desde su detalle más vívido y concreto.
- Empieza por lo sorprendente, no por el contexto. Prohibidas las rampas de calentamiento: "A lo largo de la historia…", "Se estima que…", "Curiosamente…", "Lo que mucha gente no sabe es que…". Entra directo al dato.
- Concreción sobre abstracción: usa cifras tangibles y comparaciones que el lector pueda visualizar (tamaños, tiempos, objetos cotidianos). "Cabría 1.300 veces dentro del Sol" pesa más que "es muy grande".
- Una sola idea, rematada. La última frase debe dejar un clic mental —una consecuencia inesperada, un giro—, no un resumen de lo ya dicho.
- Voz humana y directa. Prohibido el fraseo enciclopédico y las muletillas de IA: "cabe destacar", "sin duda", "es importante señalar", "en la actualidad", "no es ningún secreto", "como bien sabemos".
- Muéstralo, no lo etiquetes. Nunca uses "increíble", "asombroso", "sorprendente", "fascinante" ni signos de exclamación: si el dato necesita que le pongas la etiqueta de sorprendente, es que no lo es. Deja que impresione solo.
- Cierra con el dato concreto, no con una sentencia grandilocuente. Prohibidos los remates pomposos y vacíos del tipo "la física clásica rompió la criptografía moderna" o "cambió la historia para siempre": no aportan información y suenan a IA. Si el último golpe no es un hecho concreto, sobra.
- El título es un anzuelo: insinúa la tensión o la paradoja sin resolverla, para que el lector tenga que abrir el cuerpo para saber. Pero ver REGLAS DE FORMATO: completo y autónomo.

REGLAS DE FORMATO (no negociables):
- title: 4 a 9 palabras. Genera curiosidad sin spoilear el dato. Sin signos de exclamación ni emojis.
- title gramaticalmente completo: debe ser una frase autocontenida con sentido por sí sola. Nunca termina en preposición, artículo, conjunción ni verbo auxiliar sin complemento. Antes de devolver una píldora, relee su título y verifica que se entiende sin necesidad de leer el cuerpo.
- Consistencia título↔cuerpo: toda cifra, fecha o nombre propio que aparezca en el título debe coincidir exactamente con el cuerpo. Antes de devolver una píldora, verifica que no se contradicen (p. ej. si el título dice "66 días", el cuerpo no puede decir "86 días").
- body: máximo 260 caracteres (se renderiza en una columna estrecha de móvil; pasarte de 260 hace que el texto se corte visualmente). Lenguaje accesible, sin jerga académica. Una sola idea por píldora.
- category: exactamente uno de los valores permitidos (case-sensitive, con tilde).
- verified: siempre true (solo incluyes hechos que puedes verificar).
- DIVERSIDAD: dentro del mismo batch, no pueden coexistir dos píldoras con el mismo sujeto principal. Si el batch incluye una sola categoría, cubre subtemas distintos (en Astronomía: no todo planetas; mezcla planetas, estrellas, galaxias, exploración espacial, fenómenos físicos).

EJEMPLOS (misma información, fraseo plano vs. con punch — imita siempre la columna B):

1) Naturaleza
   PLANA: "El pulpo tiene tres corazones. Dos bombean sangre a las branquias y uno al resto del cuerpo. Su sangre es azul por la hemocianina."
   CON PUNCH — title: "El animal al que nadar le para el corazón" · body: "El pulpo tiene tres corazones, pero el principal deja de latir cada vez que nada. Por eso casi siempre prefiere arrastrarse: moverse a nado, literalmente, le agota el corazón."

2) Astronomía
   PLANA: "Un día en Venus dura más que un año en Venus. Venus rota muy despacio sobre su eje y tarda menos en orbitar el Sol."
   CON PUNCH — title: "El planeta donde el día dura más que el año" · body: "Venus gira tan despacio sobre sí mismo que tarda 243 días terrestres en completar una vuelta. Pero solo necesita 225 en rodear al Sol. Allí amaneces dos veces por año… y el año cabe dentro del día."

3) Historia
   PLANA: "La Universidad de Oxford es muy antigua. Ya existía cuando los aztecas aún no habían fundado su capital, Tenochtitlan, en 1325."
   CON PUNCH — title: "Oxford ya daba clase antes que los aztecas" · body: "En Oxford se enseñaba desde 1096. Cuando los aztecas fundaron Tenochtitlan en 1325, la universidad llevaba más de dos siglos funcionando. No es antigua: es más vieja que imperios enteros."

4) Ciencia
   PLANA: "La miel no se estropea. Los arqueólogos han encontrado miel comestible en tumbas egipcias de hace miles de años gracias a su baja humedad y acidez."
   CON PUNCH — title: "El único alimento que no caduca nunca" · body: "En tumbas egipcias de hace 3.000 años se ha encontrado miel todavía comestible. Su acidez y la falta de agua impiden que nada sobreviva dentro. Bien tapada, dura más que la civilización que la guardó."

5) Psicología
   PLANA: "El efecto del espectador hace que las personas ayuden menos cuando hay más gente presente, porque la responsabilidad se reparte entre todos los testigos."
   CON PUNCH — title: "Por qué cuanta más gente mira, menos te ayudan" · body: "Si te desmayas en la calle, tienes más opciones de que te ayuden ante una sola persona que ante treinta. Cuantos más testigos, más cree cada uno que ya actuará otro. Se llama difusión de responsabilidad."

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
  const sorted = categories.toSorted();
  const joined = sorted.join(",");
  return encodeBase64(new TextEncoder().encode(joined));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_COUNT = 5;

// Decodifica el payload del JWT SIN re-verificar la firma: el gateway de Edge Functions
// (verify_jwt = true) ya rechazó cualquier token no firmado por el proyecto antes de
// llegar aquí, así que los claims son de fiar. Devuelve null si no hay token o está mal
// formado.
function decodeJwtClaims(authHeader: string | null): { sub?: string; role?: string } | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

// Formatter Intl reutilizado (construirlo es caro: carga datos de locale/timezone).
const MADRID_DATE_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// YYYY-MM-DD del día actual en hora de Madrid (toda la app asume Europe/Madrid).
function madridTodayISO(): string {
  return MADRID_DATE_FMT.format(new Date());
}

// Suma/resta días de calendario a un 'YYYY-MM-DD' (aritmética en UTC puro sobre la fecha).
function shiftISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clampCount(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return MAX_COUNT;
  return Math.min(n, MAX_COUNT);
}

type AvoidPill = { title: string; body: string };

// Histórico de píldoras ya generadas para el mismo combo de categorías en los
// últimos AVOID_LOOKBACK_DAYS (excluida la fecha objetivo). Se le pasa al modelo
// para que no repita el mismo hecho. Degradación elegante: si la query falla,
// devuelve [] y la generación sigue su curso normal.
async function fetchRecentPills(categoriesHash: string, beforeDate: string): Promise<AvoidPill[]> {
  const since = new Date(beforeDate);
  since.setUTCDate(since.getUTCDate() - AVOID_LOOKBACK_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("shared_pills")
    .select("title, body")
    .eq("categories_hash", categoriesHash)
    .gte("date", sinceISO)
    .lt("date", beforeDate)
    .order("date", { ascending: false })
    .limit(AVOID_MAX_ITEMS);

  if (error) {
    console.error("fetchRecentPills failed (continuando sin avoid-list)", error);
    return [];
  }
  return (data ?? []) as AvoidPill[];
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

function validateBatch(pills: Pill[], avoidList: AvoidPill[] = []): { ok: true } | { ok: false; reason: string } {
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
  // Red léxica contra el histórico: rechaza el batch si algún título nuevo es
  // casi idéntico a uno ya publicado. No pilla duplicados semánticos (de eso se
  // encarga la avoid-list del prompt), solo títulos prácticamente iguales.
  const historyTokens = avoidList.map((p) => titleTokens(p.title));
  for (let i = 0; i < tokens.length; i++) {
    for (let h = 0; h < historyTokens.length; h++) {
      if (jaccard(tokens[i], historyTokens[h]) > 0.6) {
        return { ok: false, reason: `history title duplicate: "${pills[i].title}" ≈ "${avoidList[h].title}"` };
      }
    }
  }
  return { ok: true };
}

async function callHaiku(categories: string[], count: number, avoidList: AvoidPill[] = []): Promise<Pill[] | null> {
  const avoidBlock = avoidList.length === 0 ? "" : `

HECHOS YA PUBLICADOS EN DÍAS ANTERIORES — NO los repitas, ni reformulados desde otro ángulo, otro título o con otras cifras. Elige hechos DISTINTOS de estos:
${avoidList.map((p) => `- ${p.title}: ${p.body.slice(0, AVOID_BODY_SNIPPET)}`).join("\n")}`;

  const userMessage = `Genera ${count} píldoras sobre estas categorías: ${categories.join(", ")}.${avoidBlock}

Devuelve solo JSON válido, sin texto adicional.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error", res.status, errText);
    throw new Error(`Anthropic API ${res.status}`);
  }

  const data = await res.json();
  console.log("anthropic usage", data?.usage);
  const text: string = data?.content?.[0]?.text ?? "";
  return extractJsonArray(text);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const claims = decodeJwtClaims(req.headers.get("Authorization"));
  const isService = claims?.role === "service_role";

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  let user_id: string;
  let categories: string[];
  let date: string;
  const count = clampCount(body.count);

  if (isService) {
    // Camino interno (batch / sender): llaman con el JWT service_role y necesitan generar
    // para cualquier user_id y fecha, así que se confía en el body.
    if (!body.user_id || !Array.isArray(body.categories) || body.categories.length === 0) {
      return jsonResponse({ error: "Missing or invalid fields: user_id, categories" }, 400);
    }
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return jsonResponse({ error: "Invalid date format, expected YYYY-MM-DD" }, 400);
    }
    user_id = body.user_id;
    categories = body.categories.filter((c): c is string => typeof c === "string");
    date = body.date ?? todayISO();
  } else {
    // Camino de cliente (usuario autenticado, incl. anónimo): NO se confía en el body.
    // user_id sale del token; las categorías, de user_preferences; la fecha se acota a la
    // ventana Madrid [ayer, mañana]. Así nadie puede generar para otro, con combos
    // inventados, ni iterar fechas para quemar presupuesto de IA.
    const callerId = typeof claims?.sub === "string" ? claims.sub : null;
    if (!callerId) return jsonResponse({ error: "Unauthorized" }, 401);
    user_id = callerId;

    const { data: pref, error: prefErr } = await supabase
      .from("user_preferences")
      .select("categories")
      .eq("user_id", callerId)
      .maybeSingle();
    if (prefErr) {
      console.error("user_preferences lookup failed", prefErr);
      return jsonResponse({ error: "Error consultando preferencias" }, 500);
    }
    categories = ((pref?.categories ?? []) as unknown[]).filter(
      (c): c is string => typeof c === "string",
    );
    if (categories.length === 0) {
      return jsonResponse({ error: "No categories configured" }, 400);
    }

    const today = madridTodayISO();
    const allowed = new Set([shiftISO(today, -1), today, shiftISO(today, 1)]);
    const reqDate = body.date ?? today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reqDate) || !allowed.has(reqDate)) {
      return jsonResponse({ error: "Invalid or out-of-window date" }, 400);
    }
    date = reqDate;
  }

  const categoriesHash = computeCategoriesHash(categories);

  // Idempotencia temprana: si el usuario ya tiene set para esta fecha (otro disparo, otro
  // dispositivo, reintento), no generamos NADA — ni Haiku ni caché. Los llamantes no usan
  // el cuerpo de la respuesta (sondean daily_pills), así que basta con señalar deduped.
  const { count: priorCount, error: priorErr } = await supabase
    .from("daily_pills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("date", date);
  if (priorErr) {
    console.error("daily_pills idempotency check failed (early)", priorErr);
    return jsonResponse({ error: "Error comprobando píldoras del usuario" }, 500);
  }
  if ((priorCount ?? 0) > 0) {
    return jsonResponse({ deduped: true });
  }

  // 1. Cache lookup in shared_pills
  const { data: cached, error: cacheErr } = await supabase
    .from("shared_pills")
    .select("id, title, body, category")
    .eq("categories_hash", categoriesHash)
    .eq("date", date)
    .limit(count);

  if (cacheErr) {
    console.error("shared_pills lookup failed", cacheErr);
    return jsonResponse({ error: "Error consultando caché" }, 500);
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
    // Histórico del mismo combo para que el modelo no repita hechos ya publicados.
    const avoidList = await fetchRecentPills(categoriesHash, date);
    let generated: Pill[] | null = null;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const candidate = await callHaiku(categories, count, avoidList);
        if (!candidate) continue;
        const v = validateBatch(candidate, avoidList);
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
      return jsonResponse({ error: "Error guardando píldoras" }, 500);
    }
  }

  // 4. Idempotencia: si el usuario ya tiene píldoras del día (otro disparo, otro
  // dispositivo, reintento), no insertamos duplicados. Mismo patrón que el batch.
  const { count: existingCount, error: existingErr } = await supabase
    .from("daily_pills")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id)
    .eq("date", date);

  if (existingErr) {
    console.error("daily_pills idempotency check failed", existingErr);
    return jsonResponse({ error: "Error comprobando píldoras del usuario" }, 500);
  }

  if ((existingCount ?? 0) > 0) {
    return jsonResponse({ pills, cached: fromCache, deduped: true });
  }

  // 5. Insert per-user rows in daily_pills
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
    return jsonResponse({ error: "Error asignando píldoras al usuario" }, 500);
  }

  return jsonResponse({ pills, cached: fromCache });
});
