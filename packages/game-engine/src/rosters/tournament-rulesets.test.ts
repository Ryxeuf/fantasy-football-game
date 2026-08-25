import { describe, it, expect } from "vitest";
import {
  NAF_WORLD_CUP_2027,
  TOURNAMENT_RULESETS,
  TOURNAMENT_RULESET_SLUGS,
  isTournamentRulesetSlug,
  getTournamentRuleset,
  getTournamentRosterRules,
  maxTwoSkillPlayers,
  resolveTournamentEliteSkills,
  tournamentStarPlayerSppTax,
  tournamentSkillCost,
  validateTournamentSkillPlan,
  type TournamentSkillPick,
} from "./tournament-rulesets";
import { TEAM_ROSTERS_BY_RULESET } from "./positions";
import { STAR_PLAYERS } from "./star-players";

describe("registre des règlements de tournoi", () => {
  it("expose le NAF World Cup 2027 dans le registre", () => {
    expect(TOURNAMENT_RULESET_SLUGS).toContain("naf_world_cup_2027");
    expect(TOURNAMENT_RULESETS["naf_world_cup_2027"]).toBe(NAF_WORLD_CUP_2027);
  });

  it("isTournamentRulesetSlug reconnaît les slugs valides seulement", () => {
    expect(isTournamentRulesetSlug("naf_world_cup_2027")).toBe(true);
    expect(isTournamentRulesetSlug("season_3")).toBe(false);
    expect(isTournamentRulesetSlug("")).toBe(false);
    expect(isTournamentRulesetSlug(null)).toBe(false);
    expect(isTournamentRulesetSlug(42)).toBe(false);
  });

  it("getTournamentRuleset renvoie la définition ou null", () => {
    expect(getTournamentRuleset("naf_world_cup_2027")?.version).toBe("V2.1");
    expect(getTournamentRuleset("inconnu")).toBeNull();
    expect(getTournamentRuleset(null)).toBeNull();
    expect(getTournamentRuleset(undefined)).toBeNull();
  });
});

describe("NAF World Cup 2027 — tableau des tiers", () => {
  const def = NAF_WORLD_CUP_2027;

  it("couvre exactement les 31 rosters de l'édition season_3", () => {
    const season3Slugs = Object.keys(
      TEAM_ROSTERS_BY_RULESET[def.edition],
    ).sort();
    expect(Object.keys(def.rosterRules).sort()).toEqual(season3Slugs);
  });

  it("n'utilise que les 6 budgets d'or et 5 budgets SPP du pack", () => {
    const golds = new Set(
      Object.values(def.rosterRules).map((r) => r.goldBudget),
    );
    const spps = new Set(Object.values(def.rosterRules).map((r) => r.sppBudget));
    expect([...golds].sort((a, b) => a - b)).toEqual([
      1080, 1100, 1140, 1160, 1180, 1200,
    ]);
    expect([...spps].sort((a, b) => a - b)).toEqual([44, 52, 58, 60, 66]);
  });

  it("transcrit fidèlement quelques lignes de référence du tableau", () => {
    expect(def.rosterRules.orc).toEqual({
      goldBudget: 1080,
      sppBudget: 44,
      skillStacking: "none",
      starPlayersAllowed: false,
    });
    expect(def.rosterRules.snotling).toEqual({
      goldBudget: 1080,
      sppBudget: 60,
      skillStacking: "none",
      starPlayersAllowed: true,
    });
    expect(def.rosterRules.ogre).toEqual({
      goldBudget: 1180,
      sppBudget: 66,
      skillStacking: "two_players",
      starPlayersAllowed: true,
    });
    expect(def.rosterRules.vampire).toEqual({
      goldBudget: 1200,
      sppBudget: 44,
      skillStacking: "none",
      starPlayersAllowed: false,
    });
  });

  it("autorise les Star Players aux 9 rosters marqués d'une étoile", () => {
    const starTeams = Object.entries(def.rosterRules)
      .filter(([, r]) => r.starPlayersAllowed)
      .map(([slug]) => slug)
      .sort();
    expect(starTeams).toEqual([
      "black_orc",
      "bretonnian",
      "chaos_renegade",
      "gnome",
      "goblin",
      "halfling",
      "norse",
      "ogre",
      "snotling",
    ]);
  });

  it("les Star Players bannis existent dans le catalogue du moteur", () => {
    for (const slug of def.bannedStarPlayers) {
      expect(STAR_PLAYERS[slug], `star banni inconnu: ${slug}`).toBeDefined();
    }
  });

  it("getTournamentRosterRules renvoie null pour un roster hors pack", () => {
    expect(getTournamentRosterRules(def, "skaven")).not.toBeNull();
    expect(getTournamentRosterRules(def, "roster_inconnu")).toBeNull();
  });
});

