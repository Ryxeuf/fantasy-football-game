import { describe, it, expect } from "vitest";
import {
  NAF_WORLD_CUP_2027,
  NAF_WORLD_CUP_2027_V3,
  TOURNAMENT_RULESETS,
  TOURNAMENT_RULESET_SLUGS,
  getTournamentRosterRules,
  getTournamentRuleset,
  maxTwoSkillPlayersWithStars,
  tournamentStackingError,
  tournamentStarPlayerSppTax,
  validateTournamentSkillPlan,
  type TournamentSkillPick,
} from "./tournament-rulesets";
import { TEAM_ROSTERS_BY_RULESET } from "./positions";
import { STAR_PLAYERS } from "./star-players";

const def = NAF_WORLD_CUP_2027_V3;

/** `n` joueurs portant chacun 2 compétences primaires. */
function doubledPlayers(n: number): TournamentSkillPick[] {
  return Array.from({ length: n }, (_, i) => [
    { playerKey: `p#${i}`, type: "primary" },
    { playerKey: `p#${i}`, type: "primary" },
  ]).flat();
}

describe("NAF World Cup 2027 V3.0 — registre", () => {
  it("s'ajoute au registre sans remplacer le V2.1", () => {
    expect(TOURNAMENT_RULESET_SLUGS).toEqual([
      "naf_world_cup_2027",
      "naf_world_cup_2027_v3",
    ]);
    expect(TOURNAMENT_RULESETS[def.slug]).toBe(def);
    expect(getTournamentRuleset("naf_world_cup_2027_v3")?.version).toBe("V3.0");
    expect(getTournamentRuleset("naf_world_cup_2027")).toBe(NAF_WORLD_CUP_2027);
  });

  it("se distingue du V2.1 dans les listes (libellé court propre)", () => {
    expect(def.shortLabel).not.toBe(NAF_WORLD_CUP_2027.shortLabel);
  });

  it("résurrection, season_3, bb11, 11 joueurs réguliers avant un Star Player", () => {
    expect(def.resurrection).toBe(true);
    expect(def.edition).toBe("season_3");
    expect(def.format).toBe("bb11");
    expect(def.minRegularPlayersBeforeStars).toBe(11);
  });
});

describe("NAF World Cup 2027 V3.0 — tableau des tiers", () => {
  it("couvre exactement les rosters de l'édition season_3", () => {
    expect(Object.keys(def.rosterRules).sort()).toEqual(
      Object.keys(TEAM_ROSTERS_BY_RULESET[def.edition]).sort(),
    );
  });

  it("n'utilise que les 5 budgets d'or et 5 budgets SPP du pack", () => {
    const rules = Object.values(def.rosterRules);
    expect([...new Set(rules.map((r) => r.goldBudget))].sort()).toEqual([
      1100, 1140, 1160, 1180, 1200,
    ]);
    expect([...new Set(rules.map((r) => r.sppBudget))].sort()).toEqual([
      44, 52, 60, 66, 72,
    ]);
  });

  it.each([
    // 1 100 000 po
    ["amazon", 1100, 44],
    ["dark_elf", 1100, 44],
    ["high_elf", 1100, 44],
    ["old_world_alliance", 1100, 44],
    ["wood_elf", 1100, 44],
    ["human", 1100, 52],
    ["orc", 1100, 52],
    ["skaven", 1100, 52],
    ["undead", 1100, 52],
    ["underworld", 1100, 52],
    ["nurgle", 1100, 60],
    ["snotling", 1100, 66],
    // 1 140 000 po
    ["lizardmen", 1140, 44],
    ["elven_union", 1140, 52],
    ["tomb_kings", 1140, 60],
    ["chaos_chosen", 1140, 66],
    ["imperial_nobility", 1140, 66],
    // 1 160 000 po
    ["necromantic_horror", 1160, 52],
    ["slann", 1160, 52],
    ["bretonnian", 1160, 66],
    ["chaos_renegade", 1160, 72],
    // 1 180 000 po
    ["gnome", 1180, 60],
    ["black_orc", 1180, 72],
    ["goblin", 1180, 72],
    ["halfling", 1180, 72],
    // 1 200 000 po
    ["vampire", 1200, 52],
    ["norse", 1200, 60],
    ["chaos_dwarf", 1200, 66],
    ["khorne", 1200, 66],
    ["dwarf", 1200, 72],
    ["ogre", 1200, 72],
  ])("%s : %i kpo, %i SPP", (slug, gold, spp) => {
    const rules = getTournamentRosterRules(def, slug);
    expect(rules?.goldBudget).toBe(gold);
    expect(rules?.sppBudget).toBe(spp);
  });

  it("cumul et Star Players suivent la colonne de SPP", () => {
    for (const rules of Object.values(def.rosterRules)) {
      const upper = rules.sppBudget >= 60;
      expect(rules.skillStacking).toBe(upper ? "two_players" : "one_player");
      expect(rules.starPlayersAllowed).toBe(upper);
    }
  });

  it("16 rosters ont droit aux Star Players", () => {
    expect(
      Object.values(def.rosterRules).filter((r) => r.starPlayersAllowed),
    ).toHaveLength(16);
  });
});

