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
  /**
   * Prix réduit imposé par le règlement, en po. Il s'applique aux équipes
   * que le CATALOGUE officiel désigne pour la remise de ce coup de pouce
   * (`discountRule` / `discountRoster`, cf. `qualifiesForInducementDiscount`)
   * : le règlement fixe le montant, pas les bénéficiaires. Absent = le prix
   * du règlement vaut pour toutes les équipes.
   */
  readonly discountCost?: number;
  /**
   * Quantité max quand l'équipe recrute un Star Player portant Arme Secrète
   * (`secret-weapon`). Absent = aucun plafond conditionnel.
   */
  readonly maxWithSecretWeaponStar?: number;
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
   * Compétences « Elite » (surcoût `skillCosts.eliteSurcharge`) DÉSIGNÉES
   * NOMMÉMENT par le règlement. Slugs du catalogue de compétences.
   *
   * Liste vide = le règlement ne republie pas sa propre liste et retient
   * celles de l'édition (référentiel `Skill.isElite` : Blocage, Esquive,
   * Châtaigne, Garde en Saison 3). C'est le cas du pack NAF WC 2027 V2.1,
   * qui facture un surcoût Elite sans redéfinir quelles compétences le sont.
   * Cf. `resolveTournamentEliteSkills`.
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
  /**
   * Le coach choisit-il la Ligue régionale de son équipe à la création ?
   *
   * Par défaut oui (règle standard). Un règlement qui neutralise l'axe
   * régional — liste fermée de Coups de Pouce et de Star Players — met
   * `false` : aucune Ligue n'est alors demandée ni enregistrée.
   */
  readonly regionalLeagueChoice?: boolean;
  /**
   * Nombre de cumuls (joueurs autorisés à porter 2 compétences) RETIRÉS par
   * Star Player recruté. Absent ou 0 = les Star Players ne touchent pas au
   * cumul (pack V2.1). Le pack NAF WC 2027 V3.0 en retire 1 par Star Player.
   * Cf. `maxTwoSkillPlayersWithStars`.
   */
  readonly stackReductionPerStarPlayer?: number;
}

/**
 * Le règlement laisse-t-il le coach choisir sa Ligue régionale ?
 * `null` (aucun règlement) = règle standard, donc oui.
 */
export function allowsRegionalLeagueChoice(
  pack: TournamentRulesetDefinition | null | undefined,
): boolean {
  return pack?.regionalLeagueChoice ?? true;
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
  // Le pack facture un surcoût Elite sans republier la liste des compétences
  // concernées : ce sont donc celles de l'édition (cf. `eliteSkills` du type
  // et `resolveTournamentEliteSkills`).
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
      discountCost: 50_000,
      maxWithSecretWeaponStar: 2,
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
      discountCost: 100_000,
      noteFr: "100 000 po pour les équipes Halflings.",
    },
  ],
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};

/** Ligne du tableau des tiers V3.0 : le cumul et les Star Players suivent la COLONNE de SPP. */
function v3Tier(
  goldBudget: number,
  sppBudget: 44 | 52 | 60 | 66 | 72,
): TournamentRosterRules {
  const upperTier = sppBudget >= 60;
  return {
    goldBudget,
    sppBudget,
    skillStacking: upperTier ? "two_players" : "one_player",
    starPlayersAllowed: upperTier,
  };
}

/**
 * NAF World Cup 2027 (Malte) — Rules Pack officiel V3.0.
 *
 * Règlement DISTINCT du V2.1 (slug propre) : les équipes et compétitions
 * créées sous V2.1 gardent leurs budgets. Ce qui change :
 *  - tableau des tiers refondu (budgets de 1 100 à 1 200 kpo, colonnes
 *    44 / 52 / 60 / 66 / 72 SPP) ;
 *  - cumul et Star Players portés par la COLONNE de SPP : 44 et 52 = un
 *    joueur à 2 compétences, sans Star Player ; 60, 66 et 72 = deux joueurs
 *    à 2 compétences, Star Players autorisés ;
 *  - chaque Star Player recruté retire un cumul ;
 *  - taxe Star Players par tranches 0-200 / 201-300 / 301+ kpo ;
 *  - liste des Star Players bannis révisée.
 * Escouades (6 coachs + 1 remplaçant), départages et conduite ne sont pas
 * modélisés : seule la composition d'équipe l'est.
 */
