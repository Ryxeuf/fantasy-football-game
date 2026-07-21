/**
 * Non-régression — GET /team/:teamId/pending-advancements doit servir
 * l'état LIVE du joueur, pas le snapshot `pendingChoices` de la séquence.
 *
 * Bug : à la validation commissaire, les évolutions stagées sur la
 * feuille de match sont appliquées APRÈS la création de la
 * LeaguePostMatchSequence (dont le snapshot fige spp/advancementsTaken).
 * Le endpoint servait le snapshot → l'UI affichait des PSP déjà
 * dépensés (« 3 PSP · 0/6 amél. ») et proposait un avancement au
 * mauvais coût, que le POST refusait ensuite (insufficient-spp).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import {
  liveAdvancementItem,
  handleListPendingAdvancements,
} from "./team-advancement";
import { prisma } from "../prisma";
import type { AuthenticatedRequest } from "../middleware/authUser";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
    leaguePostMatchSequence: { findMany: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    position: { findMany: vi.fn() },
  },
}));

describe("liveAdvancementItem", () => {
  it("recalcule spp/advancements/coût depuis l'état live", () => {
    // 2e avancement : le random-primary passe de 3 à 4 PSP.
    const r = liveAdvancementItem({
      spp: 8,
      advancements: JSON.stringify([{ type: "random-primary" }]),
      dead: false,
    });
    expect(r).toEqual({ spp: 8, advancementsTaken: 1, nextAdvancementCost: 4 });
  });

  it("filtre un joueur qui ne peut plus s'offrir le palier le moins cher", () => {
    // Cas du bug : pile-driver appliqué à la validation (3 PSP débités),
    // il reste 0 PSP mais le snapshot annonçait encore 3 PSP / 0 amél.
    const r = liveAdvancementItem({
      spp: 0,
      advancements: JSON.stringify([{ type: "random-primary" }]),
      dead: false,
    });
    expect(r).toBeNull();
  });

  it("filtre un joueur mort ou au cap de 6 avancements", () => {
    expect(
      liveAdvancementItem({ spp: 50, advancements: "[]", dead: true }),
    ).toBeNull();
    expect(
      liveAdvancementItem({
        spp: 50,
        advancements: JSON.stringify(new Array(6).fill({ type: "primary" })),
        dead: false,
      }),
    ).toBeNull();
  });

  it("tolère un JSON d'avancements illisible (0 pris)", () => {
    const r = liveAdvancementItem({ spp: 3, advancements: "oops", dead: false });
    expect(r).toEqual({ spp: 3, advancementsTaken: 0, nextAdvancementCost: 3 });
  });
});

describe("handleListPendingAdvancements", () => {
  interface MockRes {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  }
  function makeRes(): MockRes {
    const res: Partial<MockRes> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as MockRes;
  }
  function makeReq(): AuthenticatedRequest {
    return {
      user: { id: "user-1" },
      params: { teamId: "team-1" },
    } as unknown as AuthenticatedRequest;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      ownerId: "user-1",
      roster: "gnome",
      ruleset: "season_3",
    } as never);
    vi.mocked(prisma.position.findMany).mockResolvedValue([] as never);
  });

  it("sert les compteurs live, pas le snapshot périmé de la séquence", async () => {
    vi.mocked(prisma.leaguePostMatchSequence.findMany).mockResolvedValue([
      {
        id: "seq-1",
        matchId: "match-1",
        seasonId: "season-1",
        createdAt: new Date("2026-07-21T10:00:00Z"),
        // Snapshot figé AVANT l'application des évolutions stagées.
        pendingChoices: JSON.stringify([
          {
            teamPlayerId: "p1",
            playerName: "Cinglé 1",
            spp: 3,
            advancementsTaken: 0,
            nextAdvancementCost: 3,
          },
          {
            teamPlayerId: "p2",
            playerName: "Cinglé 2",
            spp: 8,
            advancementsTaken: 0,
            nextAdvancementCost: 3,
          },
        ]),
      },
    ] as never);
    vi.mocked(prisma.teamPlayer.findMany).mockResolvedValue([
      {
        // p1 a pris pile-driver à la validation : 0 PSP restants, 1 amél.
        id: "p1",
        position: "gnome_lineman",
        name: "Cinglé 1",
        ma: 5,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "pile-driver",
        spp: 0,
        advancements: JSON.stringify([{ type: "random-primary" }]),
        dead: false,
      },
      {
        // p2 a pris un avancement ailleurs : il lui reste 5 PSP, 1 amél.
        id: "p2",
        position: "gnome_lineman",
        name: "Cinglé 2",
        ma: 5,
        st: 2,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "dodge",
        spp: 5,
        advancements: JSON.stringify([{ type: "random-primary" }]),
        dead: false,
      },
    ] as never);

    const res = makeRes();
    await handleListPendingAdvancements(makeReq(), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0] as {
      data: {
        items: Array<{
          teamPlayerId: string;
          spp: number;
          advancementsTaken: number;
          nextAdvancementCost: number;
        }>;
      };
    };
    // p1 (plus assez de PSP) est filtré ; p2 remonte avec les valeurs
    // live (5 PSP, 1 amél., prochain random à 4) et non le snapshot.
    expect(payload.data.items).toHaveLength(1);
    expect(payload.data.items[0]).toMatchObject({
      teamPlayerId: "p2",
      spp: 5,
      advancementsTaken: 1,
      nextAdvancementCost: 4,
    });
  });
});