describe("taxe SPP sur les Star Players", () => {
  const def = NAF_WORLD_CUP_2027;

  it("0 SPP sans Star Player", () => {
    expect(tournamentStarPlayerSppTax(def, 0)).toBe(0);
    expect(tournamentStarPlayerSppTax(def, -10)).toBe(0);
  });

  it("applique la tranche par coût cumulé (kpo)", () => {
    expect(tournamentStarPlayerSppTax(def, 1)).toBe(18);
    expect(tournamentStarPlayerSppTax(def, 199)).toBe(18);
    expect(tournamentStarPlayerSppTax(def, 200)).toBe(24);
    expect(tournamentStarPlayerSppTax(def, 299)).toBe(24);
    expect(tournamentStarPlayerSppTax(def, 300)).toBe(32);
    expect(tournamentStarPlayerSppTax(def, 1000)).toBe(32);
  });
});

/** Compétences Elite de la Saison 3 (référentiel `Skill.isElite`). */
const EDITION_ELITE = ["block", "dodge", "mighty-blow-1", "guard"];

describe("barème d'achat de compétences", () => {
  const def = NAF_WORLD_CUP_2027;

  it("1re compétence : 6 SPP primaire, 10 SPP secondaire", () => {
    expect(tournamentSkillCost(def, 0, "primary")).toBe(6);
    expect(tournamentSkillCost(def, 0, "secondary")).toBe(10);
  });

  it("2e compétence : 8 SPP primaire, 12 SPP secondaire", () => {
    expect(tournamentSkillCost(def, 1, "primary")).toBe(8);
    expect(tournamentSkillCost(def, 1, "secondary")).toBe(12);
  });

  it("surcoût Elite appliqué seulement aux compétences listées", () => {
    const withElite = {
      ...def,
      eliteSkills: ["dodge"],
    };
    expect(tournamentSkillCost(withElite, 0, "primary", "dodge")).toBe(8);
    expect(tournamentSkillCost(withElite, 0, "primary", "block")).toBe(6);
    // Sans liste publiée ET sans référentiel fourni : aucun surcoût.
    expect(tournamentSkillCost(def, 0, "primary", "dodge")).toBe(6);
  });

  it("surcoût Elite facturé depuis le référentiel quand le pack ne publie pas de liste", () => {
    // Le pack facture 2 PSP par compétence Elite sans republier lesquelles :
    // ce sont celles de l'édition (Skill.isElite).
    const elite = resolveTournamentEliteSkills(def, EDITION_ELITE);
    expect(tournamentSkillCost(def, 0, "primary", "dodge", elite)).toBe(8);
    expect(tournamentSkillCost(def, 1, "secondary", "block", elite)).toBe(14);
    expect(tournamentSkillCost(def, 0, "primary", "tackle", elite)).toBe(6);
  });
});

describe("resolveTournamentEliteSkills", () => {
  const def = NAF_WORLD_CUP_2027;

  it("retient la liste du règlement quand il en publie une", () => {
    const withElite = { ...def, eliteSkills: ["dodge"] };
    const resolved = resolveTournamentEliteSkills(withElite, EDITION_ELITE);
    expect([...resolved]).toEqual(["dodge"]);
  });

  it("retombe sur les compétences Elite de l'édition sinon", () => {
    const resolved = resolveTournamentEliteSkills(def, EDITION_ELITE);
    expect(resolved.has("block")).toBe(true);
    expect(resolved.has("guard")).toBe(true);
    expect(resolved.has("tackle")).toBe(false);
  });

  it("sans référentiel, aucune compétence n'est Elite", () => {
    expect(resolveTournamentEliteSkills(def).size).toBe(0);
  });
});

