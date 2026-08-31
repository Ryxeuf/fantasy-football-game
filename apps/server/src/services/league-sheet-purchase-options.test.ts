import { describe, it, expect } from "vitest";
import {
  buildPurchaseOptions,
  countByPosition,
  EMPTY_PURCHASE_OPTIONS,
  type PurchaseSourcePosition,
  type PurchaseStaffConfig,
  type PurchaseTeamState,
} from "./league-sheet-purchase-options";

const POSITIONS: readonly PurchaseSourcePosition[] = [
  { slug: "lineman", displayName: "Trois-quart", cost: 50, max: 16 },
  { slug: "blitzer", displayName: "Blitzeur", cost: 105, max: 2 },
  { slug: "thrower", displayName: "Lanceur", cost: 75, max: 1 },
];

// Haut Elfes : relance à 50 000 po à la construction (E46 de la feuille de
// suivi cite justement ce cas — elle coûte 100 000 po après le match).
const STAFF: PurchaseStaffConfig = {
  rerollCost: 50000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50000,
  maxCheerleaders: 12,
  cheerleaderCost: 10000,
  maxAssistants: 6,
  assistantCost: 10000,
  maxDedicatedFans: 6,
  dedicatedFanCost: 10000,
};

const TEAM: PurchaseTeamState = {
  countsByPosition: { lineman: 6, blitzer: 1 },
  playerCount: 7,
  maxPlayers: 16,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
};

function build(overrides: Partial<PurchaseTeamState> = {}) {
  return buildPurchaseOptions({
    positions: POSITIONS,
    staff: STAFF,
    team: { ...TEAM, ...overrides },
  });
}

describe("buildPurchaseOptions — postes (E47)", () => {
  it("propose TOUS les postes du roster, pas seulement ceux déjà présents", () => {
    // Le picker dérivait les postes de l'effectif : un Lanceur jamais
    // recruté n'était donc jamais proposé à l'embauche.
    const slugs = build().positions.map((p) => p.slug);
    expect(slugs).toEqual(["lineman", "blitzer", "thrower"]);
  });

  it("convertit le coût du catalogue (kpo) en po", () => {
    const blitzer = build().positions.find((p) => p.slug === "blitzer");
    expect(blitzer?.cost).toBe(105000);
  });

  it("remonte le quota consommé de chaque poste", () => {
    const blitzer = build().positions.find((p) => p.slug === "blitzer");
    expect(blitzer).toMatchObject({ currentCount: 1, maxCount: 2 });
  });

  it("refuse un poste dont le quota du roster est atteint", () => {
    const opts = build({ countsByPosition: { blitzer: 2 }, playerCount: 2 });
    expect(opts.positions.find((p) => p.slug === "blitzer")?.canAdd).toBe(
      false,
    );
    expect(opts.positions.find((p) => p.slug === "lineman")?.canAdd).toBe(true);
  });

  it("refuse TOUS les postes quand l'effectif du format est plein", () => {
    const opts = build({ playerCount: 16 });
    expect(opts.positions.every((p) => !p.canAdd)).toBe(true);
  });

  it("applique le plafond du format, pas un 16 codé en dur (Sevens)", () => {
    const opts = build({ playerCount: 11, maxPlayers: 11 });
    expect(opts.positions.every((p) => !p.canAdd)).toBe(true);
  });
});

describe("buildPurchaseOptions — staff (E46)", () => {
  it("double le prix d'une relance achetée après le match", () => {
    const reroll = build().staff.find((s) => s.kind === "reroll");
    expect(reroll?.cost).toBe(100000);
  });

  it("ne double PAS les autres éléments de staff", () => {
    const staff = build().staff;
    expect(staff.find((s) => s.kind === "assistant")?.cost).toBe(10000);
    expect(staff.find((s) => s.kind === "apothecary")?.cost).toBe(50000);
  });

  it("refuse une relance au-delà du plafond du roster", () => {
    expect(
      build({ rerolls: 8 }).staff.find((s) => s.kind === "reroll"),
    ).toMatchObject({ canAdd: false, currentCount: 8, maxCount: 8 });
  });

  it("refuse l'apothicaire aux rosters qui n'y ont pas droit", () => {
    const opts = buildPurchaseOptions({
      positions: POSITIONS,
      staff: { ...STAFF, apothecaryAllowed: false },
      team: TEAM,
    });
    const apo = opts.staff.find((s) => s.kind === "apothecary");
    expect(apo).toMatchObject({ canAdd: false, maxCount: 0 });
  });

  it("refuse un second apothicaire", () => {
    const apo = build({ apothecary: true }).staff.find(
      (s) => s.kind === "apothecary",
    );
    expect(apo).toMatchObject({ canAdd: false, currentCount: 1 });
  });

  it("expose les cinq postes de dépense de staff", () => {
    expect(build().staff.map((s) => s.kind)).toEqual([
      "reroll",
      "assistant",
      "cheerleader",
      "apothecary",
      "dedicated_fan",
    ]);
  });
});

describe("countByPosition", () => {
  it("compte les joueurs par slug de poste", () => {
    expect(
      countByPosition([
        { position: "lineman" },
        { position: "lineman" },
        { position: "blitzer" },
      ]),
    ).toEqual({ lineman: 2, blitzer: 1 });
  });

  it("rend un objet vide sans joueur", () => {
    expect(countByPosition([])).toEqual({});
  });
});

describe("EMPTY_PURCHASE_OPTIONS", () => {
  it("est le repli quand le catalogue du roster est introuvable", () => {
    expect(EMPTY_PURCHASE_OPTIONS).toEqual({ positions: [], staff: [] });
  });
});
