/**
 * Règlements de tournoi (« rulesets » de tournoi / draft rules packs).
 *
 * Axe ORTHOGONAL au `ruleset` (édition season_2 / season_3) et au `format`
 * (bb11 / sevens) : un règlement de tournoi est un pack de règles officiel
 * (ex : NAF World Cup) choisi À LA CRÉATION d'une équipe. Il impose le budget
 * d'or, le pool de SPP d'améliorations, les restrictions de Star Players et
 * les limites de cumul de compétences. `null` = aucun règlement (règles
 * standard, comportement historique).
 *
 * Source unique de vérité : consommée par la validation serveur
 * (`/team/build`, inscriptions ligue/coupe) ET par l'UI du builder
 * (`apps/web/app/me/teams/new`). Convention monétaire : budgets en **kpo**
 * (comme `formats.ts`), coûts d'inducements en **po** (comme le catalogue
 * `core/inducements.ts`).
 */

import type { Ruleset } from "./positions";
import type { GameFormat } from "./formats";

/**
 * Cumul de compétences autorisé à la création :
 *  - `none`        : 1 compétence max par joueur.
 *  - `one_player`  : 1 seul joueur peut cumuler 2 compétences.
 *  - `two_players` : jusqu'à 2 joueurs peuvent cumuler 2 compétences.
 * (Personne ne peut dépasser 2 compétences achetées.)
 */
export type TournamentSkillStacking = "none" | "one_player" | "two_players";

/** Règles imposées par le règlement à UN roster (une ligne du tableau des tiers). */
export interface TournamentRosterRules {
  /** Budget d'or de création imposé, en kpo (ex : 1180 = 1 180 000 po). */
  readonly goldBudget: number;
  /** Pool de SPP à dépenser en compétences à la création. */
  readonly sppBudget: number;
  /** Cumul de compétences autorisé (cf. TournamentSkillStacking). */
  readonly skillStacking: TournamentSkillStacking;
  /** Le roster a-t-il le droit de recruter des Star Players ? */
  readonly starPlayersAllowed: boolean;
}

/** Barème d'achat de compétences (en SPP) du règlement. */
export interface TournamentSkillCosts {
  /** 1re compétence d'un joueur, primaire. */
  readonly firstPrimary: number;
  /** 1re compétence d'un joueur, secondaire. */
  readonly firstSecondary: number;
  /** 2e compétence d'un même joueur, primaire. */
  readonly secondPrimary: number;
  /** 2e compétence d'un même joueur, secondaire. */
  readonly secondSecondary: number;
  /** Surcoût par compétence « Elite » (s'ajoute au coût de base). */
  readonly eliteSurcharge: number;
}

/** Tranche de taxe SPP sur le coût cumulé des Star Players recrutés. */
export interface TournamentStarTaxBracket {
  /** Borne haute (incluse) du coût cumulé des Star Players, en kpo. */
  readonly maxTotalCostK: number;
  /** Taxe en SPP déduite du pool. */
  readonly spp: number;
}

/** Inducement autorisé par le règlement (référence le catalogue du moteur). */
export interface TournamentInducementRule {
  /** Slug du catalogue `core/inducements.ts`. */
  readonly slug: string;
  /** Coût imposé par le règlement, en po. */
  readonly cost: number;
  /** Quantité max (undefined = limite du catalogue). */
  readonly max?: number;
  /** Précision FR (coût réduit conditionnel, restriction de roster…). */
  readonly noteFr?: string;
}

/** Barème de points individuels du règlement (classements de tournoi). */
export interface TournamentScoring {
  readonly win: number;
  readonly draw: number;
  readonly loss: number;
  /** Concession (abandon) — enregistrée 3-0 TD et 3-0 sorties. */
  readonly concession: number;
}