describe("validateTournamentSkillPlan", () => {
  const def = NAF_WORLD_CUP_2027;
  const noStack = def.rosterRules.orc; // stacking: none
  const oneStack = def.rosterRules.undead; // stacking: one_player
  const twoStack = def.rosterRules.ogre; // stacking: two_players

  const pick = (
    playerKey: string,
    type: string,
    skillSlug?: string,
  ): TournamentSkillPick => ({ playerKey, type, skillSlug });

  it("plan vide valide, coût 0", () => {
    expect(validateTournamentSkillPlan(def, noStack, [])).toEqual({
      valid: true,
      totalSpp: 0,
    });
  });

  it("additionne 1re/2e compétence par joueur (primaire/secondaire)", () => {
    const res = validateTournamentSkillPlan(def, oneStack, [
      pick("a", "primary"), // 6
      pick("a", "secondary"), // 12 (2e compétence, secondaire)
      pick("b", "secondary"), // 10
    ]);
    expect(res.valid).toBe(true);
    expect(res.totalSpp).toBe(28);
  });

  it("refuse les améliorations aléatoires et de caractéristique", () => {
    for (const type of ["random-primary", "characteristic"]) {
      const res = validateTournamentSkillPlan(def, noStack, [pick("a", type)]);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/compétences au choix/);
    }
  });

  it("refuse une 3e compétence sur un même joueur", () => {
    const res = validateTournamentSkillPlan(def, twoStack, [
      pick("a", "primary"),
      pick("a", "primary"),
      pick("a", "primary"),
    ]);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/plus de 2 compétences/);
  });

  it("stacking none : aucun joueur ne peut cumuler 2 compétences", () => {
    const res = validateTournamentSkillPlan(def, noStack, [
      pick("a", "primary"),
      pick("a", "primary"),
    ]);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/ne peut pas cumuler/);
  });

  it("stacking one_player : 1 joueur à 2 compétences OK, 2 joueurs KO", () => {
    const ok = validateTournamentSkillPlan(def, oneStack, [
      pick("a", "primary"),
      pick("a", "primary"),
      pick("b", "primary"),
    ]);
    expect(ok.valid).toBe(true);
    expect(ok.totalSpp).toBe(6 + 8 + 6);

    const ko = validateTournamentSkillPlan(def, oneStack, [
      pick("a", "primary"),
      pick("a", "primary"),
      pick("b", "primary"),
      pick("b", "primary"),
    ]);
    expect(ko.valid).toBe(false);
    expect(ko.error).toMatch(/1 joueur/);
  });

  it("stacking two_players : 2 joueurs à 2 compétences OK, 3 KO", () => {
    const ok = validateTournamentSkillPlan(def, twoStack, [
      pick("a", "primary"),
      pick("a", "secondary"),
      pick("b", "primary"),
      pick("b", "primary"),
    ]);
    expect(ok.valid).toBe(true);

    const ko = validateTournamentSkillPlan(def, twoStack, [
      pick("a", "primary"),
      pick("a", "primary"),
      pick("b", "primary"),
      pick("b", "primary"),
      pick("c", "primary"),
      pick("c", "primary"),
    ]);
    expect(ko.valid).toBe(false);
    expect(ko.error).toMatch(/2 joueurs maximum/);
  });

  it("exemple complet : budget SPP d'un tier dépensable exactement", () => {
    // Orc, 44 SPP : 4 primaires (4×6) + 2 secondaires (2×10) = 44, sans cumul.
    const res = validateTournamentSkillPlan(def, noStack, [
      pick("a", "primary"),
      pick("b", "primary"),
      pick("c", "primary"),
      pick("d", "primary"),
      pick("e", "secondary"),
      pick("f", "secondary"),
    ]);
    expect(res.valid).toBe(true);
    expect(res.totalSpp).toBe(44);
  });
});

describe("maxTwoSkillPlayers", () => {
  it("mappe le cumul vers un quota", () => {
    expect(maxTwoSkillPlayers("none")).toBe(0);
    expect(maxTwoSkillPlayers("one_player")).toBe(1);
    expect(maxTwoSkillPlayers("two_players")).toBe(2);
  });
});

describe("cohérence générale du pack", () => {
  const def = NAF_WORLD_CUP_2027;

  it("édition season_3 et format bb11", () => {
    expect(def.edition).toBe("season_3");
    expect(def.format).toBe("bb11");
    expect(def.resurrection).toBe(true);
    expect(def.minRegularPlayersBeforeStars).toBe(11);
  });

  it("scoring individuel du pack (V 5 / N 2 / D 0 / concession -5)", () => {
    expect(def.scoring).toEqual({ win: 5, draw: 2, loss: 0, concession: -5 });
  });

  it("les inducements autorisés forment une liste fermée attendue", () => {
    expect(def.allowedInducements.map((i) => i.slug).sort()).toEqual([
      "bloodweiser_kegs",
      "bribe",
      "halfling_master_chef",
      "riotous_rookies",
      "team_mascot",
    ]);
  });
});
