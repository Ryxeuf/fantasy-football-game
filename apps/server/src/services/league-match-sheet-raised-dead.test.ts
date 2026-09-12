/**
 * Maîtres de la Non-vie — « Relever le Mort » sur la feuille de match, côté
 * service (Prisma mocké, summarizer et dérivations pures réels).
 *
 * Scénario : les Morts-Vivants (domicile, 12 joueurs) affrontent des Humains
 * (extérieur). Un Trois-quart humain meurt ; le coach mort-vivant le relève
 * en Zombie, qui joue le match, gagne des PSP, peut évoluer et rejoint le
 * roster GRATUITEMENT à la validation.
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
  },
}));

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
    Promise.resolve({ apothecaryAllowed: false }),
  ),
}));
vi.mock("./league-sheet-advancements", () => ({
  parseStagedAdvancements: (raw: unknown) => (Array.isArray(raw) ? raw : []),
  applyStagedAdvancements: vi.fn(),
  reverseAppliedAdvancements: vi.fn(),
}));

import { prisma } from "../prisma";
import { getSpecialRulesForTeam } from "@bb/game-engine";
import {
  getMatchSheet,
  rollJourneymanRandomPrimary,
  updatePostMatch,
  updateRaisedDead,
  validateByCommissioner,
} from "./league-match-sheet";
import { recordOfflineLeagueResult } from "./league-offline-result";
import {
  resolveSpecialRulesForTeam,
  updateTeamValues,
} from "../utils/team-values";
import { resolveStaffConfigBySlug } from "./roster-staff-config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockRecordOffline = recordOfflineLeagueResult as ReturnType<typeof vi.fn>;
const mockResolveSpecialRules =
  resolveSpecialRulesForTeam as unknown as ReturnType<typeof vi.fn>;
const mockResolveStaffConfig =
  resolveStaffConfigBySlug as unknown as ReturnType<typeof vi.fn>;
const mockUpdateTeamValues = updateTeamValues as unknown as ReturnType<
  typeof vi.fn
>;

const HOME = "home-owner";
const AWAY = "away-owner";
const COMMISH = "commish";
const ZOMBIE = "undead_trois_quart_zombie";
const SKELETON = "undead_trois_quart_squelette";
const RAISED = "raised-home-1";

interface PlayerRow {
  id: string;
  number: number;
  name: string;
  position: string;
  dead: boolean;
  missNextMatch: boolean;
  spp: number;
  skills: string;
  advancements: string;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
}

function undeadPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i + 1}`,
    number: i + 1,
    name: `Zombie ${i + 1}`,
    position: ZOMBIE,
    dead: false,
    missNextMatch: false,
    spp: 0,
    skills: "fork,instable,regeneration",
    advancements: "[]",
    ma: 4,
    st: 3,
    ag: 4,
    pa: 6,
    av: 9,
  }));
}

function humanPlayers(
  count: number,
  overrides: Record<string, Partial<PlayerRow>> = {},
): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `a${i + 1}`;
    return {
      id,
      number: i + 1,
      name: `Humain ${i + 1}`,
      position: "human_trois_quart",
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
      ...overrides[id],
    };
  });
}

/** Le Zombie n°1 des Morts-Vivants tue le Trois-quart humain n°1. */
const KILL_A1 = {
  id: "ev-kill",
  kind: "casualty",
  team: "home",
  actorPlayerId: "h1",
  targetPlayerId: "a1",
  injurySeverity: "dead",
};

