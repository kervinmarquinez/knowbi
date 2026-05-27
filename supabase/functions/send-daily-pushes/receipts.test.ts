import { classifyReceipts, type ReceiptRow, type ExpoReceipt } from "./receipts";

const NOW = Date.parse("2026-05-27T12:00:00Z");
const GIVE_UP_MS = 24 * 60 * 60 * 1000;

function row(overrides: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    ticket_id: "t1",
    user_id: "u1",
    expo_push_token: "ExponentPushToken[abc]",
    created_at: "2026-05-27T11:00:00Z", // 1h antes de NOW → reciente
    ...overrides,
  };
}

describe("classifyReceipts", () => {
  it("receipt ok → solo se borra la fila", () => {
    const rows = [row({ ticket_id: "t1" })];
    const receipts: Record<string, ExpoReceipt> = { t1: { status: "ok" } };
    const res = classifyReceipts(rows, receipts, NOW, GIVE_UP_MS);
    expect(res).toEqual({ deadTokens: [], toDelete: ["t1"], otherErrors: [] });
  });

  it("DeviceNotRegistered → token muerto + borrar fila", () => {
    const rows = [row({ ticket_id: "t1", user_id: "u1", expo_push_token: "ExponentPushToken[dead]" })];
    const receipts: Record<string, ExpoReceipt> = {
      t1: { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } },
    };
    const res = classifyReceipts(rows, receipts, NOW, GIVE_UP_MS);
    expect(res.deadTokens).toEqual([{ user_id: "u1", token: "ExponentPushToken[dead]" }]);
    expect(res.toDelete).toEqual(["t1"]);
    expect(res.otherErrors).toEqual([]);
  });

  it("error distinto (p.ej. MessageTooBig) → otherErrors + borrar fila, sin tocar token", () => {
    const rows = [row({ ticket_id: "t1" })];
    const receipts: Record<string, ExpoReceipt> = {
      t1: { status: "error", message: "too big", details: { error: "MessageTooBig" } },
    };
    const res = classifyReceipts(rows, receipts, NOW, GIVE_UP_MS);
    expect(res.deadTokens).toEqual([]);
    expect(res.toDelete).toEqual(["t1"]);
    expect(res.otherErrors).toEqual([{ ticket_id: "t1", message: "too big" }]);
  });

  it("receipt ausente y reciente → no se toca (se reintenta luego)", () => {
    const rows = [row({ ticket_id: "t1", created_at: "2026-05-27T11:00:00Z" })]; // 1h
    const res = classifyReceipts(rows, {}, NOW, GIVE_UP_MS);
    expect(res).toEqual({ deadTokens: [], toDelete: [], otherErrors: [] });
  });

  it("receipt ausente y > 24h → se borra (Expo ya no lo tendrá)", () => {
    const rows = [row({ ticket_id: "t1", created_at: "2026-05-26T10:00:00Z" })]; // 26h
    const res = classifyReceipts(rows, {}, NOW, GIVE_UP_MS);
    expect(res).toEqual({ deadTokens: [], toDelete: ["t1"], otherErrors: [] });
  });

  it("clasifica un lote mixto correctamente", () => {
    const rows = [
      row({ ticket_id: "ok", user_id: "u-ok" }),
      row({ ticket_id: "dead", user_id: "u-dead", expo_push_token: "tok-dead" }),
      row({ ticket_id: "boom", user_id: "u-boom" }),
      row({ ticket_id: "pending", user_id: "u-pending", created_at: "2026-05-27T11:55:00Z" }), // 5 min, ausente
    ];
    const receipts: Record<string, ExpoReceipt> = {
      ok: { status: "ok" },
      dead: { status: "error", details: { error: "DeviceNotRegistered" } },
      boom: { status: "error", message: "rate", details: { error: "MessageRateExceeded" } },
      // "pending" no está en la respuesta
    };
    const res = classifyReceipts(rows, receipts, NOW, GIVE_UP_MS);
    expect(res.deadTokens).toEqual([{ user_id: "u-dead", token: "tok-dead" }]);
    expect(res.toDelete.sort()).toEqual(["boom", "dead", "ok"]);
    expect(res.otherErrors).toEqual([{ ticket_id: "boom", message: "rate" }]);
  });
});
