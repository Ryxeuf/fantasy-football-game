/**
 * Tests de `league-offline-purchases` — materialisation des achats post-match
 * en mutation de roster (joueurs/relances/staff) + reversion exacte.
 *
 * Couvre :
 *  - parsePurchases (tolerant array PG / string sqlite, champs optionnels) ;
 *  - applyOfflinePurchasesForTeam : creation joueur (position par slug / par
 *    cout), increments compteurs plafonnes, recalcul TV ;
 *  - offlinePurchasesConsumed (garde-fou reversion) ;
 *  - buildPurchaseReverseOps (suppression joueurs + decrement compteurs).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => {
  const prisma: any = {
    team: { findUnique: vi.fn(), update: vi.fn() },
    teamPlayer: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { prisma };
});

vi.mock("../utils/roster-helpers", () => ({ getRosterFromDb: vi.fn() }));
vi.mock("../utils/team-values", () => ({ updateTeamValues: vi.fn() }));
vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(),
}));

import { prisma } from "../prisma";
import { getRosterFromDb } from "../utils/roster-helpers";
import { updateTeamValues } from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  parsePurchases,
  applyOfflinePurchasesForTeam,
  offlinePurchasesConsumed,
  buildPurchaseReverseOps,
  sideHasMutation,
  EMPTY_MUTATION_SIDE,
} from "./league-offline-purchases";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  teamFind: prisma.team.findUnique as MockFn,
  teamUpdate: prisma.team.update as MockFn,
  tpCreate: prisma.teamPlayer.create as MockFn,
  tpFindMany: prisma.teamPlayer.findMany as MockFn,
  tpDeleteMany: prisma.teamPlayer.deleteMany as MockFn,
  roster: getRosterFromDb as unknown as MockFn,
  tv: updateTeamValues as unknown as MockFn,
  staff: resolveStaffConfigBySlug as unknown as MockFn,
};

const POSITIONS = [
  {
    slug: "lineman",
    displayName: "Homme de ligne",
    cost: 50,
    min: 0,
    max: 16,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "",
    primarySkills: "G",
    secondarySkills: "AS",
  },
  {
    slug: "blitzer",
    displayName: "Blitzeur",
    cost: 90,
    min: 0,
    max: 4,
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "block",
    primarySkills: "GS",
    secondarySkills: "A",
  },
];

const STAFF_CONFIG = {
  rerollCost: 60000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50000,
  maxCheerleaders: 12,
  cheerleaderCost: 10000,
  maxAssistants: 6,
  assistantCost: 10000,
  dedicatedFanCost: 10000,
};

function teamRow(over: Record<string, unknown> = {}) {
  return {
    rerolls: 0,
    assistants: 0,
    cheerleaders: 0,
    apothecary: false,
    dedicatedFans: 1,
    roster: "orc",
    ruleset: "season_3",
    format: "bb11",
    players: [{ number: 1, dead: false }],
    ...over,
  };
}

describe("parsePurchases", () => {
  it("parse un array natif (PG) et conserve les champs optionnels", () => {
    const parsed = parsePurchases([
      { kind: "player", name: "Grok", cost: 90000, position: "blitzer" },
      { kind: "staff", name: "Apothicaire", cost: 50000, staff: "apothecary" },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      kind: "player",
      position: "blitzer",
      cost: 90000,
    });
    expect(parsed[1]).toMatchObject({ kind: "staff", staff: "apothecary" });
  });

  it("parse une string JSON (sqlite mirror)", () => {
    const parsed = parsePurchases(
      JSON.stringify([{ kind: "reroll", name: "Relance", cost: 120000 }]),
    );
    expect(parsed).toEqual([
      {
        kind: "reroll",
        name: "Relance",
        cost: 120000,
        position: null,
        staff: null,
        number: null,
      },
    ]);
  });

  it("ignore les entrees illisibles / kinds inconnus / JSON casse", () => {
    expect(parsePurchases("{bad json")).toEqual([]);
    expect(parsePurchases(null)).toEqual([]);
    expect(
      parsePurchases([{ kind: "wizard", name: "x", cost: 1 }, 42, null]),
    ).toEqual([]);
  });
});

describe("applyOfflinePurchasesForTeam", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.roster.mockResolvedValue({ positions: POSITIONS });
    m.staff.mockResolvedValue(STAFF_CONFIG);
    m.teamUpdate.mockResolvedValue({});
    m.tv.mockResolvedValue({ teamValue: 0, currentValue: 0 });
    let n = 0;
    m.tpCreate.mockImplementation(async () => ({ id: `new-${++n}` }));
  });

  it("retourne EMPTY quand aucun achat", async () => {
    const out = await applyOfflinePurchasesForTeam("t1", []);
    expect(out).toEqual(EMPTY_MUTATION_SIDE);
    expect(m.teamFind).not.toHaveBeenCalled();
  });

  it("cree un joueur (position par slug), numero libre, stats du roster", async () => {
    m.teamFind.mockResolvedValue(teamRow());
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "player", name: "Grok", cost: 90000, position: "blitzer" },
    ]);
    expect(m.tpCreate).toHaveBeenCalledTimes(1);
    const data = (m.tpCreate.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(data).toMatchObject({
      teamId: "t1",
      name: "Grok",
      position: "blitzer",
      number: 2, // 1 est pris
      ma: 7,
      st: 3,
      av: 9,
      skills: "block",
    });
    expect(out.createdPlayerIds).toEqual(["new-1"]);
    expect(m.tv).toHaveBeenCalledWith(prisma, "t1");
  });

  it("resout la position par cout quand le slug est absent (match unique)", async () => {
    m.teamFind.mockResolvedValue(teamRow());
    await applyOfflinePurchasesForTeam("t1", [
      { kind: "player", name: "Bob", cost: 50000 },
    ]);
    const data = (m.tpCreate.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(data.position).toBe("lineman");
  });

  it("ne cree pas de joueur si la position est ambigue / introuvable", async () => {
    m.teamFind.mockResolvedValue(teamRow());
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "player", name: "X", cost: 12345 },
    ]);
    expect(m.tpCreate).not.toHaveBeenCalled();
    expect(out.createdPlayerIds).toEqual([]);
    expect(sideHasMutation(out)).toBe(false);
  });

  it("incremente relances + staff (plafonnes) et recalcule TV", async () => {
    m.teamFind.mockResolvedValue(
      teamRow({ rerolls: 7, assistants: 0, cheerleaders: 0 }),
    );
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "reroll", name: "Relance", cost: 120000 },
      { kind: "reroll", name: "Relance", cost: 120000 }, // dépasse le cap 8 -> ignorée
      { kind: "staff", name: "Pom-pom", cost: 10000, staff: "cheerleader" },
      { kind: "staff", name: "Coach assistant", cost: 10000 }, // heuristique nom
    ]);
    expect(out.rerollsAdded).toBe(1); // 7 -> 8 (cap)
    expect(out.cheerleadersAdded).toBe(1);
    expect(out.assistantsAdded).toBe(1);
    const upd = (m.teamUpdate.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(upd).toMatchObject({ rerolls: 8, cheerleaders: 1, assistants: 1 });
    expect(m.tv).toHaveBeenCalled();
  });

  it("apothicaire : ajoute seulement si autorise et absent", async () => {
    m.teamFind.mockResolvedValue(teamRow({ apothecary: false }));
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "staff", name: "Apothicaire", cost: 50000, staff: "apothecary" },
    ]);
    expect(out.apothecaryAdded).toBe(true);
    expect(
      (m.teamUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data
        .apothecary,
    ).toBe(true);
  });

  it("apothicaire : ignore si deja present", async () => {
    m.teamFind.mockResolvedValue(teamRow({ apothecary: true }));
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "staff", name: "Apothicaire", cost: 50000, staff: "apothecary" },
    ]);
    expect(out.apothecaryAdded).toBe(false);
    expect(m.teamUpdate).not.toHaveBeenCalled();
  });

  it("plafonne a 16 joueurs vivants", async () => {
    const players = Array.from({ length: 16 }, (_, i) => ({
      number: i + 1,
      dead: false,
    }));
    m.teamFind.mockResolvedValue(teamRow({ players }));
    const out = await applyOfflinePurchasesForTeam("t1", [
      { kind: "player", name: "Trop", cost: 50000, position: "lineman" },
    ]);
    expect(m.tpCreate).not.toHaveBeenCalled();
    expect(out.createdPlayerIds).toEqual([]);
  });
});

describe("offlinePurchasesConsumed", () => {
  beforeEach(() => vi.resetAllMocks());

  it("false quand aucun joueur cree", async () => {
    const consumed = await offlinePurchasesConsumed({
      home: EMPTY_MUTATION_SIDE,
      away: EMPTY_MUTATION_SIDE,
    });
    expect(consumed).toBe(false);
    expect(m.tpFindMany).not.toHaveBeenCalled();
  });

  it("true si un joueur achete a joue / progresse / est mort", async () => {
    m.tpFindMany.mockResolvedValue([
      { id: "p1", spp: 0, matchesPlayed: 1, dead: false, advancements: "[]" },
    ]);
    const consumed = await offlinePurchasesConsumed({
      home: { ...EMPTY_MUTATION_SIDE, createdPlayerIds: ["p1"] },
      away: EMPTY_MUTATION_SIDE,
    });
    expect(consumed).toBe(true);
  });

  it("false si les joueurs achetes sont intacts", async () => {
    m.tpFindMany.mockResolvedValue([
      { id: "p1", spp: 0, matchesPlayed: 0, dead: false, advancements: "[]" },
    ]);
    const consumed = await offlinePurchasesConsumed({
      home: { ...EMPTY_MUTATION_SIDE, createdPlayerIds: ["p1"] },
      away: EMPTY_MUTATION_SIDE,
    });
    expect(consumed).toBe(false);
  });
});

describe("buildPurchaseReverseOps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.tpDeleteMany.mockReturnValue(Promise.resolve({ count: 1 }));
    m.teamUpdate.mockReturnValue(Promise.resolve({}));
  });

  it("supprime les joueurs crees et decremente les compteurs exacts", () => {
    const ops = buildPurchaseReverseOps("t1", {
      createdPlayerIds: ["p1", "p2"],
      rerollsAdded: 1,
      assistantsAdded: 2,
      cheerleadersAdded: 0,
      apothecaryAdded: true,
      dedicatedFansAdded: 1,
    });
    expect(ops).toHaveLength(2);
    expect(m.tpDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
    });
    const data = (m.teamUpdate.mock.calls[0][0] as { data: Record<string, unknown> })
      .data;
    expect(data).toEqual({
      rerolls: { decrement: 1 },
      assistants: { decrement: 2 },
      dedicatedFans: { decrement: 1 },
      apothecary: false,
    });
  });

  it("ne genere aucune op de compteur quand rien n'a change", () => {
    const ops = buildPurchaseReverseOps("t1", EMPTY_MUTATION_SIDE);
    expect(ops).toHaveLength(0);
  });
});
