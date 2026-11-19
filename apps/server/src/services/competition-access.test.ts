/**
 * Visibilité d'une compétition (`services/competition-access`).
 *
 * Une coupe privée n'existe que pour son commissaire, les admins, les
 * propriétaires d'une équipe inscrite et les coachs invités — calque exact
 * de la ligue. La règle pure est testée en table ; les résolutions Prisma
 * vérifient qu'elles ne lancent les requêtes d'appartenance que si besoin.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    leagueInvitation: { count: vi.fn() },
    cup: { findUnique: vi.fn() },
    cupPairing: { findUnique: vi.fn() },
    cupParticipant: { count: vi.fn() },
    cupInvitation: { count: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  canViewCupRow,
  competitionNotFoundMessage,
  findVisibleCompetition,
  findVisibleCup,
  isCupPairingHiddenFrom,
  isCupVisibleTo,
} from "./competition-access";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, MockFn>>;

const PRIVATE_CUP = { id: "cup-1", creatorId: "boss", isPublic: false };
const PUBLIC_CUP = { ...PRIVATE_CUP, isPublic: true };

beforeEach(() => {
  vi.resetAllMocks();
  db.cupParticipant.count.mockResolvedValue(0);
  db.cupInvitation.count.mockResolvedValue(0);
  db.leagueParticipant.count.mockResolvedValue(0);
  db.leagueInvitation.count.mockResolvedValue(0);
});

describe("isCupVisibleTo (pur)", () => {
  const none = { isParticipant: false, hasPendingInvitation: false };
  it.each([
    ["publique, anonyme", PUBLIC_CUP, { userId: null }, none, true],
    ["privée, anonyme", PRIVATE_CUP, { userId: null }, none, false],
    ["privée, admin", PRIVATE_CUP, { userId: "x", isAdmin: true }, none, true],
    ["privée, commissaire", PRIVATE_CUP, { userId: "boss" }, none, true],
    ["privée, étranger", PRIVATE_CUP, { userId: "x" }, none, false],
    [
      "privée, inscrit",
      PRIVATE_CUP,
      { userId: "x" },
      { isParticipant: true, hasPendingInvitation: false },
      true,
    ],
    [
      "privée, invité",
      PRIVATE_CUP,
      { userId: "x" },
      { isParticipant: false, hasPendingInvitation: true },
      true,
    ],
    [
      "privée, anonyme même « inscrit »",
      PRIVATE_CUP,
      { userId: null },
      { isParticipant: true, hasPendingInvitation: true },
      false,
    ],
  ])("%s", (_label, cup, viewer, membership, expected) => {
    expect(isCupVisibleTo(cup, viewer, membership)).toBe(expected);
  });
});

describe("canViewCupRow", () => {
  it("coupe publique : aucune requête d'appartenance", async () => {
    expect(await canViewCupRow(PUBLIC_CUP, { userId: "x" })).toBe(true);
    expect(db.cupParticipant.count).not.toHaveBeenCalled();
  });

  it("anonyme sur coupe privée : refus sans requête", async () => {
    expect(await canViewCupRow(PRIVATE_CUP, { userId: null })).toBe(false);
    expect(db.cupParticipant.count).not.toHaveBeenCalled();
  });

  it("inscrit : la requête porte sur le propriétaire de l'équipe", async () => {
    db.cupParticipant.count.mockResolvedValue(1);
    expect(await canViewCupRow(PRIVATE_CUP, { userId: "coach" })).toBe(true);
    expect(db.cupParticipant.count).toHaveBeenCalledWith({
      where: { cupId: "cup-1", team: { ownerId: "coach" } },
    });
    expect(db.cupInvitation.count).not.toHaveBeenCalled();
  });

  it("invité : invitation en attente au coach OU à une de ses équipes", async () => {
    db.cupInvitation.count.mockResolvedValue(1);
    expect(await canViewCupRow(PRIVATE_CUP, { userId: "coach" })).toBe(true);
    expect(db.cupInvitation.count).toHaveBeenCalledWith({
      where: {
        cupId: "cup-1",
        status: "pending",
        OR: [{ inviteeUserId: "coach" }, { inviteeTeam: { ownerId: "coach" } }],
      },
    });
  });

  it("étranger : refus", async () => {
    expect(await canViewCupRow(PRIVATE_CUP, { userId: "coach" })).toBe(false);
  });
});

describe("findVisibleCup", () => {
  it("null pour un id inconnu", async () => {
    db.cup.findUnique.mockResolvedValue(null);
    expect(await findVisibleCup("nope", { userId: "x" })).toBeNull();
  });

  it("null pour une coupe privée cachée — même réponse qu'inconnue", async () => {
    db.cup.findUnique.mockResolvedValue(PRIVATE_CUP);
    expect(await findVisibleCup("cup-1", { userId: "x" })).toBeNull();
  });

  it("rend la coupe visible", async () => {
    db.cup.findUnique.mockResolvedValue(PUBLIC_CUP);
    expect(await findVisibleCup("cup-1", { userId: null })).toEqual(PUBLIC_CUP);
  });
});

describe("isCupPairingHiddenFrom", () => {
  it("faux pour un id inconnu (rencontre de ligue ou inexistante)", async () => {
    db.cupPairing.findUnique.mockResolvedValue(null);
    expect(await isCupPairingHiddenFrom("p", { userId: "x" })).toBe(false);
  });

  it("vrai pour une rencontre d'une coupe privée cachée", async () => {
    db.cupPairing.findUnique.mockResolvedValue({ round: { cup: PRIVATE_CUP } });
    expect(await isCupPairingHiddenFrom("p", { userId: "x" })).toBe(true);
  });

  it("faux pour le commissaire", async () => {
    db.cupPairing.findUnique.mockResolvedValue({ round: { cup: PRIVATE_CUP } });
    expect(await isCupPairingHiddenFrom("p", { userId: "boss" })).toBe(false);
  });
});

describe("findVisibleCompetition", () => {
  it("ligue publique : servie avec son statut d'archivage", async () => {
    db.league.findUnique.mockResolvedValue({
      id: "l1",
      creatorId: "boss",
      isPublic: true,
      name: "Ligue",
      status: "archived",
    });
    expect(await findVisibleCompetition("league", "l1", { userId: null })).toEqual({
      kind: "league",
      id: "l1",
      name: "Ligue",
      creatorId: "boss",
      isPublic: true,
      archived: true,
    });
  });

  it("ligue privée cachée : null", async () => {
    db.league.findUnique.mockResolvedValue({
      id: "l1",
      creatorId: "boss",
      isPublic: false,
      name: "Ligue",
      status: "in_progress",
    });
    expect(await findVisibleCompetition("league", "l1", { userId: "x" })).toBeNull();
  });

  it("coupe archivée : `archivee` lu comme archivée", async () => {
    db.cup.findUnique.mockResolvedValue({
      ...PUBLIC_CUP,
      name: "Coupe",
      status: "archivee",
    });
    const found = await findVisibleCompetition("cup", "cup-1", { userId: null });
    expect(found).toMatchObject({ kind: "cup", archived: true });
  });

  it("coupe privée cachée : null", async () => {
    db.cup.findUnique.mockResolvedValue({ ...PRIVATE_CUP, name: "C", status: "en_cours" });
    expect(await findVisibleCompetition("cup", "cup-1", { userId: "x" })).toBeNull();
  });

  it("message de 404 propre à chaque famille", () => {
    expect(competitionNotFoundMessage("league")).toBe("Ligue introuvable");
    expect(competitionNotFoundMessage("cup")).toBe("Coupe introuvable");
  });
});
