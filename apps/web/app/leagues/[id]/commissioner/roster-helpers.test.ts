/**
 * Helpers purs de l'éditeur commissaire.
 */

import { describe, it, expect } from "vitest";
import {
  accessibleSkills,
  charValueOf,
  filterPlayers,
  formatGold,
  formatGoldDelta,
  parseAccessCodes,
  skillsOf,
  staffCostDelta,
} from "./roster-helpers";
import type { EditPlayer, StaffConfig, TeamStaff } from "./types";

function player(overrides: Partial<EditPlayer> = {}): EditPlayer {
  return {
    id: "p1",
    name: "Griff Oberwald",
    position: "human_blitzer",
    number: 7,
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "block, dodge",
    spp: 12,
    dead: false,
    ...overrides,
  };
}

describe("parseAccessCodes", () => {
  it("accepte le CSV et le format compact, avec l'alias F→S", () => {
    expect([...parseAccessCodes("G,S")]).toEqual(["G", "S"]);
    expect([...parseAccessCodes("GA")]).toEqual(["G", "A"]);
    expect([...parseAccessCodes("f")]).toEqual(["S"]);
  });

  it("ignore les codes inconnus et l'absence de valeur", () => {
    expect([...parseAccessCodes("GZ")]).toEqual(["G"]);
    expect([...parseAccessCodes(null)]).toEqual([]);
  });
});

describe("skillsOf / charValueOf", () => {
  it("découpe le CSV de compétences en ignorant les vides", () => {
    expect(skillsOf(player({ skills: "block, , dodge" }))).toEqual([
      "block",
      "dodge",
    ]);
    expect(skillsOf(player({ skills: "" }))).toEqual([]);
  });

  it("rend la valeur courante d'une caractéristique, PA incluse", () => {
    expect(charValueOf(player(), "MA")).toBe(7);
    expect(charValueOf(player({ pa: null }), "PA")).toBeNull();
  });
});

describe("accessibleSkills", () => {
  const catalog = [
    { slug: "guard", nameFr: "Garde", category: "Strength" },
    { slug: "dodge", nameFr: "Esquive", category: "Agility" },
    { slug: "block", nameFr: "Blocage", category: "General" },
    { slug: "claw", nameFr: "Griffe", category: "Mutation" },
  ];
  const access = {
    primarySkills: "G,S",
    secondarySkills: "A",
    innateSkills: ["block"],
  };

  it("limite au pool primaire + secondaire du poste", () => {
    const out = accessibleSkills(catalog, access, []);
    expect(out.map((o) => o.slug)).toEqual(["block", "guard", "dodge"]);
    expect(out.find((o) => o.slug === "dodge")?.primary).toBe(false);
  });

  it("retire les compétences déjà possédées", () => {
    const out = accessibleSkills(catalog, access, ["block"]);
    expect(out.map((o) => o.slug)).not.toContain("block");
  });

  it("rend une liste vide sans données d'accès", () => {
    expect(accessibleSkills(catalog, undefined, [])).toEqual([]);
  });
});

describe("filterPlayers", () => {
  const players = [
    player({ id: "a", name: "Griff", number: 7, dead: false }),
    player({ id: "b", name: "Féu Igor", number: 12, dead: true }),
  ];
  const label = (slug: string) => (slug === "human_blitzer" ? "Blitzer" : slug);

  it("filtre par statut", () => {
    expect(filterPlayers(players, "alive", "", label).map((p) => p.id)).toEqual([
      "a",
    ]);
    expect(filterPlayers(players, "dead", "", label).map((p) => p.id)).toEqual([
      "b",
    ]);
    expect(filterPlayers(players, "all", "", label)).toHaveLength(2);
  });

  it("cherche sur le nom sans tenir compte des accents ni de la casse", () => {
    expect(filterPlayers(players, "all", "FEU", label).map((p) => p.id)).toEqual(
      ["b"],
    );
  });

  it("cherche aussi sur le numéro et le poste", () => {
    expect(filterPlayers(players, "all", "12", label).map((p) => p.id)).toEqual([
      "b",
    ]);
    expect(filterPlayers(players, "all", "blitzer", label)).toHaveLength(2);
  });
});

describe("staffCostDelta", () => {
  const config: StaffConfig = {
    rerollCost: 50_000,
    maxRerolls: 8,
    apothecaryAllowed: true,
    apothecaryCost: 50_000,
    maxCheerleaders: 12,
    cheerleaderCost: 10_000,
    maxAssistants: 6,
    assistantCost: 10_000,
    maxDedicatedFans: 6,
    dedicatedFanCost: 10_000,
  };
  const staff: TeamStaff = {
    rerolls: 2,
    cheerleaders: 1,
    assistants: 0,
    apothecary: false,
    dedicatedFans: 1,
  };

  it("additionne les achats", () => {
    expect(
      staffCostDelta(staff, { ...staff, rerolls: 3, apothecary: true }, config),
    ).toBe(100_000);
  });

  it("rend un montant négatif quand on retire du staff", () => {
    expect(staffCostDelta(staff, { ...staff, cheerleaders: 0 }, config)).toBe(
      -10_000,
    );
  });
});

describe("formatGold", () => {
  it("formate en po, séparateurs français", () => {
    expect(formatGold(50_000).replace(/ | /g, " ")).toBe("50 000 po");
  });

  it("préfixe les différentiels positifs d'un +", () => {
    expect(formatGoldDelta(10_000).startsWith("+")).toBe(true);
    expect(formatGoldDelta(-10_000).startsWith("-")).toBe(true);
  });
});