function mockMatch(
  input: {
    sheet?: Record<string, unknown>;
    events?: Array<Record<string, unknown>>;
    homePlayers?: PlayerRow[];
    awayPlayers?: PlayerRow[];
    homeRoster?: string;
  } = {},
) {
  mockPrisma.leaguePairing.findUnique.mockResolvedValue({
    id: "pair-1",
    round: { season: { league: { id: "L1", creatorId: COMMISH } } },
    homeParticipant: { teamId: "team-home", team: { ownerId: HOME } },
    awayParticipant: { teamId: "team-away", team: { ownerId: AWAY } },
  });
  mockPrisma.team.findMany.mockResolvedValue([
    {
      id: "team-home",
      name: "Champs Funestes",
      roster: input.homeRoster ?? "undead",
      players: input.homePlayers ?? undeadPlayers(12),
    },
    {
      id: "team-away",
      name: "Reikland",
      roster: "human",
      players: input.awayPlayers ?? humanPlayers(11),
    },
  ]);
  const events = input.events ?? [KILL_A1];
  mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
    id: "ms1",
    status: "draft",
    motmPlayerIds: [],
    events,
    ...input.sheet,
  });
  mockPrisma.leagueMatchEvent.findMany.mockResolvedValue(events);
  mockPrisma.leagueMatchSheet.update.mockImplementation(
    async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
  );
}

const RAISE_ZOMBIE = { victimId: "a1", position: ZOMBIE };

beforeEach(() => {
  vi.resetAllMocks();
  mockResolveStaffConfig.mockResolvedValue({ apothecaryAllowed: false });
  mockResolveSpecialRules.mockImplementation(
    (_db: unknown, rosterSlug: string, ruleset: string) =>
      Promise.resolve(getSpecialRulesForTeam(rosterSlug, ruleset as never)),
  );
  mockUpdateTeamValues.mockResolvedValue({ teamValue: 0, currentValue: 0 });
});

describe("getMatchSheet — Maîtres de la Non-vie", () => {
  it("expose au porteur de la règle les adversaires tués relevables et les Trois-quarts au choix", async () => {
    mockMatch();
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead).toEqual({
      sources: ["masters_of_undeath"],
      victims: [
        {
          id: "a1",
          number: 1,
          name: "Humain 1",
          // Libellé du poste résolu par le catalogue (repli sans base).
          positionName: expect.any(String),
          source: "masters_of_undeath",
        },
      ],
      positions: [
        { slug: SKELETON, name: "Trois-quart Squelette" },
        { slug: ZOMBIE, name: "Trois-quart Zombie" },
      ],
      choice: null,
      canHire: true,
    });
    expect(out.teams.home?.raisedDead).toBeNull();
    // Les Humains n'ont pas la règle : rien n'est proposé.
    expect(out.teams.away?.raiseDead).toBeUndefined();
    expect(out.teams.away?.raisedDead).toBeUndefined();
  });

  it("écarte un mort de Force 5+ ou porteur du Trait Minus", async () => {
    mockMatch({
      awayPlayers: humanPlayers(11, {
        a1: { st: 5 },
        a2: { skills: "dodge,stunty" },
      }),
      events: [
        KILL_A1,
        { ...KILL_A1, id: "ev-kill-2", targetPlayerId: "a2" },
        { ...KILL_A1, id: "ev-kill-3", targetPlayerId: "a3" },
      ],
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.victims.map((v) => v.id)).toEqual(["a3"]);
  });

  it("dérive le Trois-quart relevé depuis le choix stocké : en réserve, au numéro suivant, avec le nom du mort", async () => {
    mockMatch({
      sheet: {
        raisedDeadHome: RAISE_ZOMBIE,
        motmPlayerIds: [RAISED],
      },
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raisedDead).toMatchObject({
      id: RAISED,
      number: 13,
      name: "Humain 1",
      position: ZOMBIE,
      positionName: "Mort relevé (Trois-quart Zombie)",
      cost: 40_000,
      victimId: "a1",
    });
    expect(out.teams.home?.raiseDead?.choice).toEqual(RAISE_ZOMBIE);
    // Joueur du Match sans autre stat : son côté se lit dans son id, comme
    // pour un journalier — 4 PSP proposés dès la saisie.
    expect(out.computedSpp[RAISED]).toBe(4);
  });

  it("lit le choix sérialisé en chaîne (miroir sqlite)", async () => {
    mockMatch({ sheet: { raisedDeadHome: JSON.stringify(RAISE_ZOMBIE) } });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raisedDead?.id).toBe(RAISED);
  });

  it("le relevé disparaît avec la sortie du mort (évènement retiré)", async () => {
    mockMatch({ sheet: { raisedDeadHome: RAISE_ZOMBIE }, events: [] });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.victims).toEqual([]);
    expect(out.teams.home?.raisedDead).toBeNull();
  });

  it("`canHire` tombe quand la liste compte déjà 16 joueurs (hors morts de ce match)", async () => {
    mockMatch({ homePlayers: undeadPlayers(16) });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.canHire).toBe(false);

    // Un Zombie mort-vivant tué ce match libère sa place.
    mockMatch({
      homePlayers: undeadPlayers(16),
      events: [
        KILL_A1,
        {
          id: "ev-kill-h2",
          kind: "casualty",
          team: "away",
          actorPlayerId: "a2",
          targetPlayerId: "h2",
          injurySeverity: "dead",
        },
      ],
    });
    const again = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(again.teams.home?.raiseDead?.canHire).toBe(true);
  });

  it("un journalier adverse tué est relevable (les synthétiques comptent)", async () => {
    // 10 Humains : un journalier `journeyman-away-1`, tué par le Zombie.
    mockMatch({
      awayPlayers: humanPlayers(10),
      events: [{ ...KILL_A1, targetPlayerId: "journeyman-away-1" }],
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.victims.map((v) => v.id)).toEqual([
      "journeyman-away-1",
    ]);
  });
});