export const NAF_WORLD_CUP_2027_V3: TournamentRulesetDefinition = {
  slug: "naf_world_cup_2027_v3",
  nameFr: "NAF World Cup 2027 (règlement officiel V3.0)",
  nameEn: "NAF World Cup 2027 (official rules pack V3.0)",
  shortLabel: "NAF World Cup 2027 V3.0",
  version: "V3.0",
  edition: "season_3",
  format: "bb11",
  descriptionFr:
    "Tournoi résurrection : aucun SPP gagné en jeu, blessures et morts non " +
    "conservées entre les matchs. Budget d'or et budget de SPP fixés par le " +
    "tier du roster ; l'or et les SPP non dépensés à la création sont perdus. " +
    "Minimum 11 joueurs réguliers avant tout Star Player ; compétences au " +
    "choix uniquement (améliorations aléatoires et de caractéristique " +
    "interdites). Chaque Star Player recruté retire un cumul de compétences. " +
    "Maîtres de la Non-vie et Contagieux s'appliquent, mais un joueur ajouté " +
    "en cours de match quitte l'équipe à la fin de la rencontre. Toutes les " +
    "équipes sont considérées à la même VEA pour les Prières à Nuffle. Joué " +
    "en escouades de 6 coachs (plus un remplaçant facultatif), un roster et " +
    "un Star Player donnés ne pouvant être pris qu'une fois par escouade.",
  resurrection: true,
  minRegularPlayersBeforeStars: 11,
  rosterRules: {
    // ——— 1 100 000 po ———
    amazon: v3Tier(1100, 44),
    dark_elf: v3Tier(1100, 44),
    high_elf: v3Tier(1100, 44),
    old_world_alliance: v3Tier(1100, 44),
    wood_elf: v3Tier(1100, 44),
    human: v3Tier(1100, 52),
    orc: v3Tier(1100, 52),
    skaven: v3Tier(1100, 52),
    undead: v3Tier(1100, 52),
    underworld: v3Tier(1100, 52),
    nurgle: v3Tier(1100, 60),
    snotling: v3Tier(1100, 66),
    // ——— 1 140 000 po ———
    lizardmen: v3Tier(1140, 44),
    elven_union: v3Tier(1140, 52),
    tomb_kings: v3Tier(1140, 60),
    chaos_chosen: v3Tier(1140, 66),
    imperial_nobility: v3Tier(1140, 66),
    // ——— 1 160 000 po ———
    necromantic_horror: v3Tier(1160, 52),
    slann: v3Tier(1160, 52),
    bretonnian: v3Tier(1160, 66),
    chaos_renegade: v3Tier(1160, 72),
    // ——— 1 180 000 po ———
    gnome: v3Tier(1180, 60),
    black_orc: v3Tier(1180, 72),
    goblin: v3Tier(1180, 72),
    halfling: v3Tier(1180, 72),
    // ——— 1 200 000 po ———
    vampire: v3Tier(1200, 52),
    norse: v3Tier(1200, 60),
    chaos_dwarf: v3Tier(1200, 66),
    khorne: v3Tier(1200, 66),
    dwarf: v3Tier(1200, 72),
    ogre: v3Tier(1200, 72),
  },
  skillCosts: {
    firstPrimary: 6,
    firstSecondary: 10,
    secondPrimary: 8,
    secondSecondary: 12,
    eliteSurcharge: 2,
  },
  // Comme le V2.1 : surcoût Elite facturé sans republier la liste, donc
  // celles de l'édition (`resolveTournamentEliteSkills`).
  eliteSkills: [],
  bannedStarPlayers: [
    "anqi_panqi",
    "boa_konssstriktr",
    // « Dribl & Drull » : la paire est bannie (2 slugs).
    "dribl",
    "drull",
    "deeproot_strongbranch",
    "estelle_la_veneaux",
    "glotl_stop",
    // « Grak and Crumbleberry » : la paire est bannie (2 slugs).
    "grak",
    "crumbleberry",
    "griff_oberwald",
    "hakflem_skuttlespike",
    "hthark_the_unstoppable",
    "ivar_eriksson",
    "jordell_freshbreeze",
    "maple_highgrove",
    "morg_n_thorg",
    "ripper_bolgrot",
    "skitter_stab_stab",
    // « Skrorg Snowpelt » dans le pack ; slug du catalogue du moteur.
    "skorg_snowpelt",
  ],
  starPlayerSppTax: [
    { maxTotalCostK: 200, spp: 18 },
    { maxTotalCostK: 300, spp: 24 },
    { maxTotalCostK: Number.POSITIVE_INFINITY, spp: 32 },
  ],
  stackReductionPerStarPlayer: 1,
  allowedInducements: NAF_WORLD_CUP_2027.allowedInducements,
  scoring: { win: 5, draw: 2, loss: 0, concession: -5 },
};

/** Registre des règlements de tournoi disponibles. */
export const TOURNAMENT_RULESETS: Readonly<
  Record<string, TournamentRulesetDefinition>
