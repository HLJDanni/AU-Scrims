import { describe, expect, it } from "vitest";
import { createScrimSchema, registerSchema } from "@/lib/validators";

const inDays = (d: number, h = 19) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x;
};

describe("Unitarias · validación de entrada", () => {
  it("U4 · createScrimSchema acepta un scrim válido y rechaza pasado, duración, juegos y links inseguros", () => {
    const base = { opponentTeamId: "team_1", startAt: inDays(2), endAt: inDays(2, 21), games: 3 };

    const ok = createScrimSchema.safeParse({ ...base, roomLink: "https://discord.gg/abc" });
    expect(ok.success).toBe(true);
    // Un link vacío se normaliza a "sin link"
    const empty = createScrimSchema.parse({ ...base, roomLink: "" });
    expect(empty.roomLink).toBeUndefined();

    const cases: [string, object][] = [
      ["pasado", { startAt: inDays(-1), endAt: inDays(-1, 21) }],
      ["menos de 30 min", { endAt: new Date(inDays(2).getTime() + 15 * 60000) }],
      ["más de 12 h", { endAt: inDays(3, 19) }],
      ["0 juegos", { games: 0 }],
      ["11 juegos", { games: 11 }],
      ["link javascript:", { roomLink: "javascript:alert(1)" }],
      ["link sin protocolo", { roomLink: "discord.gg/abc" }],
    ];
    for (const [label, patch] of cases) {
      expect(createScrimSchema.safeParse({ ...base, ...patch }).success, label).toBe(false);
    }
  });

  it("U5 · registerSchema exige contraseña segura, rol válido y datos según el modo", () => {
    const base = { username: "coach_test", email: "Coach@Test.com", password: "Segura123", role: "COACH" };

    const created = registerSchema.parse({ ...base, mode: "create", team: { name: "Equipo Test", tag: "tst" } });
    expect(created.email).toBe("coach@test.com"); // normaliza correo
    expect(created.team?.tag).toBe("TST"); // tag en mayúsculas
    expect(created.team?.region).toBe("LAN"); // valor por defecto

    expect(registerSchema.safeParse({ ...base, mode: "join", inviteCode: "ABCD2345" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "corta1", mode: "join", inviteCode: "ABCD2345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "sololetras", mode: "join", inviteCode: "ABCD2345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "PLAYER", mode: "join", inviteCode: "ABCD2345" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, mode: "create" }).success).toBe(false); // falta el equipo
    expect(registerSchema.safeParse({ ...base, mode: "join" }).success).toBe(false); // falta el código
    // Leyenda: puede entrar sin equipo, pero no crear uno; el staff no puede quedar sin equipo
    expect(registerSchema.safeParse({ ...base, role: "LEGEND", mode: "none" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, role: "LEGEND", mode: "create", team: { name: "Equipo Test", tag: "tst" } }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, mode: "none" }).success).toBe(false);
  });
});