describe("NAF World Cup 2027 V3.0 — Star Players", () => {
  it("bannit les 17 noms du pack (paires comptées en 2 slugs)", () => {
    expect([...def.bannedStarPlayers].sort()).toEqual(
      [
        "anqi_panqi",
        "boa_konssstriktr",
        "crumbleberry",
        "deeproot_strongbranch",
        "dribl",
        "drull",
        "estelle_la_veneaux",
        "glotl_stop",
        "grak",
        "griff_oberwald",
        "hakflem_skuttlespike",
        "hthark_the_unstoppable",
        "ivar_eriksson",
        "jordell_freshbreeze",
        "maple_highgrove",
        "morg_n_thorg",
        "ripper_bolgrot",
        "skitter_stab_stab",
        "skorg_snowpelt",
      ].sort(),
    );
  });

  it("les Star Players bannis existent dans le catalogue du moteur", () => {
    for (const slug of def.bannedStarPlayers) {
      expect(STAR_PLAYERS[slug], slug).toBeDefined();
    }
  });

  it("taxe par tranches 0-200 / 201-300 / 301+ (bornes incluses)", () => {
    expect(tournamentStarPlayerSppTax(def, 0)).toBe(0);
    expect(tournamentStarPlayerSppTax(def, 150)).toBe(18);
    expect(tournamentStarPlayerSppTax(def, 200)).toBe(18);
    expect(tournamentStarPlayerSppTax(def, 201)).toBe(24);
    expect(tournamentStarPlayerSppTax(def, 300)).toBe(24);
    expect(tournamentStarPlayerSppTax(def, 301)).toBe(32);
    expect(tournamentStarPlayerSppTax(def, 640)).toBe(32);
  });
});