describe("updateRaisedDead", () => {
  it("le coach porteur de la règle relève un mort en Zombie", async () => {
    mockMatch();
    await updateRaisedDead({
      pairingId: "pair-1",
      userId: HOME,
      side: "home",
      victimId: "a1",
      position: ZOMBIE,
    });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledWith({
      where: { id: "ms1" },
      data: { raisedDeadHome: RAISE_ZOMBIE },
    });
  });

  it("sans poste : Trois-quart de base à la dérivation, choix stocké à null", async () => {
    mockMatch();
    await updateRaisedDead({
      pairingId: "pair-1",
      userId: HOME,
      side: "home",
      victimId: "a1",
    });
    expect(mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data).toEqual({
      raisedDeadHome: { victimId: "a1", position: null },
    });
  });

  it("annule le relevé avec `victimId: null`", async () => {
    mockMatch({ sheet: { raisedDeadHome: RAISE_ZOMBIE } });
    await updateRaisedDead({
      pairingId: "pair-1",
      userId: HOME,
      side: "home",
      victimId: null,
    });
    expect(mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data).toEqual({
      raisedDeadHome: null,
    });
  });

  it("refuse le coach adverse (raise_dead_wrong_side) mais accepte le commissaire", async () => {
    mockMatch();
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: AWAY,
        side: "home",
        victimId: "a1",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_wrong_side" });
    await updateRaisedDead({
      pairingId: "pair-1",
      userId: COMMISH,
      side: "home",
      victimId: "a1",
    });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledTimes(1);
  });

  it("refuse un tiers (forbidden)", async () => {
    mockMatch();
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: "stranger",
        side: "home",
        victimId: "a1",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("refuse une équipe sans la règle (raise_dead_not_allowed)", async () => {
    mockMatch();
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: AWAY,
        side: "away",
        victimId: "h1",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_not_allowed" });
  });

  it("refuse un adversaire vivant, ou de l'autre camp (raise_dead_invalid_victim)", async () => {
    mockMatch();
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: HOME,
        side: "home",
        victimId: "a2",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_invalid_victim" });
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: HOME,
        side: "home",
        victimId: "h1",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_invalid_victim" });
  });

  it("refuse un poste qui n'est pas un Trois-quart de la fiche (raise_dead_invalid_position)", async () => {
    mockMatch();
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: HOME,
        side: "home",
        victimId: "a1",
        position: "undead_momie",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_invalid_position" });
  });

  it("feuille validée : plus de relevé", async () => {
    mockMatch({ sheet: { status: "validated" } });
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: HOME,
        side: "home",
        victimId: "a1",
      }),
    ).rejects.toMatchObject({ code: "already_validated" });
  });
});