export interface TournamentRulesetDefinition {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  /** Libellé court pour les badges (fiche roster, ligues, coupes). */
  readonly shortLabel: string;
  /** Version du pack de règles (ex : "V2.1"). */
  readonly version: string;
  /** Édition des règles requise (les équipes doivent être dans cette édition). */
  readonly edition: Ruleset;
  /** Format de jeu requis. */
  readonly format: GameFormat;
  readonly descriptionFr: string;
  /**
   * Tournoi « résurrection » : aucun SPP gagné en jeu, blessures/morts non
   * conservées d'un match à l'autre. Une coupe créée avec ce règlement active
   * son `resurrectionMode`.
   */
  readonly resurrection: boolean;
  /** Nombre minimum de joueurs réguliers avant de recruter des Star Players. */
  readonly minRegularPlayersBeforeStars: number;
  /** Règles par roster (slug → règles). Un roster absent est INTERDIT. */
  readonly rosterRules: Readonly<Record<string, TournamentRosterRules>>;
  readonly skillCosts: TournamentSkillCosts;
  /**
   * Compétences « Elite » (surcoût `skillCosts.eliteSurcharge`). Slugs du
   * catalogue de compétences. Le pack NAF WC 2027 V2.1 désigne des Elite
   * Skills sans en publier la liste dans les pages transcrites ici : liste
   * vide tant que la liste officielle n'est pas intégrée (aucun surcoût
   * appliqué d'ici là).
   */
  readonly eliteSkills: readonly string[];
  /** Star Players interdits (slugs du catalogue `star-players.ts`). */
  readonly bannedStarPlayers: readonly string[];
  /**
   * Taxe SPP par tranche de coût cumulé des Star Players recrutés (kpo).
   * Ne s'applique que si au moins un Star Player est recruté. La dernière
   * tranche (maxTotalCostK = Infinity) couvre tout le reste.
   */
  readonly starPlayerSppTax: readonly TournamentStarTaxBracket[];
  /**
   * Inducements achetables avec le budget d'or (liste FERMÉE : tout
   * inducement absent est interdit). Les cheerleaders, coachs assistants et
   * fans dévoués du pack sont les achats de staff standard du builder (mêmes
   * coûts que `FORMAT_CONSTRAINTS.bb11`) et ne figurent donc pas ici.
   */
  readonly allowedInducements: readonly TournamentInducementRule[];
  readonly scoring: TournamentScoring;
}

/**
 * NAF World Cup 2027 — draft ruleset officiel V2.1.
 *
 * Tableau des tiers (budget d'or × budget SPP) transcrit du Rules Pack p.2,
 * marqueurs de cumul/Star Players inclus. Tournoi résurrection joué en
 * escouades de 6 coachs (la logique d'escouade n'est pas modélisée ici :
 * seule la composition d'équipe l'est).
 */