describe("NAF World Cup 2027 V3.0 — chaque Star Player retire un cumul", () => {
  const twoStacks = getTournamentRosterRules(def, "ogre")!;
  const oneStack = getTournamentRosterRules(def, "orc")!;

  it("quota = cumuls du roster − Star Players, jamais négatif", () => {
    expect(maxTwoSkillPlayersWithStars(def, twoStacks, 0)).toBe(2);
    expect(maxTwoSkillPlayersWithStars(def, twoStacks, 1)).toBe(1);
    expect(maxTwoSkillPlayersWithStars(def, twoStacks, 2)).toBe(0);
    expect(maxTwoSkillPlayersWithStars(def, twoStacks, 3)).toBe(0);
    expect(maxTwoSkillPlayersWithStars(def, oneStack)).toBe(1);
  });

  it("le V2.1 n'est pas touché : ses Star Players ne retirent rien", () => {
    const rules = getTournamentRosterRules(NAF_WORLD_CUP_2027, "ogre")!;
    expect(maxTwoSkillPlayersWithStars(NAF_WORLD_CUP_2027, rules, 2)).toBe(2);
    expect(
      validateTournamentSkillPlan(
        NAF_WORLD_CUP_2027,
        rules,
        doubledPlayers(2),
        undefined,
        2,
      ).valid,
    ).toBe(true);
  });

  it("sans Star Player : 2 joueurs à 2 compétences acceptés, 3 refusés", () => {
    expect(validateTournamentSkillPlan(def, twoStacks, doubledPlayers(2)).valid).toBe(true);
    expect(validateTournamentSkillPlan(def, twoStacks, doubledPlayers(3)).valid).toBe(false);
  });

  it("avec 1 Star Player : un seul joueur à 2 compétences", () => {
    const ok = validateTournamentSkillPlan(def, twoStacks, doubledPlayers(1), undefined, 1);
    expect(ok).toEqual({ valid: true, totalSpp: 14 });
    const ko = validateTournamentSkillPlan(def, twoStacks, doubledPlayers(2), undefined, 1);
    expect(ko.valid).toBe(false);
    expect(ko.error).toContain("1 joueur maximum");
    expect(ko.error).toContain("Star Player");
  });

  it("avec 2 Star Players : plus aucun cumul, les compétences simples restent libres", () => {
    const ko = validateTournamentSkillPlan(def, twoStacks, doubledPlayers(1), undefined, 2);
    expect(ko.valid).toBe(false);
    expect(ko.error).toContain("Star Player");
    const singles: TournamentSkillPick[] = [
      { playerKey: "a", type: "primary" },
      { playerKey: "b", type: "secondary" },
    ];
    expect(
      validateTournamentSkillPlan(def, twoStacks, singles, undefined, 2),
    ).toEqual({ valid: true, totalSpp: 16 });
  });

  it("le message ne cite les Star Players que s'ils ont réduit le quota", () => {
    expect(tournamentStackingError(def, oneStack, 0)).toBe(
      "Ce roster ne peut cumuler 2 compétences que sur 1 joueur maximum",
    );
    expect(tournamentStackingError(def, twoStacks, 2)).toContain(
      "chaque Star Player recruté retire un cumul",
    );
  });
});

describe("NAF World Cup 2027 V3.0 — coups de pouce et barèmes", () => {
  it("barème de compétences 6 / 10 / 8 / 12, +2 Elite sans liste propre", () => {
    expect(def.skillCosts).toEqual({
      firstPrimary: 6,
      firstSecondary: 10,
      secondPrimary: 8,
      secondSecondary: 12,
      eliteSurcharge: 2,
    });
    expect(def.eliteSkills).toEqual([]);
  });

  it("liste fermée de cinq coups de pouce, aux prix du pack", () => {
    const bySlug = new Map(def.allowedInducements.map((r) => [r.slug, r]));
    expect([...bySlug.keys()].sort()).toEqual([
      "bloodweiser_kegs",
      "bribe",
      "halfling_master_chef",
      "riotous_rookies",
      "team_mascot",
    ]);
    expect(bySlug.get("bloodweiser_kegs")).toMatchObject({ cost: 50_000, max: 2 });
    expect(bySlug.get("bribe")).toMatchObject({
      cost: 100_000,
      discountCost: 50_000,
      maxWithSecretWeaponStar: 2,
    });
    expect(bySlug.get("riotous_rookies")?.cost).toBe(150_000);
    expect(bySlug.get("halfling_master_chef")).toMatchObject({
      cost: 300_000,
      discountCost: 100_000,
    });
  });

  it("scoring individuel V 5 / N 2 / D 0 / concession -5", () => {
    expect(def.scoring).toEqual({ win: 5, draw: 2, loss: 0, concession: -5 });
  });
});
