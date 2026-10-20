/**
 * Retrait d'une équipe d'une coupe : décision PURE (qui, quand) puis chemin
 * Prisma (suppression de l'inscription, notification du coach).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupParticipant: { findUnique: vi.fn(), delete: vi.fn() },
    cupPairing: { count: vi.fn() },
  },
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotification: vi.fn(),
}));

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";
import {
  CupTeamRemovalError,
  cupTeamRemovalStatus,
  decideCupTeamRemoval,
  removeTeamFromCup,
  type CupTeamRemovalFacts,
} from "./cup-team-removal";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { findUnique: MockFn };
  cupParticipant: { findUnique: MockFn; delete: MockFn };
  cupPairing: { count: MockFn };
};
const notify = createInAppNotification as unknown as MockFn;

const BASE: CupTeamRemovalFacts = {
  isCommissioner: false,
  isAdmin: false,
  isOwner: false,
  force: false,
  cupStatus: "ouverte",
  validated: false,
  openPairings: 0,
};

function decide(overrides: Partial<CupTeamRemovalFacts>) {
  return decideCupTeamRemoval({ ...BASE, ...overrides });
}

describe("decideCupTeamRemoval — qui retire, et quand", () => {
  it.each([
    // [acteur, statut, validée, attendu]
    ["propriétaire", { isOwner: true }, "ouverte", false, "ok"],
    ["propriétaire", { isOwner: true }, "en_cours", true, "registrations_closed"],
    ["propriétaire", { isOwner: true }, "ouverte", true, "registrations_closed"],
    ["commissaire", { isCommissioner: true }, "ouverte", false, "ok"],
    ["commissaire", { isCommissioner: true }, "en_cours", true, "ok"],
    ["commissaire", { isCommissioner: true }, "terminee", true, "cup_closed"],
    ["commissaire", { isCommissioner: true }, "archivee", true, "cup_closed"],
    ["admin", { isAdmin: true }, "en_cours", true, "ok"],
    ["admin", { isAdmin: true }, "terminee", true, "cup_closed"],
    ["admin + force", { isAdmin: true, force: true }, "archivee", true, "ok"],
    ["commissaire + force", { isCommissioner: true, force: true }, "terminee", true, "cup_closed"],
    ["tiers", {}, "ouverte", false, "forbidden"],
  ] as const)(
    "%s sur une coupe %s (validée=%s) ⇒ %s",
    (_label, actor, cupStatus, validated, expected) => {
      const decision = decide({ ...actor, cupStatus, validated });
      expect(decision.ok ? "ok" : decision.code).toBe(expected);
    },
  );

  it("une rencontre ouverte bloque TOUT le monde, admin forcé compris", () => {
    for (const actor of [
      { isOwner: true },
      { isCommissioner: true },
      { isAdmin: true, force: true },
    ]) {
      const decision = decide({ ...actor, openPairings: 1 });
      expect(decision.ok).toBe(false);
      if (!decision.ok) {
        expect(decision.code).toBe("team_has_open_pairing");
        expect(decision.message).toMatch(/forfait/);
        expect(decision.message).toMatch(/annulation/);
      }
    }
  });

  it("un propriétaire qui est le commissaire a les droits du commissaire", () => {
    const decision = decide({
      isOwner: true,
      isCommissioner: true,
      cupStatus: "en_cours",
      validated: true,
    });
    expect(decision).toEqual({ ok: true, byCommissioner: true });
  });

  it("signale le retrait fait par le coach lui-même", () => {
    expect(decide({ isOwner: true })).toEqual({ ok: true, byCommissioner: false });
  });

  it("mappe chaque refus sur son statut HTTP", () => {
    expect(cupTeamRemovalStatus("cup_not_found")).toBe(404);
    expect(cupTeamRemovalStatus("forbidden")).toBe(403);
    expect(cupTeamRemovalStatus("cup_closed")).toBe(409);
    expect(cupTeamRemovalStatus("team_has_open_pairing")).toBe(409);
    expect(cupTeamRemovalStatus("registrations_closed")).toBe(400);
    expect(cupTeamRemovalStatus("not_registered")).toBe(400);
  });
});

describe("removeTeamFromCup", () => {
  const COMMISH = "commish";
  const COACH = "coach-1";

  beforeEach(() => {
    vi.resetAllMocks();
    db.cup.findUnique.mockResolvedValue({
      id: "cup-1",
      name: "Coupe du Chaos",
      creatorId: COMMISH,
      status: "en_cours",
      validated: true,
    });
    db.cupParticipant.findUnique.mockResolvedValue({
      id: "part-1",
      team: { name: "Les Rats", ownerId: COACH },
    });
    db.cupPairing.count.mockResolvedValue(0);
    db.cupParticipant.delete.mockResolvedValue({ id: "part-1" });
    notify.mockResolvedValue({ id: "notif-1" });
  });

  it("le commissaire retire l'équipe d'un coach en cours de coupe et le prévient", async () => {
    const out = await removeTeamFromCup({
      cupId: "cup-1",
      teamId: "team-1",
      actor: { userId: COMMISH, isAdmin: false },
    });

    expect(out).toEqual({ removed: true, teamId: "team-1", byCommissioner: true });
    expect(db.cupParticipant.delete).toHaveBeenCalledWith({ where: { id: "part-1" } });
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.userId).toBe(COACH);
    expect(payload.kind).toBe("cup.team_removed");
    expect(payload.url).toBe("/cups/cup-1");
    expect(payload.body).toContain("Les Rats");
    expect(payload.body).toContain("Coupe du Chaos");
  });

  it("compte les rencontres OUVERTES de l'équipe, à domicile comme à l'extérieur", async () => {
    await removeTeamFromCup({
      cupId: "cup-1",
      teamId: "team-1",
      actor: { userId: COMMISH, isAdmin: false },
    });
    const where = db.cupPairing.count.mock.calls[0][0].where;
    expect(where.round).toEqual({ cupId: "cup-1" });
    expect(where.status.in).toEqual(["scheduled", "in_progress"]);
    expect(where.OR).toEqual([{ homeTeamId: "team-1" }, { awayTeamId: "team-1" }]);
  });

  it("refuse tant qu'une rencontre est ouverte, sans rien supprimer", async () => {
    db.cupPairing.count.mockResolvedValue(1);

    await expect(
      removeTeamFromCup({
        cupId: "cup-1",
        teamId: "team-1",
        actor: { userId: COMMISH, isAdmin: false },
      }),
    ).rejects.toMatchObject({ code: "team_has_open_pairing" });
    expect(db.cupParticipant.delete).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("ne notifie pas le coach qui retire sa propre équipe", async () => {
    db.cup.findUnique.mockResolvedValue({
      id: "cup-1",
      name: "Coupe",
      creatorId: COMMISH,
      status: "ouverte",
      validated: false,
    });

    const out = await removeTeamFromCup({
      cupId: "cup-1",
      teamId: "team-1",
      actor: { userId: COACH, isAdmin: false },
    });

    expect(out.byCommissioner).toBe(false);
    expect(db.cupParticipant.delete).toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuse un tiers (403)", async () => {
    const err = await removeTeamFromCup({
      cupId: "cup-1",
      teamId: "team-1",
      actor: { userId: "intrus", isAdmin: false },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CupTeamRemovalError);
    expect((err as CupTeamRemovalError).code).toBe("forbidden");
    expect(db.cupParticipant.delete).not.toHaveBeenCalled();
  });

  it("refuse une équipe non inscrite", async () => {
    db.cupParticipant.findUnique.mockResolvedValue(null);
    await expect(
      removeTeamFromCup({
        cupId: "cup-1",
        teamId: "ghost",
        actor: { userId: COMMISH, isAdmin: false },
      }),
    ).rejects.toMatchObject({ code: "not_registered" });
  });

  it("refuse une coupe inconnue", async () => {
    db.cup.findUnique.mockResolvedValue(null);
    await expect(
      removeTeamFromCup({
        cupId: "nope",
        teamId: "team-1",
        actor: { userId: COMMISH, isAdmin: false },
      }),
    ).rejects.toMatchObject({ code: "cup_not_found" });
  });
});
