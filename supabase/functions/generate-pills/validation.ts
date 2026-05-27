// Validación pura de batches de píldoras: control de calidad estructural de los
// títulos (terminación gramatical + dedup léxico intra-batch y contra histórico).
// Extraído de index.ts para poder testearlo sin los efectos de carga de Deno
// (requireEnv / Deno.serve). Lógica idéntica; no depende de red, BD ni env.

// La validación solo mira el título; acepta cualquier objeto que lo tenga (Pill, AvoidPill…).
type Titled = { title: string };

const TITLE_TRAILING_STOPWORDS = new Set([
  "a", "ante", "bajo", "con", "contra", "de", "del", "desde", "durante", "en",
  "entre", "hacia", "hasta", "mediante", "para", "por", "según", "sin", "sobre", "tras",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "al",
  "y", "e", "o", "u", "ni", "pero", "sino", "que", "si", "aunque", "mientras",
]);

export function titleEndsWell(title: string): boolean {
  const cleaned = title.trim().toLowerCase().replace(/[.,;:!?"'¿¡]+$/u, "");
  const words = cleaned.split(/\s+/);
  const last = words[words.length - 1];
  return !TITLE_TRAILING_STOPWORDS.has(last);
}

export function titleTokens(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      // Strip de tildes/diacríticos (rango combining marks U+0300–U+036F).
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateBatch(pills: Titled[], avoidList: Titled[] = []): { ok: true } | { ok: false; reason: string } {
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
