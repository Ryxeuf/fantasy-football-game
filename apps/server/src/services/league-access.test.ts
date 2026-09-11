/**
 * Visibilité d'une ligue (`services/league-access`).
 *
 * Une ligue privée n'existe que pour son commissaire, les admins, les coachs
 * inscrits et les coachs invités ; pour tous les autres elle est introuvable.
 * La règle pure (`isLeagueVisibleTo`) est testée en table, puis les
 * résolutions Prisma vérifient qu'elles ne lancent les requêtes
 * d'appartenance que lorsque la règle en a besoin.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueSeason: { findUnique: vi.fn() },
    leaguePairing: { findUnique: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    leagueInvitation: { count: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  LEAGUE_VISIBILITY_SELECT,
  canViewLeague,
  canViewLeagueRow,
  findVisibleLeague,
  findVisibleSeasonLeague,
  hasPendingLeagueInvitation,
  isLeaguePairingHiddenFrom,
  isLeagueVisibleTo,
  type LeagueViewer,
} from "./league-access";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  league: { findUnique: MockFn };
  leagueSeason: { findUnique: MockFn };
  leaguePairing: { findUnique: MockFn };
  leagueParticipant: { count: MockFn };
  leagueInvitation: { count: MockFn };
};

const PRIVATE = { id: "league-1", creatorId: "commish", isPublic: false };
const PUBLIC = { id: "league-2", creatorId: "commish", isPublic: true };

const ANONYMOUS: LeagueViewer = { userId: null };
const COMMISH: LeagueViewer = { userId: "commish" };
const ADMIN: LeagueViewer = { userId: "admin-1", isAdmin: true };
const STRANGER: LeagueViewer = { userId: "stranger" };

const NONE = { isParticipant: false, hasPendingInvitation: false };

/** Appartenance simulée : `member` est inscrit, `invitee` a une invitation. */
function mockMembership(): void {
  db.leagueParticipant.count.mockImplementation(
    async (args: { where: { team: { ownerId: string } } }) =>
      args.where.team.ownerId === "member" ? 1 : 0,
  );
  db.leagueInvitation.count.mockImplementation(
    async (args: { where: { inviteeUserId: string } }) =>
      args.where.inviteeUserId === "invitee" ? 1 : 0,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockMembership();
});

describe("isLeagueVisibleTo (règle pure)", () => {
  it("une ligue publique est visible de tous, même anonyme", () => {
    expect(isLeagueVisibleTo(PUBLIC, ANONYMOUS, NONE)).toBe(true);
    expect(isLeagueVisibleTo(PUBLIC, STRANGER, NONE)).toBe(true);
  });

  it("une ligue privée est cachée à un anonyme et à un tiers connecté", () => {
    expect(isLeagueVisibleTo(PRIVATE, ANONYMOUS, NONE)).toBe(false);
    expect(isLeagueVisibleTo(PRIVATE, STRANGER, NONE)).toBe(false);
  });

  it("le commissaire et un admin voient une ligue privée", () => {
    expect(isLeagueVisibleTo(PRIVATE, COMMISH, NONE)).toBe(true);
    expect(isLeagueVisibleTo(PRIVATE, ADMIN, NONE)).toBe(true);
  });

  it("un coach inscrit ou invité en attente voit une ligue privée", () => {
    expect(
      isLeagueVisibleTo(PRIVATE, STRANGER, {
        isParticipant: true,
        hasPendingInvitation: false,
      }),
    ).toBe(true);
    expect(
      isLeagueVisibleTo(PRIVATE, STRANGER, {
        isParticipant: false,
        hasPendingInvitation: true,
      }),
    ).toBe(true);
  });

  it("l'appartenance ne sauve pas un anonyme (pas d'identité à rattacher)", () => {
    expect(
      isLeagueVisibleTo(PRIVATE, ANONYMOUS, {
        isParticipant: true,
        hasPendingInvitation: true,
      }),
    ).toBe(false);
  });
});

