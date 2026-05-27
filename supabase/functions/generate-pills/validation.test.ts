import { titleEndsWell, titleTokens, jaccard, validateBatch } from "./validation";

describe("titleEndsWell", () => {
  it("acepta títulos que terminan en palabra de contenido", () => {
    expect(titleEndsWell("El planeta donde el día dura más que el año")).toBe(true);
    expect(titleEndsWell("La miel que nunca caduca")).toBe(true);
  });

  it("rechaza títulos que terminan en preposición, artículo o conjunción", () => {
    expect(titleEndsWell("El secreto que esconde el mar de")).toBe(false); // preposición
    expect(titleEndsWell("Lo que nadie te contó sobre la")).toBe(false); // artículo
    expect(titleEndsWell("La historia de Roma y")).toBe(false); // conjunción
  });

  it("ignora la puntuación final al evaluar la última palabra", () => {
    expect(titleEndsWell("Un dato sorprendente.")).toBe(true);
    expect(titleEndsWell("Lo que nadie sabe de.")).toBe(false); // "de" tras quitar el punto
    expect(titleEndsWell("¿Por qué el cielo es azul?")).toBe(true); // ¿ inicial no cuenta, ? final se ignora
  });
});

describe("titleTokens", () => {
  it("normaliza a minúsculas, quita tildes y filtra tokens de ≤2 caracteres", () => {
    expect([...titleTokens("El gato Café")].sort()).toEqual(["cafe", "gato"]); // "el" (2) fuera
    expect([...titleTokens("Música clásica")].sort()).toEqual(["clasica", "musica"]);
  });

  it("trata la ñ como n y conserva números", () => {
    expect([...titleTokens("Año 2024 nuevo")].sort()).toEqual(["2024", "ano", "nuevo"]);
  });

  it("deduplica tokens repetidos", () => {
    expect([...titleTokens("casa casa grande")].sort()).toEqual(["casa", "grande"]);
  });
});

describe("jaccard", () => {
  it("vale 1 para conjuntos idénticos", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });

  it("vale 0 para conjuntos disjuntos", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
  });

  it("vale 0 cuando ambos están vacíos (caso especial)", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });

  it("calcula el solape parcial", () => {
    // {gato} ∩ ; {gato,negro,blanco} ∪ → 1/3
    expect(jaccard(new Set(["gato", "negro"]), new Set(["gato", "blanco"]))).toBeCloseTo(1 / 3);
  });
});

describe("validateBatch", () => {
  it("acepta un batch con títulos buenos y distintos", () => {
    const pills = [
      { title: "El planeta donde el día dura más que el año" },
      { title: "La miel que nunca caduca en tumbas egipcias" },
    ];
    expect(validateBatch(pills)).toEqual({ ok: true });
  });

  it("rechaza si algún título termina mal", () => {
    const res = validateBatch([{ title: "Un dato que no sabías de" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/stopword/);
  });

  it("rechaza dos títulos casi idénticos dentro del batch (jaccard > 0.6)", () => {
    const pills = [
      { title: "El secreto del océano profundo azul" },
      { title: "El secreto del océano profundo verde" }, // 4/6 ≈ 0.67
    ];
    const res = validateBatch(pills);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/intra-batch/);
  });

  it("rechaza un título casi idéntico a uno del histórico (avoidList)", () => {
    const pills = [{ title: "El secreto del océano profundo azul" }];
    const avoid = [{ title: "El secreto del océano profundo rojo" }]; // 4/6 ≈ 0.67
    const res = validateBatch(pills, avoid);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/history/);
  });

  it("acepta cuando el histórico no se parece", () => {
    const pills = [{ title: "El planeta donde el día dura más que el año" }];
    const avoid = [{ title: "La miel que nunca caduca en tumbas egipcias" }];
    expect(validateBatch(pills, avoid)).toEqual({ ok: true });
  });

  it("el umbral 0.6 es exclusivo: jaccard == 0.6 exacto pasa", () => {
    // {alfa,beta,gamma,delta} vs {alfa,beta,gamma,omega} → 3/5 = 0.6, NO > 0.6 → ok
    const pills = [
      { title: "alfa beta gamma delta" },
      { title: "alfa beta gamma omega" },
    ];
    expect(validateBatch(pills)).toEqual({ ok: true });
  });
});
