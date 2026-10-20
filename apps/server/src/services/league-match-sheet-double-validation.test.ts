/**
 * Double validation des feuilles de coupe : sous l'option, le commissaire ne
 * valide qu'une feuille soumise par les DEUX coachs (hors coach
 * forfaitaire). La garde passe AVANT toute lecture des évènements : on
 * vérifie qu'elle refuse, ou qu'elle laisse passer jusqu'à la lecture des
 * évènements (sentinelle), sans rejouer la validation complète — couverte
 * par ses propres suites.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueMatchSheet: { findUnique: vi.fn() },
    leagueMatchEvent: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("./competition-match-sheet-context", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./competition-match-sheet-context")>();
  return { ...original, resolveCompetitionPairing: vi.fn() };
});

import { prisma } from "../prisma";
import {
  CUP_SHEET_RULES,
  LEAGUE_SHEET_RULES,
  resolveCompetitionPairing,
  type CompetitionPairingContext,
} from "./competition-match-sheet-context";
import { MatchSheetError, validateByCommissioner } from "./league-match-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockResolve = resolveCompetitionPairing as ReturnType<typeof vi.fn>;

const COMMISH = "commish";
const PAST_GUARD = new Error("past-guard");
const AT = new Date("2026-10-20T10:00:00.000Z");

function context(
  rules: CompetitionPairingContext["rules"],
  kind: "cup" | "league" = "cup",
): CompetitionPairingContext {
  return {
    kind,
    pairingId: "cp-1",
    competitionId: "C1",
    competitionName: "Coupe du Chaos",
    creatorId: COMMISH,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    homeOwnerId: "u-home",
    awayOwnerId: "u-away",
    rules,
    fixture: {
      roundNumber: 1,
      roundName: null,
      bracketSlot: null,
      seasonName: null,
      scheduledAt: null,
    },
  };
}

const DOUBLE = { ...CUP_SHEET_RULES, doubleValidation: true };

function sheet(over: Record<string, unknown> = {}) {
  return {
    id: "sheet-1",
    status: "draft",
    submittedByHomeAt: null,
    submittedByAwayAt: null,
    forfeitSide: null,
    ...over,
  };
}

async function validate() {
  return validateByCommissioner({ pairingId: "cp-1", userId: COMMISH });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockResolve.mockResolvedValue(context(DOUBLE));
  mockPrisma.team.findMany.mockResolvedValue([
    { id: "t-home", name: "Orcs" },
    { id: "t-away", name: "Rats" },
  ]);
  // Au-delà de la garde, la validation lit les évènements : on s'arrête là.
  mockPrisma.leagueMatchEvent.findMany.mockRejectedValue(PAST_GUARD);
});

describe("validateByCommissioner — double validation", () => {
  it("refuse tant qu'un coach n'a pas soumis, en nommant son équipe", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(
      sheet({ status: "submitted_home", submittedByHomeAt: AT }),
    );

    const err = await validate().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(MatchSheetError);
    expect((err as MatchSheetError).code).toBe("coach_submissions_missing");
    expect((err as MatchSheetError).message).toContain("« Rats »");
    expect((err as MatchSheetError).message).not.toContain("« Orcs »");
    expect(mockPrisma.leagueMatchEvent.findMany).not.toHaveBeenCalled();
  });

  it("refuse une feuille qu'aucun coach n'a soumise", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(sheet());
    await expect(validate()).rejects.toMatchObject({
      code: "coach_submissions_missing",
    });
  });

  it("laisse passer une feuille soumise par les deux coachs", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(
      sheet({
        status: "both_submitted",
        submittedByHomeAt: AT,
        submittedByAwayAt: AT,
      }),
    );
    await expect(validate()).rejects.toBe(PAST_GUARD);
  });

  it("n'attend pas le coach forfaitaire", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(
      sheet({
        status: "submitted_home",
        submittedByHomeAt: AT,
        forfeitSide: "away",
      }),
    );
    await expect(validate()).rejects.toBe(PAST_GUARD);
  });

  it("option décochée : le commissaire valide sans attendre (historique)", async () => {
    mockResolve.mockResolvedValue(context(CUP_SHEET_RULES));
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(sheet());
    await expect(validate()).rejects.toBe(PAST_GUARD);
    expect(mockPrisma.team.findMany).not.toHaveBeenCalled();
  });

  it("une ligue n'a pas de double validation", async () => {
    mockResolve.mockResolvedValue(context(LEAGUE_SHEET_RULES, "league"));
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(sheet());
    await expect(validate()).rejects.toBe(PAST_GUARD);
  });

  it("le refus de droits passe avant la double validation", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "user", roles: ["user"] });
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(sheet());
    await expect(
      validateByCommissioner({ pairingId: "cp-1", userId: "intrus" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
