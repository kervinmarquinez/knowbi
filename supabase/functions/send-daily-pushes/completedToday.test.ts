import { pendingNotCompletedToday, type StreakRow } from "./completedToday";

type Pending = { user_id: string; expo_push_token: string };

const TODAY = "2026-06-01";

function u(user_id: string): Pending {
  return { user_id, expo_push_token: `ExponentPushToken[${user_id}]` };
}

describe("pendingNotCompletedToday", () => {
  it("excluye a quien completó hoy (last_active_date == today)", () => {
    const pending = [u("a"), u("b"), u("c")];
    const streaks: StreakRow[] = [
      { user_id: "a", last_active_date: TODAY }, // completó hoy → fuera
      { user_id: "b", last_active_date: "2026-05-31" }, // ayer → se queda
    ];
    const res = pendingNotCompletedToday(pending, streaks, TODAY);
    expect(res.map((p) => p.user_id)).toEqual(["b", "c"]);
  });

  it("mantiene a quien no tiene fila de racha o tiene last_active_date null", () => {
    const pending = [u("a"), u("b")];
    const streaks: StreakRow[] = [{ user_id: "a", last_active_date: null }];
    const res = pendingNotCompletedToday(pending, streaks, TODAY);
    expect(res.map((p) => p.user_id)).toEqual(["a", "b"]);
  });

  it("sin completados devuelve todos; lista vacía devuelve vacía", () => {
    const pending = [u("a")];
    expect(pendingNotCompletedToday(pending, [], TODAY).map((p) => p.user_id)).toEqual(["a"]);
    expect(
      pendingNotCompletedToday([], [{ user_id: "a", last_active_date: TODAY }], TODAY),
    ).toEqual([]);
  });
});