> = {
  [NAF_WORLD_CUP_2027.slug]: NAF_WORLD_CUP_2027,
  [NAF_WORLD_CUP_2027_V3.slug]: NAF_WORLD_CUP_2027_V3,
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
 * Nombre de joueurs pouvant cumuler 2 compétences UNE FOIS les Star Players
 * recrutés pris en compte : le quota du roster, moins
 * `stackReductionPerStarPlayer` par Star Player (jamais négatif). Sans
 * réduction au règlement, c'est `maxTwoSkillPlayers`.
 *
 * `starPlayerCount` compte les Star Players recrutés, une paire valant deux.
 */
export function maxTwoSkillPlayersWithStars(
  def: TournamentRulesetDefinition,
  rules: TournamentRosterRules,
  starPlayerCount = 0,
): number {
  const base = maxTwoSkillPlayers(rules.skillStacking);
  const perStar = def.stackReductionPerStarPlayer ?? 0;
  if (perStar <= 0 || starPlayerCount <= 0) return base;
  return Math.max(0, base - perStar * starPlayerCount);
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
 * primaire/secondaire + surcoût Elite). `starPlayerCount` réduit le quota
 * quand le règlement le prévoit (`stackReductionPerStarPlayer`). La vérification du budget SPP
 * (pool − taxe Star Players) reste à la charge de l'appelant.
 */
export function validateTournamentSkillPlan(
  def: TournamentRulesetDefinition,
  rules: TournamentRosterRules,
  picks: readonly TournamentSkillPick[],
  eliteSkills?: ReadonlySet<string>,
  starPlayerCount = 0,
): TournamentSkillPlanResult {
  const eliteSet = eliteSkills ?? new Set(def.eliteSkills);
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
  const maxDoubled = maxTwoSkillPlayersWithStars(def, rules, starPlayerCount);
  if (doubled > maxDoubled) {
    return {
      valid: false,
      error: tournamentStackingError(def, rules, starPlayerCount),
      totalSpp: 0,
    };
  }

  return { valid: true, totalSpp };
}

/**
 * Message de refus d'un cumul hors quota. Il nomme les Star Players quand
 * ce sont eux qui ont consommé le quota du roster : « ce roster ne peut pas
 * cumuler » serait faux pour un roster qui le peut sans Star Player.
 */
export function tournamentStackingError(
  def: TournamentRulesetDefinition,
  rules: TournamentRosterRules,
  starPlayerCount = 0,
): string {
  const max = maxTwoSkillPlayersWithStars(def, rules, starPlayerCount);
  const reduced = max < maxTwoSkillPlayers(rules.skillStacking);
  const suffix = reduced
    ? " (chaque Star Player recruté retire un cumul)"
    : "";
  return max === 0
    ? `Ce roster ne peut pas cumuler 2 compétences sur un même joueur${suffix}`
    : `Ce roster ne peut cumuler 2 compétences que sur ${max} joueur${max > 1 ? "s" : ""} maximum${suffix}`;
}

/**
 * Compétences Elite RETENUES par le règlement : sa propre liste quand il en
 * publie une, sinon celles de l'édition (référentiel `Skill.isElite`).
 *
 * Sans ce repli, un règlement qui facture un surcoût Elite sans republier la
 * liste — le cas du pack NAF WC 2027 — ne le facturait jamais : `eliteSkills`
 * étant vide, aucune compétence n'était reconnue comme Elite.
 */
export function resolveTournamentEliteSkills(
  def: TournamentRulesetDefinition,
  editionEliteSkills: readonly string[] = [],
): ReadonlySet<string> {
  return new Set(
    def.eliteSkills.length > 0 ? def.eliteSkills : editionEliteSkills,
  );
}

/**
 * Coût SPP de la N-ième compétence (0-based) d'un joueur selon le barème du
 * règlement. Utilisé pour dépenser le pool au build (miroir « appliqué » de
 * `validateTournamentSkillPlan`).
 *
 * `eliteSkills` : ensemble résolu par `resolveTournamentEliteSkills`. Omis,
 * on retombe sur la liste publiée par le règlement — donc sur aucun surcoût
 * quand il n'en publie pas. Les appelants qui connaissent le référentiel de
 * compétences (serveur, builder) DOIVENT le passer.
 */
export function tournamentSkillCost(
  def: TournamentRulesetDefinition,
  alreadyTaken: number,
  type: "primary" | "secondary",
  skillSlug?: string,
  eliteSkills?: ReadonlySet<string>,
): number {
  const base =
    alreadyTaken <= 0
      ? type === "primary"
        ? def.skillCosts.firstPrimary
        : def.skillCosts.firstSecondary
      : type === "primary"
        ? def.skillCosts.secondPrimary
        : def.skillCosts.secondSecondary;
  const elite = eliteSkills ?? new Set(def.eliteSkills);
  return base + (skillSlug && elite.has(skillSlug)
    ? def.skillCosts.eliteSurcharge
    : 0);
}
