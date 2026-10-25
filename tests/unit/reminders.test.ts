import { describe, expect, it } from "vitest";
import { mmss, reminderKey, reminderStage } from "@/lib/reminders";

const min = (m: number, s = 0) => (m * 60 + s) * 1000;

describe("Unitarias · avisos de inicio de scrim", () => {
  it("R1 · aviso según el tiempo restante (15, 10 y 5 min), clave por horario y cuenta regresiva", () => {
    expect(reminderStage(min(20))).toBeNull(); // aún falta
    expect(reminderStage(min(15, 1))).toBeNull();
    expect(reminderStage(min(15))).toBe(15);
    expect(reminderStage(min(11))).toBe(15);
    expect(reminderStage(min(10))).toBe(10);
    expect(reminderStage(min(6, 30))).toBe(10);
    expect(reminderStage(min(5))).toBe(5);
    expect(reminderStage(1000)).toBe(5);
    expect(reminderStage(0)).toBeNull(); // ya empezó
    expect(reminderStage(-min(3))).toBeNull();

    // Re-agendar cambia la clave: los avisos vuelven a salir para el nuevo horario
    const a = reminderKey({ id: "s1", startAt: "2026-10-26T19:00:00.000Z" }, 10);
    expect(a).not.toBe(reminderKey({ id: "s1", startAt: "2026-10-26T20:00:00.000Z" }, 10));
    expect(a).not.toBe(reminderKey({ id: "s1", startAt: "2026-10-26T19:00:00.000Z" }, 5));

    expect(mmss(min(9, 42))).toBe("09:42");
    expect(mmss(1)).toBe("00:01"); // redondea hacia arriba
    expect(mmss(-5000)).toBe("00:00");
  });
});