export const NAF_WORLD_CUP_2027: TournamentRulesetDefinition = {
  slug: "naf_world_cup_2027",
  nameFr: "NAF World Cup 2027 (règlement officiel V2.1)",
  nameEn: "NAF World Cup 2027 (official rules pack V2.1)",
  shortLabel: "NAF World Cup 2027",
  version: "V2.1",
  edition: "season_3",
  format: "bb11",
  descriptionFr:
    "Tournoi résurrection : aucun SPP gagné en jeu, blessures et morts non " +
    "conservées entre les matchs. Budget d'or et budget de SPP fixés par le " +
    "tier du roster ; l'or et les SPP non dépensés à la création sont perdus. " +
    "Minimum 11 joueurs réguliers avant tout Star Player ; compétences au " +
    "choix uniquement (améliorations aléatoires et de caractéristique " +
    "interdites). Toutes les équipes sont considérées à la même VEA pour les " +
    "Prières à Nuffle. Joué en escouades de 6 coachs (un même roster ne peut " +
    "être pris que par un coach par escouade).",
  resurrection: true,
  minRegularPlayersBeforeStars: 11,
  rosterRules: {
    // ——— 1 080 000 po ———
    orc: { goldBudget: 1080, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    high_elf: { goldBudget: 1080, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    skaven: { goldBudget: 1080, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    underworld: { goldBudget: 1080, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    amazon: { goldBudget: 1080, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    undead: { goldBudget: 1080, sppBudget: 52, skillStacking: "one_player", starPlayersAllowed: false },
    snotling: { goldBudget: 1080, sppBudget: 60, skillStacking: "none", starPlayersAllowed: true },
    // ——— 1 100 000 po ———
    dark_elf: { goldBudget: 1100, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    old_world_alliance: { goldBudget: 1100, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    nurgle: { goldBudget: 1100, sppBudget: 52, skillStacking: "none", starPlayersAllowed: false },
    human: { goldBudget: 1100, sppBudget: 58, skillStacking: "one_player", starPlayersAllowed: false },
    // ——— 1 140 000 po ———
    lizardmen: { goldBudget: 1140, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    wood_elf: { goldBudget: 1140, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    chaos_chosen: { goldBudget: 1140, sppBudget: 58, skillStacking: "two_players", starPlayersAllowed: false },
    imperial_nobility: { goldBudget: 1140, sppBudget: 58, skillStacking: "one_player", starPlayersAllowed: false },
    tomb_kings: { goldBudget: 1140, sppBudget: 58, skillStacking: "one_player", starPlayersAllowed: false },
    chaos_renegade: { goldBudget: 1140, sppBudget: 66, skillStacking: "none", starPlayersAllowed: true },
    // ——— 1 160 000 po ———
    necromantic_horror: { goldBudget: 1160, sppBudget: 52, skillStacking: "none", starPlayersAllowed: false },
    bretonnian: { goldBudget: 1160, sppBudget: 58, skillStacking: "one_player", starPlayersAllowed: true },
    black_orc: { goldBudget: 1160, sppBudget: 60, skillStacking: "two_players", starPlayersAllowed: true },
    goblin: { goldBudget: 1160, sppBudget: 60, skillStacking: "none", starPlayersAllowed: true },
    // ——— 1 180 000 po ———
    slann: { goldBudget: 1180, sppBudget: 52, skillStacking: "one_player", starPlayersAllowed: false },
    chaos_dwarf: { goldBudget: 1180, sppBudget: 58, skillStacking: "two_players", starPlayersAllowed: false },
    elven_union: { goldBudget: 1180, sppBudget: 60, skillStacking: "none", starPlayersAllowed: false },
    halfling: { goldBudget: 1180, sppBudget: 60, skillStacking: "none", starPlayersAllowed: true },
    ogre: { goldBudget: 1180, sppBudget: 66, skillStacking: "two_players", starPlayersAllowed: true },
    // ——— 1 200 000 po ———
    vampire: { goldBudget: 1200, sppBudget: 44, skillStacking: "none", starPlayersAllowed: false },
    khorne: { goldBudget: 1200, sppBudget: 58, skillStacking: "none", starPlayersAllowed: false },
    norse: { goldBudget: 1200, sppBudget: 58, skillStacking: "two_players", starPlayersAllowed: true },
    gnome: { goldBudget: 1200, sppBudget: 58, skillStacking: "none", starPlayersAllowed: true },
    dwarf: { goldBudget: 1200, sppBudget: 60, skillStacking: "two_players", starPlayersAllowed: false },
  },
  skillCosts: {
    firstPrimary: 6,
    firstSecondary: 10,
    secondPrimary: 8,
    secondSecondary: 12,
    eliteSurcharge: 2,
  },
  eliteSkills: [],
  bannedStarPlayers: [
    "hthark_the_unstoppable",
    "lord_borak",
    "morg_n_thorg",
    "deeproot_strongbranch",
    "hakflem_skuttlespike",
    "skitter_stab_stab",
    "ripper_bolgrot",
    "cindy_piewhistle",
    "griff_oberwald",
    "ivar_eriksson",
    "jordell_freshbreeze",
    "maple_highgrove",
    // « Skrorg Snowpelt » dans le pack ; slug du catalogue du moteur.
    "skorg_snowpelt",
    // « Grak and Crumbleberry » : la paire est bannie (2 slugs).
    "grak",
    "crumbleberry",
    "varag_ghoul_chewer",
  ],
  starPlayerSppTax: [
    { maxTotalCostK: 199, spp: 18 },
    { maxTotalCostK: 299, spp: 24 },
    { maxTotalCostK: Number.POSITIVE_INFINITY, spp: 32 },
  ],
  allowedInducements: [
    { slug: "team_mascot", cost: 25_000 },
    { slug: "bloodweiser_kegs", cost: 50_000, max: 2 },
    {
      slug: "bribe",
      cost: 100_000,
      noteFr:
        "50 000 po pour les équipes Corruption et Pots-de-vin. Recruter un " +
        "Star Player à Arme Secrète abaisse la limite de Pots-de-vin à 2.",
    },
    {
      slug: "riotous_rookies",
      cost: 150_000,
      noteFr: "Équipes Ogres et Snotlings uniquement.",
    },
    {
      slug: "halfling_master_chef",
      cost: 300_000,
      noteFr: "100 000 po pour les équipes Halflings.",
    },
  ],
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};

/** Registre des règlements de tournoi disponibles. */
export const TOURNAMENT_RULESETS: Readonly<
  Record<string, TournamentRulesetDefinition>
> = {
  [NAF_WORLD_CUP_2027.slug]: NAF_WORLD_CUP_2027,
};

/** Slugs disponibles (ordre d'affichage des listes déroulantes). */
export const TOURNAMENT_RULESET_SLUGS: readonly string[] =
  Object.keys(TOURNAMENT_RULESETS);

export function isTournamentRulesetSlug(value: unknown): value is string {
  return typeof value === "string" && value in TOURNAMENT_RULESETS;
}

/** Définition d'un règlement, ou null si le slug est inconnu. */
export function getTournamentRuleset(
  slug: string | null | undefined,
): TournamentRulesetDefinition | null {
  if (!slug) return null;
  return TOURNAMENT_RULESETS[slug] ?? null;
}

/** Règles imposées à un roster par un règlement (null = roster interdit). */
export function getTournamentRosterRules(
  def: TournamentRulesetDefinition,
  rosterSlug: string,
): TournamentRosterRules | null {
  return def.rosterRules[rosterSlug] ?? null;
}

/** Nombre max de joueurs pouvant cumuler 2 compétences à la création. */
export function maxTwoSkillPlayers(stacking: TournamentSkillStacking): number {
  if (stacking === "one_player") return 1;
  if (stacking === "two_players") return 2;
  return 0;
}

/**
 * Taxe SPP due pour un coût cumulé de Star Players (kpo). 0 si aucun Star
 * Player recruté (coût cumulé ≤ 0).
 */
export function tournamentStarPlayerSppTax(
  def: TournamentRulesetDefinition,
  totalStarCostK: number,
): number {
  if (totalStarCostK <= 0) return 0;
  for (const bracket of def.starPlayerSppTax) {
    if (totalStarCostK <= bracket.maxTotalCostK) return bracket.spp;
  }
  // Barème vide ou non couvrant : pas de taxe.
  return 0;
}

/** Un achat de compétence à la création, rattaché à un joueur. */
export interface TournamentSkillPick {
  /** Clé stable identifiant le joueur (ex : `${positionSlug}#${ordinal}`). */
  readonly playerKey: string;
  /** Type d'avancement demandé (seuls primary/secondary sont légaux). */
  readonly type: string;
  /** Slug de la compétence choisie (pour le surcoût Elite). */
  readonly skillSlug?: string;
}

export interface TournamentSkillPlanResult {
  readonly valid: boolean;
  readonly error?: string;
  /** Coût SPP total du plan (0 si invalide). */
  readonly totalSpp: number;
}

/**
 * Valide un plan d'achats de compétences à la création vis-à-vis d'un
 * règlement de tournoi : types autorisés (choix primaire/secondaire
 * uniquement), 2 compétences max par joueur, quota de joueurs à 2 compétences
 * selon le cumul du roster, et calcule le coût SPP total (1re/2e compétence ×
 * primaire/secondaire + surcoût Elite). La vérification du budget SPP
 * (pool − taxe Star Players) reste à la charge de l'appelant.
 */
export function validateTournamentSkillPlan(
  def: TournamentRulesetDefinition,
  rules: TournamentRosterRules,
  picks: readonly TournamentSkillPick[],
): TournamentSkillPlanResult {
  const eliteSet = new Set(def.eliteSkills);
  const perPlayer = new Map<string, number>();
  let totalSpp = 0;

  for (const pick of picks) {
    if (pick.type !== "primary" && pick.type !== "secondary") {
      return {
        valid: false,
        error:
          "Ce règlement n'autorise que des compétences au choix (primaires ou " +
          "secondaires) : améliorations aléatoires et de caractéristique interdites",
        totalSpp: 0,
      };
    }
    const taken = perPlayer.get(pick.playerKey) ?? 0;
    if (taken >= 2) {
      return {
        valid: false,
        error: "Un joueur ne peut pas cumuler plus de 2 compétences",
        totalSpp: 0,
      };
    }
    const cost =
      taken === 0
        ? pick.type === "primary"
          ? def.skillCosts.firstPrimary
          : def.skillCosts.firstSecondary
        : pick.type === "primary"
          ? def.skillCosts.secondPrimary
          : def.skillCosts.secondSecondary;
    const elite =
      pick.skillSlug && eliteSet.has(pick.skillSlug)
        ? def.skillCosts.eliteSurcharge
        : 0;
    totalSpp += cost + elite;
    perPlayer.set(pick.playerKey, taken + 1);
  }

  const doubled = [...perPlayer.values()].filter((n) => n >= 2).length;
  const maxDoubled = maxTwoSkillPlayers(rules.skillStacking);
  if (doubled > maxDoubled) {
    const label =
      maxDoubled === 0
        ? "Ce roster ne peut pas cumuler 2 compétences sur un même joueur"
        : `Ce roster ne peut cumuler 2 compétences que sur ${maxDoubled} joueur${maxDoubled > 1 ? "s" : ""} maximum`;
    return { valid: false, error: label, totalSpp: 0 };
  }

  return { valid: true, totalSpp };
}

/**
 * Coût SPP de la N-ième compétence (0-based) d'un joueur selon le barème du
 * règlement. Utilisé pour dépenser le pool au build (miroir « appliqué » de
 * `validateTournamentSkillPlan`).
 */
export function tournamentSkillCost(
  def: TournamentRulesetDefinition,
  alreadyTaken: number,
  type: "primary" | "secondary",
  skillSlug?: string,
): number {
  const base =
    alreadyTaken <= 0
      ? type === "primary"
        ? def.skillCosts.firstPrimary
        : def.skillCosts.firstSecondary
      : type === "primary"
        ? def.skillCosts.secondPrimary
        : def.skillCosts.secondSecondary;
  const elite =
    skillSlug && def.eliteSkills.includes(skillSlug)
      ? def.skillCosts.eliteSurcharge
      : 0;
  return base + elite;
}