describe("canViewLeagueRow (résolution de l'appartenance)", () => {
  it("ligue publique : aucune requête d'appartenance", async () => {
    await expect(canViewLeagueRow(PUBLIC, STRANGER)).resolves.toBe(true);
    expect(db.leagueParticipant.count).not.toHaveBeenCalled();
    expect(db.leagueInvitation.count).not.toHaveBeenCalled();
  });

  it("commissaire et admin : aucune requête d'appartenance", async () => {
    await expect(canViewLeagueRow(PRIVATE, COMMISH)).resolves.toBe(true);
    await expect(canViewLeagueRow(PRIVATE, ADMIN)).resolves.toBe(true);
    expect(db.leagueParticipant.count).not.toHaveBeenCalled();
    expect(db.leagueInvitation.count).not.toHaveBeenCalled();
  });

  it("anonyme sur une ligue privée : refus sans requête", async () => {
    await expect(canViewLeagueRow(PRIVATE, ANONYMOUS)).resolves.toBe(false);
    expect(db.leagueParticipant.count).not.toHaveBeenCalled();
    expect(db.leagueInvitation.count).not.toHaveBeenCalled();
  });

  it("coach inscrit : accepté sur la seule requête de participation", async () => {
    await expect(canViewLeagueRow(PRIVATE, { userId: "member" })).resolves.toBe(
      true,
    );
    expect(db.leagueParticipant.count).toHaveBeenCalledWith({
      where: { team: { ownerId: "member" }, season: { leagueId: "league-1" } },
    });
    expect(db.leagueInvitation.count).not.toHaveBeenCalled();
  });

  it("coach invité en attente : accepté sur l'invitation", async () => {
    await expect(
      canViewLeagueRow(PRIVATE, { userId: "invitee" }),
    ).resolves.toBe(true);
    expect(db.leagueInvitation.count).toHaveBeenCalledWith({
      where: {
        leagueId: "league-1",
        inviteeUserId: "invitee",
        status: "pending",
      },
    });
  });

  it("tiers connecté : refusé après les deux requêtes", async () => {
    await expect(canViewLeagueRow(PRIVATE, STRANGER)).resolves.toBe(false);
    expect(db.leagueParticipant.count).toHaveBeenCalledTimes(1);
    expect(db.leagueInvitation.count).toHaveBeenCalledTimes(1);
  });
});

describe("hasPendingLeagueInvitation", () => {
  it("ne compte que les invitations `pending` adressées au coach", async () => {
    db.leagueInvitation.count.mockResolvedValue(0);
    await expect(
      hasPendingLeagueInvitation("coach-9", "league-1"),
    ).resolves.toBe(false);
    expect(db.leagueInvitation.count).toHaveBeenCalledWith({
      where: {
        leagueId: "league-1",
        inviteeUserId: "coach-9",
        status: "pending",
      },
    });
  });
});

describe("findVisibleLeague / canViewLeague", () => {
  it("charge les trois colonnes de visibilité, rien de plus", async () => {
    db.league.findUnique.mockResolvedValue(PUBLIC);
    await findVisibleLeague("league-2", ANONYMOUS);
    expect(db.league.findUnique).toHaveBeenCalledWith({
      where: { id: "league-2" },
      select: LEAGUE_VISIBILITY_SELECT,
    });
  });

  it("ligue inconnue et ligue cachée se ressemblent : null", async () => {
    db.league.findUnique.mockResolvedValue(null);
    await expect(findVisibleLeague("nope", COMMISH)).resolves.toBeNull();

    db.league.findUnique.mockResolvedValue(PRIVATE);
    await expect(findVisibleLeague("league-1", STRANGER)).resolves.toBeNull();
  });

  it("renvoie la ligne quand le lecteur peut la lire", async () => {
    db.league.findUnique.mockResolvedValue(PRIVATE);
    await expect(
      findVisibleLeague("league-1", { userId: "member" }),
    ).resolves.toEqual(PRIVATE);
  });

  it("canViewLeague : forme booléenne, admin passé en option", async () => {
    db.league.findUnique.mockResolvedValue(PRIVATE);
    await expect(canViewLeague("stranger", "league-1")).resolves.toBe(false);
    await expect(
      canViewLeague("stranger", "league-1", { isAdmin: true }),
    ).resolves.toBe(true);
    await expect(canViewLeague(null, "league-1")).resolves.toBe(false);
    await expect(canViewLeague("member", "league-1")).resolves.toBe(true);
  });
});

describe("findVisibleSeasonLeague", () => {
  it("résout la ligue par la saison et applique la même règle", async () => {
    db.leagueSeason.findUnique.mockResolvedValue({
      id: "season-1",
      league: PRIVATE,
    });
    await expect(
      findVisibleSeasonLeague("season-1", STRANGER),
    ).resolves.toBeNull();
    await expect(
      findVisibleSeasonLeague("season-1", { userId: "member" }),
    ).resolves.toEqual({ seasonId: "season-1", league: PRIVATE });
    expect(db.leagueSeason.findUnique).toHaveBeenCalledWith({
      where: { id: "season-1" },
      select: { id: true, league: { select: LEAGUE_VISIBILITY_SELECT } },
    });
  });

  it("saison inconnue : null", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(null);
    await expect(findVisibleSeasonLeague("nope", ADMIN)).resolves.toBeNull();
  });
});

describe("isLeaguePairingHiddenFrom", () => {
  it("rencontre de ligue cachée au tiers : true ; visible du membre : false", async () => {
    db.leaguePairing.findUnique.mockResolvedValue({
      round: { season: { league: PRIVATE } },
    });
    await expect(
      isLeaguePairingHiddenFrom("pairing-1", STRANGER),
    ).resolves.toBe(true);
    await expect(
      isLeaguePairingHiddenFrom("pairing-1", { userId: "member" }),
    ).resolves.toBe(false);
  });

  it("rencontre inconnue (ou de coupe) : jamais cachée ici, le service tranche", async () => {
    db.leaguePairing.findUnique.mockResolvedValue(null);
    await expect(
      isLeaguePairingHiddenFrom("cup-pairing", STRANGER),
    ).resolves.toBe(false);
  });
});
