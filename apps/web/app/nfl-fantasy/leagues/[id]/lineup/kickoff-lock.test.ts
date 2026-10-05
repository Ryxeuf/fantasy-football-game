import { describe, expect, it } from "vitest";

import { formatKickoff, isFrozen, roleChangeBlockedReason } from "./kickoff-lock";

const kickoffs = {
  thu: { kickoffAt: "2026-10-09T00:15:00.000Z", started: true },
  sun: { kickoffAt: "2026-10-11T17:00:00.000Z", started: false },
};

describe("isFrozen", () => {
  it("vrai seulement pour un joueur dont le match a commence", () => {
    expect(isFrozen(kickoffs, "thu")).toBe(true);
    expect(isFrozen(kickoffs, "sun")).toBe(false);
    expect(isFrozen(kickoffs, "bye")).toBe(false);
    expect(isFrozen(kickoffs, null)).toBe(false);
  });
});

describe("roleChangeBlockedReason", () => {
  it("bloque la promotion d'un joueur deja joue", () => {
    expect(
      roleChangeBlockedReason({ kickoffs, role: "captain", currentId: "sun", nextId: "thu" }),
    ).toMatch(/ne peut plus devenir capitaine/);
  });

  it("bloque le remplacement d'un capitaine deja joue", () => {
    expect(
      roleChangeBlockedReason({ kickoffs, role: "vice", currentId: "thu", nextId: "sun" }),
    ).toMatch(/vice-capitaine actuel a déjà joué/);
    expect(
      roleChangeBlockedReason({ kickoffs, role: "captain", currentId: "thu", nextId: null }),
    ).not.toBeNull();
  });

  it("autorise entre joueurs du dimanche, et le no-op", () => {
    expect(
      roleChangeBlockedReason({ kickoffs, role: "captain", currentId: null, nextId: "sun" }),
    ).toBeNull();
    expect(
      roleChangeBlockedReason({ kickoffs, role: "captain", currentId: "thu", nextId: "thu" }),
    ).toBeNull();
  });
});

describe("formatKickoff", () => {
  it("jour court + heure", () => {
    expect(formatKickoff("2026-10-11T17:00:00.000Z", "fr-FR", "Europe/Paris")).toBe("dim. 19:00");
  });
});
