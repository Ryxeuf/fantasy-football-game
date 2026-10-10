/**
 * Star Players du roster D'INSCRIPTION sur une feuille de coupe.
 *
 * Un Star Player acheté au build est figé dans le roster d'inscription
 * (`RosterSnapshot.starPlayers`), donc dans la « version du match » de
 * chaque feuille de la coupe. Il JOUE la rencontre : il doit être proposé
 * dans les pickers, porter son nom dans les actions matérialisées, et ne
 * jamais être persisté. Avant la dérivation unique, seuls les Star Players
 * engagés en coup de pouce d'avant-match étaient dérivés.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn(), count: vi.fn() },
    cupPairing: { findUnique: vi.fn() },
    cupParticipant: { findMany: vi.fn() },
    leagueMatchSheet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMatchEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    team: { findMany: vi.fn() },
    match: { findFirst: vi.fn() },
    roster: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("../utils/star-player-repository", () => ({
  getStarPlayerBySlugDb: vi.fn(),
  getAvailableStarPlayersDb: vi.fn(),
}));

vi.mock("./cup-match-sheet", async (importOriginal) => {
  const original = await importOriginal<typeof import("./cup-match-sheet")>();
  return { ...original, settleCupMatchSheet: vi.fn() };
});

vi.mock("./league-offline-result", () => ({
  recordOfflineLeagueResult: vi.fn(),
  OFFLINE_MATCH_MODE: "offline",
}));
vi.mock("./league-offline-edit", () => ({
  reverseOfflineLeagueResult: vi.fn(),
}));
vi.mock("./cup-roster-snapshot", () => ({
  captureRosterSnapshot: vi.fn(),
  parseRosterSnapshot: vi.fn(() => null),
}));
vi.mock("./push-notifications", () => ({
  sendLeagueMatchValidationPush: vi.fn(),
}));
vi.mock("./league-predictions-settlement", () => ({
  markPairingPredictionsClosed: vi.fn(),
}));
vi.mock("../utils/team-values", async () => {
  const { getSpecialRulesForTeam } = await import("@bb/game-engine");
  return {
    updateTeamValues: vi.fn(),
    resolveSpecialRulesForTeam: vi.fn(
      (_db: unknown, rosterSlug: string, ruleset: string) =>
        Promise.resolve(getSpecialRulesForTeam(rosterSlug, ruleset as never)),
    ),
  };
});
vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(() =>
    Promise.resolve({ apothecaryAllowed: true }),
  ),
}));

import { prisma } from "../prisma";
import {
  getAvailableStarPlayersDb,
  getStarPlayerBySlugDb,
} from "../utils/star-player-repository";
import { settleCupMatchSheet } from "./cup-match-sheet";
import { recordOfflineLeagueResult } from "./league-offline-result";
import { resolveSpecialRulesForTeam } from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import { getSpecialRulesForTeam } from "@bb/game-engine";
import { getMatchSheet, validateByCommissioner } from "./league-match-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockStar = getStarPlayerBySlugDb as ReturnType<typeof vi.fn>;
const mockSettle = settleCupMatchSheet as ReturnType<typeof vi.fn>;

const HOME = "home-owner";
const AWAY = "away-owner";
const COMMISH = "commish";

const MORG = {
  slug: "morg_n_thorg",
  displayName: "Morg 'n' Thorg",
  cost: 380_000,
  ma: 6,
  st: 6,
  ag: 3,
  pa: 4,
  av: 11,
  skills: "block,mighty-blow-2,thick-skull,throw-team-mate",
  hirableBy: ["all"],
};

function frozen(starPlayers: Array<{ starPlayerSlug: string; cost: number }>) {
  return {
    capturedAt: 1,
    roster: "human",
    ruleset: "season_3",
    format: "bb11",
    teamValue: 1_000_000,
    currentValue: 1_000_000,
    treasury: 0,
    initialBudget: 1000,
    startingPspPool: 0,
    rerolls: 2,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    dedicatedFans: 1,
    players: [],
    starPlayers,
  };
}

function team(id: string, ownerId: string, players: string[]) {
  return {
    id,
    name: id,
    roster: "human",
    ruleset: "season_3",
    format: "bb11",
    teamValue: 1_000_000,
    currentValue: 1_000_000,
    treasury: 0,
    dedicatedFans: 1,
    rerolls: 2,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    owner: { coachName: ownerId },
    players: players.map((pid, i) => ({
      id: pid,
      number: i + 1,
      name: `Joueur ${pid}`,
      position: "human_lineman",
      dead: false,
      missNextMatch: false,
      spp: 0,
      skills: "",
      advancements: "[]",
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
    })),
  };
}

function mockCupPairing() {
  mockPrisma.leaguePairing.findUnique.mockResolvedValue(null);
  mockPrisma.cupPairing.findUnique.mockResolvedValue({
    id: "pair-1",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    homeTeam: { ownerId: HOME },
    awayTeam: { ownerId: AWAY },
    round: { cup: { id: "cup-1", name: "Coupe", creatorId: COMMISH } },
  });
}

const ELEVEN = Array.from({ length: 11 }, (_, i) => `p${i + 1}`);

beforeEach(() => {
  vi.resetAllMocks();
  (resolveStaffConfigBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
    apothecaryAllowed: true,
  });
  (resolveSpecialRulesForTeam as ReturnType<typeof vi.fn>).mockImplementation(
    (_db: unknown, rosterSlug: string, ruleset: string) =>
      Promise.resolve(getSpecialRulesForTeam(rosterSlug, ruleset as never)),
  );
  mockStar.mockImplementation(async (slug: string) =>
    slug === MORG.slug ? MORG : null,
  );
  (getAvailableStarPlayersDb as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  mockCupPairing();
  mockPrisma.team.findMany.mockResolvedValue([
    team("team-home", HOME, ELEVEN.map((p) => `h-${p}`)),
    team("team-away", AWAY, ELEVEN.map((p) => `a-${p}`)),
  ]);
});

describe("feuille de coupe — Star Players du roster d'inscription", () => {
  it("la lecture aligne le Star Player acheté au build dans les pickers", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
      id: "ms1",
      status: "draft",
      cupPairingId: "pair-1",
      rosterSnapshotHome: frozen([
        { starPlayerSlug: "morg_n_thorg", cost: 380_000 },
      ]),
      rosterSnapshotAway: frozen([]),
      events: [],
    });

    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });

    expect(out.competitionKind).toBe("cup");
    expect(out.teams.home?.starPlayersHired).toEqual([
      expect.objectContaining({
        id: "star-home-morg_n_thorg",
        name: "Morg 'n' Thorg",
        registered: true,
      }),
    ]);
    expect(out.teams.away?.starPlayersHired).toEqual([]);
  });

  it("la validation nomme le Star Player du build dans les actions et ne persiste rien", async () => {
    mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
      id: "ms1",
      status: "submitted",
      cupPairingId: "pair-1",
      rosterSnapshotHome: frozen([
        { starPlayerSlug: "morg_n_thorg", cost: 380_000 },
      ]),
      rosterSnapshotAway: frozen([]),
      motmPlayerIds: ["star-home-morg_n_thorg"],
    });
    mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
      {
        kind: "touchdown",
        team: "home",
        actorPlayerId: "star-home-morg_n_thorg",
      },
    ]);
    mockSettle.mockResolvedValue({ localMatchId: "lm1" });
    mockPrisma.leagueMatchSheet.update.mockResolvedValue({
      id: "ms1",
      status: "validated",
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    expect(mockSettle).toHaveBeenCalledTimes(1);
    const { actions, scoreHome } = mockSettle.mock.calls[0][0];
    expect(scoreHome).toBe(1);
    expect(actions).toEqual([
      expect.objectContaining({
        actionType: "td",
        playerId: "star-home-morg_n_thorg",
        playerName: "Morg 'n' Thorg",
      }),
    ]);
    // Une coupe n'écrit rien sur les équipes : aucun résultat de ligue (PSP,
    // blessures, or) n'est joué, Star Player compris.
    expect(recordOfflineLeagueResult).not.toHaveBeenCalled();
  });
});
