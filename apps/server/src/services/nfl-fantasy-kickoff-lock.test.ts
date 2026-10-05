import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflPlayer: { findMany: vi.fn() },
    nflGame: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  describeFrozenChanges,
  findFrozenLineupChanges,
  hasGameStarted,
  lineupRole,
  loadPlayerKickoffs,
  type LineupSnapshot,
} from "./nfl-fantasy-kickoff-lock";

beforeEach(() => {
  vi.resetAllMocks();
});

// W5 2026 : TNF jeu. 08/10 00:15Z (le 09/10 UTC), dimanche 11/10 17:00Z.
const THU_KICKOFF = new Date("2026-10-09T00:15:00Z");
const SUN_KICKOFF = new Date("2026-10-11T17:00:00Z");
const SAT_NOON = new Date("2026-10-10T12:00:00Z");

describe("hasGameStarted", () => {
  it("coup d'envoi passe (borne incluse)", () => {
    const g = { kickoffAt: THU_KICKOFF, status: "scheduled" };
    expect(hasGameStarted(g, new Date("2026-10-09T00:14:59Z"))).toBe(false);
    expect(hasGameStarted(g, THU_KICKOFF)).toBe(true);
  });

  it("un match vu en cours ou termine est commence meme si l'horaire dit l'inverse", () => {
    expect(hasGameStarted({ kickoffAt: SUN_KICKOFF, status: "in_progress" }, SAT_NOON)).toBe(
      true,
    );
    expect(hasGameStarted({ kickoffAt: SUN_KICKOFF, status: "final" }, SAT_NOON)).toBe(true);
  });

  it("pas de match connu (bye) : jamais commence", () => {
    expect(hasGameStarted(undefined, SAT_NOON)).toBe(false);
  });
});

describe("lineupRole", () => {
  const lineup: LineupSnapshot = { starterIds: ["a", "b", "c"], captainId: "a", viceCaptainId: "b" };
  it("capitaine, vice, titulaire, hors lineup", () => {
    expect(lineupRole(lineup, "a")).toBe("captain");
    expect(lineupRole(lineup, "b")).toBe("vice");
    expect(lineupRole(lineup, "c")).toBe("starter");
    expect(lineupRole(lineup, "z")).toBe("bench");
    expect(lineupRole(null, "a")).toBe("bench");
  });
});

describe("findFrozenLineupChanges", () => {
  // thu = joueur du jeudi (match joue), sun1/sun2 = joueurs du dimanche.
  const previous: LineupSnapshot = {
    starterIds: ["thu", "sun1"],
    captainId: "sun1",
    viceCaptainId: null,
  };
  const started = new Set(["thu", "thuBench"]);

  it("changements sur les joueurs du dimanche : libres", () => {
    expect(
      findFrozenLineupChanges({
        previous,
        next: { starterIds: ["thu", "sun2"], captainId: "sun2", viceCaptainId: null },
        startedPlayerIds: started,
      }),
    ).toEqual([]);
  });

  it("joueur du jeudi deja joue : retrait interdit", () => {
    expect(
      findFrozenLineupChanges({
        previous,
        next: { starterIds: ["sun1", "sun2"], captainId: "sun1", viceCaptainId: null },
        startedPlayerIds: started,
      }),
    ).toEqual([{ playerId: "thu", from: "starter", to: "bench" }]);
  });

  it("ajout d'un joueur dont le match est joue : interdit", () => {
    expect(
      findFrozenLineupChanges({
        previous,
        next: { starterIds: ["thu", "thuBench"], captainId: "sun1", viceCaptainId: null },
        startedPlayerIds: started,
      }),
    ).toEqual([{ playerId: "thuBench", from: "bench", to: "starter" }]);
  });

  it("promotion capitaine d'un joueur deja joue : interdite (x1.5 a posteriori)", () => {
    expect(
      findFrozenLineupChanges({
        previous,
        next: { starterIds: ["thu", "sun1"], captainId: "thu", viceCaptainId: null },
        startedPlayerIds: started,
      }),
    ).toEqual([{ playerId: "thu", from: "starter", to: "captain" }]);
  });

  it("premier lineup de la week apres le TNF : un joueur du jeudi ne peut pas y entrer", () => {
    expect(
      findFrozenLineupChanges({
        previous: null,
        next: { starterIds: ["thu", "sun1"], captainId: "sun1", viceCaptainId: null },
        startedPlayerIds: started,
      }),
    ).toEqual([{ playerId: "thu", from: "bench", to: "starter" }]);
  });

  it("lineup identique resoumis : accepte", () => {
    expect(findFrozenLineupChanges({ previous, next: previous, startedPlayerIds: started })).toEqual(
      [],
    );
  });
});

describe("describeFrozenChanges", () => {
  it("liste les joueurs et leurs roles en francais", () => {
    expect(
      describeFrozenChanges(
        [{ playerId: "thu", from: "starter", to: "captain" }],
        (id) => `#${id}`,
      ),
    ).toBe("Match deja commence, role fige pour la semaine : #thu (titulaire -> capitaine)");
  });
});

describe("loadPlayerKickoffs", () => {
  it("relie chaque joueur au match de son equipe (domicile ou exterieur)", async () => {
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "thu", teamCode: "PHI" },
      { id: "sun1", teamCode: "KC" },
      { id: "bye", teamCode: "DAL" },
      { id: "fa", teamCode: null },
    ] as never);
    vi.mocked(prisma.nflGame.findMany).mockResolvedValue([
      { homeTeam: "NYG", awayTeam: "PHI", kickoffAt: THU_KICKOFF, status: "final" },
      { homeTeam: "KC", awayTeam: "LV", kickoffAt: SUN_KICKOFF, status: "scheduled" },
    ] as never);

    const out = await loadPlayerKickoffs({
      weekId: "2026:W5",
      playerIds: ["thu", "sun1", "bye", "fa"],
      now: SAT_NOON,
    });

    expect(out.get("thu")).toEqual({ kickoffAt: THU_KICKOFF, started: true });
    expect(out.get("sun1")).toEqual({ kickoffAt: SUN_KICKOFF, started: false });
    expect(out.has("bye")).toBe(false);
    expect(out.has("fa")).toBe(false);
    expect(vi.mocked(prisma.nflGame.findMany).mock.calls[0]?.[0]?.where).toEqual({
      weekId: "2026:W5",
      OR: [
        { homeTeam: { in: ["PHI", "KC", "DAL"] } },
        { awayTeam: { in: ["PHI", "KC", "DAL"] } },
      ],
    });
  });

  it("aucun joueur : aucune requete", async () => {
    const out = await loadPlayerKickoffs({ weekId: "2026:W5", playerIds: [], now: SAT_NOON });
    expect(out.size).toBe(0);
    expect(prisma.nflPlayer.findMany).not.toHaveBeenCalled();
  });
});
