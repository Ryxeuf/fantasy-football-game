/**
 * Tests du service `competition-lifecycle` (archivage / suppression d'une
 * ligue ou d'une coupe par son commissaire).
 *
 * Prisma et le fan-out in-app mockés. Vérifie :
 *  - 404 / 403 typés (créateur ou admin uniquement)
 *  - archivage idempotent, statut posé, participants notifiés hors acteur
 *  - suppression : destinataires résolus AVANT le delete, notifiés APRÈS
 *  - libellé « par un administrateur » quand l'acteur n'est pas le créateur
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    cup: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    leagueParticipant: { findMany: vi.fn() },
    cupParticipant: { findMany: vi.fn() },
  },
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotifications: vi.fn(async (ids: string[]) => ids.length),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import { createInAppNotifications } from "./in-app-notifications";
import {
  archiveLeague,
  deleteLeague,
  archiveCup,
  deleteCup,
  listLeagueParticipantUserIds,
  listCupParticipantUserIds,
  CompetitionLifecycleError,
  LEAGUE_ARCHIVED_STATUS,
  CUP_ARCHIVED_STATUS,
} from "./competition-lifecycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const fanOut = createInAppNotifications as ReturnType<typeof vi.fn>;

const commissioner = { userId: "commish", isAdmin: false };
const admin = { userId: "admin-1", isAdmin: true };
const stranger = { userId: "coach-x", isAdmin: false };

function participants(ownerIds: Array<string | null>) {
  return ownerIds.map((ownerId) => ({
    team: ownerId === null ? null : { ownerId },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  fanOut.mockImplementation(async (ids: string[]) => ids.length);
  db.league.findUnique.mockResolvedValue({
    id: "lg-1",
    name: "Open 5 Teams",
    creatorId: "commish",
    status: "in_progress",
  });
  db.cup.findUnique.mockResolvedValue({
    id: "cup-1",
    name: "Nuffle Cup",
    creatorId: "commish",
    status: "ouverte",
  });
  db.leagueParticipant.findMany.mockResolvedValue(
    participants(["coach-a", "coach-b", "commish", "coach-a", null]),
  );
  db.cupParticipant.findMany.mockResolvedValue(
    participants(["coach-c", "commish"]),
  );
});

describe("autorisation", () => {
  it("404 typé quand la ligue n'existe pas", async () => {
    db.league.findUnique.mockResolvedValue(null);
    await expect(archiveLeague("nope", commissioner)).rejects.toMatchObject({
      name: "CompetitionLifecycleError",
      code: "not_found",
    });
    expect(db.league.update).not.toHaveBeenCalled();
  });

  it("403 typé pour un coach qui n'est ni créateur ni admin", async () => {
    const err = await archiveLeague("lg-1", stranger).catch((e) => e);
    expect(err).toBeInstanceOf(CompetitionLifecycleError);
    expect(err.code).toBe("forbidden");
    expect(db.league.update).not.toHaveBeenCalled();

    await expect(deleteCup("cup-1", stranger)).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(db.cup.delete).not.toHaveBeenCalled();
  });

  it("un admin peut gérer une compétition qu'il n'a pas créée", async () => {
    const result = await archiveLeague("lg-1", admin);
    expect(result.changed).toBe(true);
    expect(db.league.update).toHaveBeenCalledWith({
      where: { id: "lg-1" },
      data: { status: LEAGUE_ARCHIVED_STATUS },
    });
    // Libellé adapté : ce n'est pas le commissaire qui agit.
    expect(fanOut.mock.calls[0][1].body).toContain("par un administrateur");
  });
});

describe("archivage", () => {
  it("pose le statut archivé, notifie les coachs inscrits (dédoublonnés, hors acteur)", async () => {
    const result = await archiveLeague("lg-1", commissioner);
    expect(result).toEqual({
      id: "lg-1",
      kind: "league",
      status: "archived",
      previousStatus: "in_progress",
      changed: true,
      notified: 2,
    });
    expect(db.leagueParticipant.findMany).toHaveBeenCalledWith({
      where: { season: { leagueId: "lg-1" }, status: "active" },
      select: { team: { select: { ownerId: true } } },
    });
    expect(fanOut).toHaveBeenCalledTimes(1);
    const [recipients, payload] = fanOut.mock.calls[0];
    expect(recipients).toEqual(["coach-a", "coach-b"]);
    expect(payload).toEqual({
      kind: "league.archived",
      title: "Ligue archivée",
      body: "La ligue « Open 5 Teams » a été archivée par son commissaire. Elle reste consultable en lecture seule.",
      url: "/leagues/lg-1",
      meta: { leagueId: "lg-1" },
    });
  });

  it("est idempotent : ligue déjà archivée → changed=false, aucune écriture ni notification", async () => {
    db.league.findUnique.mockResolvedValue({
      id: "lg-1",
      name: "Open",
      creatorId: "commish",
      status: "archived",
    });
    const result = await archiveLeague("lg-1", commissioner);
    expect(result.changed).toBe(false);
    expect(result.notified).toBe(0);
    expect(db.league.update).not.toHaveBeenCalled();
    expect(fanOut).not.toHaveBeenCalled();
  });

  it("coupe : statut « archivee » depuis n'importe quel statut, lien /cups/:id", async () => {
    const result = await archiveCup("cup-1", commissioner);
    expect(result).toMatchObject({
      kind: "cup",
      status: CUP_ARCHIVED_STATUS,
      previousStatus: "ouverte",
      changed: true,
      notified: 1,
    });
    expect(db.cup.update).toHaveBeenCalledWith({
      where: { id: "cup-1" },
      data: { status: "archivee" },
    });
    const [recipients, payload] = fanOut.mock.calls[0];
    expect(recipients).toEqual(["coach-c"]);
    expect(payload.kind).toBe("cup.archived");
    expect(payload.url).toBe("/cups/cup-1");
    expect(payload.meta).toEqual({ cupId: "cup-1" });
  });
});

describe("suppression", () => {
  it("résout les destinataires AVANT le delete et notifie APRÈS, sans lien", async () => {
    const order: string[] = [];
    db.leagueParticipant.findMany.mockImplementation(async () => {
      order.push("participants");
      return participants(["coach-a"]);
    });
    db.league.delete.mockImplementation(async () => {
      order.push("delete");
      return {};
    });
    fanOut.mockImplementation(async (ids: string[]) => {
      order.push("notify");
      return ids.length;
    });

    const result = await deleteLeague("lg-1", commissioner);
    expect(order).toEqual(["participants", "delete", "notify"]);
    expect(db.league.delete).toHaveBeenCalledWith({ where: { id: "lg-1" } });
    expect(result).toEqual({
      id: "lg-1",
      kind: "league",
      name: "Open 5 Teams",
      notified: 1,
    });
    const [, payload] = fanOut.mock.calls[0];
    expect(payload).toEqual({
      kind: "league.deleted",
      title: "Ligue supprimée",
      body: "La ligue « Open 5 Teams » a été supprimée par son commissaire.",
      url: null,
      meta: { name: "Open 5 Teams" },
    });
  });

  it("un delete qui échoue ne notifie personne", async () => {
    db.league.delete.mockRejectedValue(new Error("fk"));
    await expect(deleteLeague("lg-1", commissioner)).rejects.toThrow("fk");
    expect(fanOut).not.toHaveBeenCalled();
  });

  it("coupe : delete + notification cup.deleted", async () => {
    const result = await deleteCup("cup-1", admin);
    expect(db.cup.delete).toHaveBeenCalledWith({ where: { id: "cup-1" } });
    expect(result).toMatchObject({ kind: "cup", name: "Nuffle Cup", notified: 2 });
    const [recipients, payload] = fanOut.mock.calls[0];
    // L'admin n'est pas le créateur : le commissaire est notifié lui aussi.
    expect(recipients).toEqual(["coach-c", "commish"]);
    expect(payload.kind).toBe("cup.deleted");
    expect(payload.body).toContain("par un administrateur");
  });
});

describe("résolution des participants", () => {
  it("ligue : dédoublonne et ignore les équipes sans propriétaire", async () => {
    await expect(listLeagueParticipantUserIds("lg-1")).resolves.toEqual([
      "coach-a",
      "coach-b",
      "commish",
    ]);
  });
  it("coupe : filtre par cupId", async () => {
    await expect(listCupParticipantUserIds("cup-1")).resolves.toEqual([
      "coach-c",
      "commish",
    ]);
    expect(db.cupParticipant.findMany).toHaveBeenCalledWith({
      where: { cupId: "cup-1" },
      select: { team: { select: { ownerId: true } } },
    });
  });
});