describe("évolution et tirage du mort relevé", () => {
  it("l'évolution stagée pour `raised-home-1` appartient bien au domicile", async () => {
    mockMatch({ sheet: { raisedDeadHome: RAISE_ZOMBIE } });
    await updatePostMatch({
      pairingId: "pair-1",
      userId: HOME,
      payload: {
        advancementsHome: [
          { playerId: RAISED, type: "primary", skillSlug: "block" },
        ],
      },
    });
    const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
    expect(data.advancementsHome).toEqual([
      { playerId: RAISED, type: "primary", skillSlug: "block" },
    ]);
  });

  it("sans relevé, `raised-home-1` est hors de l'équipe", async () => {
    mockMatch();
    await expect(
      updatePostMatch({
        pairingId: "pair-1",
        userId: HOME,
        payload: {
          advancementsHome: [
            { playerId: RAISED, type: "primary", skillSlug: "block" },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: "advancement_invalid_player" });
  });

  it("la feuille sert le tirage « Hasard » du relevé (deux candidats, Principale du Zombie)", async () => {
    mockMatch({ sheet: { raisedDeadHome: RAISE_ZOMBIE } });
    const roll = await rollJourneymanRandomPrimary({
      pairingId: "pair-1",
      userId: HOME,
      journeymanId: RAISED,
      category: "G",
    });
    expect(roll.rolled).toBe(true);
    expect(roll.candidates).toHaveLength(2);
    // Déterministe : même paire au second appel.
    const again = await rollJourneymanRandomPrimary({
      pairingId: "pair-1",
      userId: HOME,
      journeymanId: RAISED,
      category: "G",
    });
    expect(again.candidates).toEqual(roll.candidates);
    // Agilité n'est pas Principale pour un Trois-quart Zombie (G,K).
    await expect(
      rollJourneymanRandomPrimary({
        pairingId: "pair-1",
        userId: HOME,
        journeymanId: RAISED,
        category: "A",
      }),
    ).rejects.toMatchObject({ code: "category_not_primary" });
    // Le coach adverse ne tire pas pour lui.
    await expect(
      rollJourneymanRandomPrimary({
        pairingId: "pair-1",
        userId: AWAY,
        journeymanId: RAISED,
        category: "G",
      }),
    ).rejects.toMatchObject({ code: "advancement_wrong_side" });
  });

  it("aucun relevé : le tirage ne connaît pas `raised-home-1`", async () => {
    mockMatch();
    await expect(
      rollJourneymanRandomPrimary({
        pairingId: "pair-1",
        userId: HOME,
        journeymanId: RAISED,
        category: "G",
      }),
    ).rejects.toMatchObject({ code: "journeyman_not_found" });
  });
});

describe("validateByCommissioner — recrutement GRATUIT du mort relevé", () => {
  const HIRE = { kind: "raised_dead", name: "", cost: 0 };
  /** Le Zombie relevé marque un TD (3 PSP). */
  const RAISED_TD = {
    id: "ev-td",
    kind: "touchdown",
    team: "home",
    actorPlayerId: RAISED,
  };

  function mockValidation(
    sheet: Record<string, unknown>,
    extra: {
      events?: Array<Record<string, unknown>>;
      homePlayers?: PlayerRow[];
    } = {},
  ) {
    mockMatch({
      sheet: { status: "both_submitted", ...sheet },
      events: extra.events ?? [KILL_A1, RAISED_TD],
      homePlayers: extra.homePlayers,
    });
    mockRecordOffline.mockResolvedValue({ recorded: true, hateRolls: [] });
  }

  it("matérialise le relevé au poste choisi, à 0 po, avec ses PSP et le nom du mort — sans débit même si un montant a été saisi", async () => {
    mockValidation({
      raisedDeadHome: RAISE_ZOMBIE,
      purchasesHome: [
        { ...HIRE, cost: 40_000 },
        { kind: "reroll", name: "Relance", cost: 140_000 },
      ],
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({
      kind: "raised_dead",
      cost: 0,
      position: ZOMBIE,
      name: "Humain 1",
      spp: 3,
      advancements: "[]",
    });
    expect(offline.purchasesHome[0].skills.split(",")).toContain(
      "regeneration",
    );
    expect(offline.purchasesHome[0].skills).not.toMatch(/loner/);
    // Relance 140k seule : le montant saisi pour le relevé est ignoré.
    expect(offline.treasuryDebitHome).toBe(140_000);
    expect(offline.treasuryDebitAway).toBe(0);
    // Le mort adverse reste bien persisté comme mort.
    expect(offline.injuries).toEqual([{ teamPlayerId: "a1", type: "dead" }]);
  });

  it("prend l'évolution de l'étape 3 (tirage « Hasard » servi par la feuille) : toujours gratuit, entrée tracée appliquée", async () => {
    mockValidation({ raisedDeadHome: RAISE_ZOMBIE });
    const roll = await rollJourneymanRandomPrimary({
      pairingId: "pair-1",
      userId: HOME,
      journeymanId: RAISED,
      category: "G",
    });
    const staged = {
      playerId: RAISED,
      type: "random-primary",
      category: "G",
      skillSlug: roll.candidates[0],
    };
    mockValidation({
      raisedDeadHome: RAISE_ZOMBIE,
      purchasesHome: [HIRE],
      advancementsHome: [staged],
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({
      kind: "raised_dead",
      cost: 0,
      // 3 PSP du TD − 3 PSP du 1er palier « Hasard ».
      spp: 0,
    });
    expect(offline.purchasesHome[0].skills.split(",")).toContain(
      roll.candidates[0],
    );
    expect(JSON.parse(offline.purchasesHome[0].advancements)).toEqual([
      {
        skillSlug: roll.candidates[0],
        type: "random-primary",
        isRandom: true,
        at: 0,
      },
    ]);
    expect(offline.treasuryDebitHome).toBe(0);
    const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
    expect(data.advancementsHome).toEqual([
      { ...staged, applied: true, cost: 3 },
    ]);
  });

  it("relevé non recruté : son évolution est tracée « journeyman-not-hired », comme un journalier", async () => {
    const staged = { playerId: RAISED, type: "primary", skillSlug: "block" };
    mockValidation({
      raisedDeadHome: RAISE_ZOMBIE,
      advancementsHome: [staged],
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
    expect(data.advancementsHome).toEqual([
      { ...staged, applied: false, skipReason: "journeyman-not-hired" },
    ]);
  });

  it("sans relevé, un achat `raised_dead` retombe en dépense diverse à 0 : rien de créé, rien de débité", async () => {
    mockValidation({ purchasesHome: [{ ...HIRE, cost: 40_000 }] });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({ kind: "other", cost: 0 });
    expect(offline.treasuryDebitHome).toBe(0);
  });

  it("un seul recrutement : le doublon retombe en dépense diverse", async () => {
    mockValidation({
      raisedDeadHome: RAISE_ZOMBIE,
      purchasesHome: [HIRE, HIRE],
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome.map((p: { kind: string }) => p.kind)).toEqual([
      "raised_dead",
      "other",
    ]);
  });

  it("« sinon, il est perdu » : liste déjà à 16, le relevé n'est pas embauché", async () => {
    mockValidation(
      { raisedDeadHome: RAISE_ZOMBIE, purchasesHome: [HIRE] },
      { homePlayers: undeadPlayers(16) },
    );

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({ kind: "other", cost: 0 });
  });

  it("le relevé tué à son tour n'a plus rien à rejoindre", async () => {
    mockValidation(
      { raisedDeadHome: RAISE_ZOMBIE, purchasesHome: [HIRE] },
      {
        events: [
          KILL_A1,
          {
            id: "ev-kill-raised",
            kind: "casualty",
            team: "away",
            actorPlayerId: "a2",
            targetPlayerId: RAISED,
            injurySeverity: "dead",
          },
        ],
      },
    );

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({ kind: "other", cost: 0 });
    // Sa « mort » ne part pas en persistance : il n'a pas de ligne TeamPlayer.
    expect(offline.injuries).toEqual([{ teamPlayerId: "a1", type: "dead" }]);
  });

  it("les PSP du relevé ne partent jamais en persistance directe (pas de ligne TeamPlayer)", async () => {
    mockValidation({
      raisedDeadHome: RAISE_ZOMBIE,
      motmPlayerIds: [RAISED],
      sppBonus: [{ playerId: RAISED, spp: 2 }],
    });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(
      offline.playerStats.some(
        (p: { teamPlayerId: string }) => p.teamPlayerId === RAISED,
      ),
    ).toBe(false);
    expect(offline.sppBonus).toEqual([]);
  });
});

// ─────────────────────── Trait Contagieux (Nurgle) ───────────────────────
//
// Seconde source de joueur relevé : les Nurgle n'ont PAS Maîtres de la
// Non-vie (règles spéciales : Bagarreurs Brutaux, Favori de), mais chacun de
// leurs joueurs porte le Trait Contagieux. Un adversaire tué sur un BLOCAGE
// d'un porteur du Trait rejoint la réserve en Trois-Quart Putrescent, et
// s'embauche AU PRIX du poste, comme un journalier.

const ROTTER = "nurgle_trois_quart_putrescent";

function nurglePlayers(
  count: number,
  overrides: Record<string, Partial<PlayerRow>> = {},
): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => {
    const id = `h${i + 1}`;
    return {
      id,
      number: i + 1,
      name: `Pourri ${i + 1}`,
      position: ROTTER,
      dead: false,
      missNextMatch: false,
      spp: 0,
      skills: "contagieux,decay",
      advancements: "[]",
      ma: 5,
      st: 3,
      ag: 4,
      pa: 6,
      av: 9,
      ...overrides[id],
    };
  });
}

function mockNurgle(input: Parameters<typeof mockMatch>[0] = {}) {
  mockMatch({ homeRoster: "nurgle", homePlayers: nurglePlayers(12), ...input });
}

const INFECT_A1 = { victimId: "a1", position: null };

describe("getMatchSheet — Trait Contagieux (Nurgle)", () => {
  it("expose la source `plague_ridden` et l'adversaire tué sur un blocage d'un porteur du Trait", async () => {
    mockNurgle();
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead).toEqual({
      sources: ["plague_ridden"],
      victims: [
        {
          id: "a1",
          number: 1,
          name: "Humain 1",
          positionName: expect.any(String),
          source: "plague_ridden",
        },
      ],
      positions: [{ slug: ROTTER, name: "Trois-Quart Putrescent" }],
      choice: null,
      canHire: true,
    });
    expect(out.teams.home?.raisedDead).toBeNull();
    expect(out.teams.away?.raiseDead).toBeUndefined();
  });

  it("une agression qui tue ne contamine pas (seule une Élimination sur Blocage compte)", async () => {
    mockNurgle({ events: [{ ...KILL_A1, kind: "aggression" }] });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.sources).toEqual(["plague_ridden"]);
    expect(out.teams.home?.raiseDead?.victims).toEqual([]);
  });

  it("un blocage d'un joueur SANS le Trait ne contamine pas", async () => {
    // Le Pourri n°1 a perdu son Trait (fiche éditée) ; les autres le gardent.
    mockNurgle({ homePlayers: nurglePlayers(12, { h1: { skills: "decay" } }) });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.sources).toEqual(["plague_ridden"]);
    expect(out.teams.home?.raiseDead?.victims).toEqual([]);
  });

  it("écarte une victime ayant Décomposition, Régénération ou Minus — mais pas une Force 5", async () => {
    mockNurgle({
      events: [
        KILL_A1,
        { ...KILL_A1, id: "ev-2", targetPlayerId: "a2" },
        { ...KILL_A1, id: "ev-3", targetPlayerId: "a3" },
        { ...KILL_A1, id: "ev-4", targetPlayerId: "a4" },
      ],
      awayPlayers: humanPlayers(11, {
        a1: { skills: "regeneration" },
        a2: { skills: "decay" },
        a3: { skills: "dodge,stunty" },
        a4: { st: 5 },
      }),
    });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raiseDead?.victims.map((v) => v.id)).toEqual(["a4"]);
  });

  it("dérive le Contaminé : Trois-Quart Putrescent au numéro suivant, nom du mort, embauche au prix du poste", async () => {
    mockNurgle({ sheet: { raisedDeadHome: INFECT_A1 } });
    const out = await getMatchSheet({ pairingId: "pair-1", userId: HOME });
    expect(out.teams.home?.raisedDead).toMatchObject({
      id: RAISED,
      number: 13,
      name: "Humain 1",
      position: ROTTER,
      positionName: "Contaminé (Trois-Quart Putrescent)",
      cost: 40_000,
      victimId: "a1",
      source: "plague_ridden",
      hireCost: 40_000,
    });
    const skills = out.teams.home!.raisedDead!.skills.split(",");
    expect(skills).toContain("contagieux");
    expect(skills).toContain("decay");
    expect(skills.some((sk) => sk.startsWith("loner"))).toBe(false);
  });
});

describe("updateRaisedDead — Trait Contagieux", () => {
  it("le coach nurgle contamine un adversaire tué sur un blocage", async () => {
    mockNurgle();
    await updateRaisedDead({
      pairingId: "pair-1",
      userId: HOME,
      side: "home",
      victimId: "a1",
    });
    expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalledWith({
      where: { id: "ms1" },
      data: { raisedDeadHome: INFECT_A1 },
    });
  });

  it("refuse une victime tuée par agression (raise_dead_invalid_victim)", async () => {
    mockNurgle({ events: [{ ...KILL_A1, kind: "aggression" }] });
    await expect(
      updateRaisedDead({
        pairingId: "pair-1",
        userId: HOME,
        side: "home",
        victimId: "a1",
      }),
    ).rejects.toMatchObject({ code: "raise_dead_invalid_victim" });
  });
});

describe("validateByCommissioner — recrutement AU PRIX DU POSTE du Contaminé", () => {
  it("matérialise le Contaminé au prix du poste (débité même si le coach a saisi 0), avec ses PSP", async () => {
    mockNurgle({
      sheet: {
        status: "both_submitted",
        raisedDeadHome: INFECT_A1,
        purchasesHome: [{ kind: "raised_dead", name: "", cost: 0 }],
      },
      events: [
        KILL_A1,
        { id: "ev-td", kind: "touchdown", team: "home", actorPlayerId: RAISED },
      ],
    });
    mockRecordOffline.mockResolvedValue({ recorded: true, hateRolls: [] });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({
      kind: "raised_dead",
      cost: 40_000,
      position: ROTTER,
      name: "Humain 1",
      spp: 3,
      advancements: "[]",
    });
    expect(offline.purchasesHome[0].skills.split(",")).toContain("contagieux");
    expect(offline.purchasesHome[0].skills).not.toMatch(/loner/);
    // « De la même manière que les Joueurs Journaliers » : le poste se paie.
    expect(offline.treasuryDebitHome).toBe(40_000);
    expect(offline.injuries).toEqual([{ teamPlayerId: "a1", type: "dead" }]);
  });

  it("liste déjà à 16 : le Contaminé est perdu, rien n'est débité", async () => {
    mockNurgle({
      sheet: {
        status: "both_submitted",
        raisedDeadHome: INFECT_A1,
        purchasesHome: [{ kind: "raised_dead", name: "", cost: 40_000 }],
      },
      homePlayers: nurglePlayers(16),
    });
    mockRecordOffline.mockResolvedValue({ recorded: true, hateRolls: [] });

    await validateByCommissioner({ pairingId: "pair-1", userId: COMMISH });

    const offline = mockRecordOffline.mock.calls[0][0];
    expect(offline.purchasesHome[0]).toMatchObject({ kind: "other", cost: 0 });
    expect(offline.treasuryDebitHome).toBe(0);
  });
});
