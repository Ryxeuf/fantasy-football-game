/**
 * Journaliers (journeymen) de la feuille de match de ligue.
 *
 * Règle BB : une équipe qui ne peut pas aligner 11 joueurs (morts,
 * absents/missNextMatch, licenciés) engage un journalier par joueur
 * manquant. Le journalier joue au poste « lineman » du roster (un poste
 * recrutable à 0-12 ou plus) avec la compétence Solitaire (4+).
 *
 * Ici les journaliers sont des joueurs SYNTHÉTIQUES de la feuille :
 *  - jamais persistés en TeamPlayer (ils quittent l'équipe après le
 *    match) ;
 *  - id déterministe `journeyman-<side>-<n>` — accepté par les
 *    LeagueMatchEvent (pas de FK sur actorPlayerId/targetPlayerId) ;
 *  - exclus de la persistance post-match (SPP, blessures…) via
 *    `isJourneymanId` (cf. league-match-sheet.buildOfflineInputFromSummary).
 *
 * Si le roster offre PLUSIEURS postes de lineman (Orques : Trois-quart
 * Orque OU Trois-quart Gobelin), le coach choisit le poste de CHAQUE
 * journalier via la feuille (`LeagueMatchSheet.journeymenHome/Away`,
 * `{ positions: [slug | null, ...] }`). Un seul choix global
 * (`{ position: slug }`, forme historique) reste lu et s'applique alors à
 * tous les journaliers. Par défaut : le lineman « de base » (max le plus
 * élevé, puis coût le plus bas).
 *
 * Le choix est PAR RANG : `positions[i]` est le poste du journalier `i`
 * (l'ordre de dérivation, stable). Un rang absent, `null` ou inconnu
 * retombe sur le choix global puis sur le lineman de base — une équipe qui
 * passe de 2 à 3 journaliers garde donc ses deux premiers choix.
 *
 * SOURCE DES POSTES — la base (`Position`), injectée par l'appelant via
 * `positions`. Le catalogue compilé (`TEAM_ROSTERS_BY_RULESET`) ne sert plus
 * que de repli. Sans ça, un poste dont le prix ou les stats ont été corrigés
 * en admin produisait un journalier faux — donc une VEA de match fausse (base
 * de la cagnotte / CTV) et un débit de trésorerie faux au recrutement
 * post-match — et un slug renommé rendait le journalier « payé mais jamais
 * matérialisé » (S4 de l'audit). Le module reste 100 % PUR : c'est la feuille
 * de match qui fait la lecture.
 */

import {
  TEAM_ROSTERS_BY_RULESET,
  DEFAULT_RULESET,
  KEYWORDS_SEASON3,
  SKILL_ACCESS_SEASON3,
  type Ruleset,
} from "@bb/game-engine";

export const JOURNEYMAN_ID_PREFIX = "journeyman-";

/** Un id de joueur synthétique « journalier » de feuille de match. */
export function isJourneymanId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(JOURNEYMAN_ID_PREFIX);
}

/**
 * Côté qui aligne un journalier, lu dans son id (`journeyman-<side>-<n>`).
 * `null` si l'id n'est pas celui d'un journalier.
 */
export function journeymanSide(
  id: string | null | undefined,
): "home" | "away" | null {
  if (!isJourneymanId(id)) return null;
  const rest = (id as string).slice(JOURNEYMAN_ID_PREFIX.length);
  if (rest.startsWith("home-")) return "home";
  if (rest.startsWith("away-")) return "away";
  return null;
}

/** Seuil BB « 0-12 ou plus » : le Trois-quart « de base » d'une fiche. */
const JOURNEYMAN_ELIGIBLE_MAX = 12;

/**
 * Mot-clé de poste qui désigne un Trois-quart. Le compendium publié pose la
 * règle en ces termes — « un journalier correspond toujours à un poste de
 * Trois-quart de la fiche d'équipe » et « si la fiche d'équipe propose
 * plusieurs postes de Trois-quart, le coach choisit le type de journalier ».
 * Le seul seuil `max` ratait les Trois-quarts à quota réduit (Orques :
 * Trois-quart Gobelin, 0-4), donc le choix annoncé par la règle.
 */
const LINEMAN_KEYWORD = "trois-quart";

/** Mots-clés d'un poste : ceux de la base, sinon la transcription moteur. */
function positionKeywords(p: JourneymanSourcePosition): string {
  return p.keywords ?? KEYWORDS_SEASON3[p.slug] ?? "";
}

/**
 * Poste utilisable comme journalier : le Trois-quart « de base » (0-12 ou
 * plus, quel que soit son libellé) ou tout poste dont les Mots-clés
 * déclarent « Trois-quart ».
 */
function isJourneymanEligible(p: JourneymanSourcePosition): boolean {
  if (p.max >= JOURNEYMAN_ELIGIBLE_MAX) return true;
  return positionKeywords(p)
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .includes(LINEMAN_KEYWORD);
}

export interface JourneymanPositionOption {
  readonly slug: string;
  readonly name: string;
}

export interface SheetJourneyman {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly position: string;
  readonly positionName: string;
  readonly stats: {
    readonly ma: number;
    readonly st: number;
    readonly ag: number;
    readonly pa: number | null;
    readonly av: number;
  };
  /** CSV de slugs : compétences du poste + Solitaire (4+). */
  readonly skills: string;
  /**
   * Valeur du journalier en po (coût du poste de lineman) : règle BB, un
   * journalier compte dans la VEA du match (CTV pour les coups de pouce).
   */
  readonly cost: number;
}

/**
 * Poste utilisable pour dériver un journalier. Forme commune à
 * `RosterPayload.positions` (base) et au catalogue du moteur (repli) — le
 * coût est en kpo dans les deux.
 */
export interface JourneymanSourcePosition {
  slug: string;
  displayName: string;
  cost: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  /**
   * Mots-clés du poste (CSV, ex: « Gobelin, Trois-quart »). Présents sur les
   * lignes lues en base ; sur le catalogue compilé, ils sont résolus par
   * slug. Servent à reconnaître un Trois-quart à quota réduit.
   */
  keywords?: string | null;
  /**
   * Accès aux compétences en évolution (CSV de codes `G/A/S/P/M/K`), lus en
   * base (`Position.primarySkills` / `secondarySkills`). Absents sur le
   * catalogue compilé : ils sont alors résolus par slug
   * (`SKILL_ACCESS_SEASON3`). Servent au tirage aléatoire et au contrôle
   * d'accès de l'évolution d'un journalier.
   */
  primarySkills?: string | null;
  secondarySkills?: string | null;
}

/** Découpe un CSV de compétences en slugs (entrées vides ignorées). */
export function splitSkillCsv(csv: string | null | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Accès Principale/Secondaire du poste d'un journalier : la ligne lue en
 * base quand elle renseigne l'un des deux, sinon la table compilée, sinon
 * « non renseigné » (`null`, comme un poste Saison 2). Même résolution que
 * l'éditeur web (base d'abord, repli compilé), pour que le serveur ne
 * refuse jamais une catégorie que l'éditeur propose.
 */
export function journeymanSkillAccess(
  position: string,
  positions?: readonly JourneymanSourcePosition[] | null,
): { primary: string | null; secondary: string | null } {
  const row = positions?.find((p) => p.slug === position);
  if (row && (row.primarySkills != null || row.secondarySkills != null)) {
    return {
      primary: row.primarySkills ?? null,
      secondary: row.secondarySkills ?? null,
    };
  }
  const compiled = SKILL_ACCESS_SEASON3[position];
  return {
    primary: compiled?.primary ?? null,
    secondary: compiled?.secondary ?? null,
  };
}

/**
 * Seed du tirage « Compétence Principale au hasard » d'un journalier.
 *
 * Un journalier n'a pas de ligne TeamPlayer : son id (`journeyman-<side>-<n>`)
 * se répète d'une feuille à l'autre, d'où la FEUILLE dans le seed. Le POSTE
 * y figure aussi : changer le poste change le journalier (stats, compétences
 * de base — donc les doublons exclus du tirage), et revenir au poste initial
 * redonne la même paire (pas de relance par aller-retour). Le rang
 * d'avancement est toujours 0 : un journalier débarque sans évolution.
 */
export function journeymanRandomPrimarySeed(
  sheetId: string,
  journeyman: { readonly id: string; readonly position: string },
  category: string,
): string {
  return `sheet:${sheetId}:${journeyman.id}:${journeyman.position}:0:${category}`;
}

/**
 * Postes du roster : ceux fournis par l'appelant (lus en base) quand il y en
 * a, sinon le catalogue compilé.
 */
function rosterPositions(
  roster: string,
  ruleset?: string,
  provided?: readonly JourneymanSourcePosition[] | null,
): readonly JourneymanSourcePosition[] {
  if (provided && provided.length > 0) return provided;
  const rs = (ruleset as Ruleset) ?? DEFAULT_RULESET;
  const map =
    TEAM_ROSTERS_BY_RULESET[rs] ?? TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
  const def = (
    map as Record<string, { positions?: JourneymanSourcePosition[] }>
  )[roster];
  return def?.positions ?? [];
}

/**
 * Postes de Trois-quart du roster, triés par max décroissant puis coût
 * croissant : le PREMIER reste le Trois-quart de base (0-16), donc le
 * défaut historique est inchangé — seule la liste des choix s'élargit.
 */
export function linemanPositionsForRoster(
  roster: string,
  ruleset?: string,
  positions?: readonly JourneymanSourcePosition[] | null,
): JourneymanPositionOption[] {
  return rosterPositions(roster, ruleset, positions)
    .filter(isJourneymanEligible)
    .sort((a, b) => b.max - a.max || a.cost - b.cost)
    .map((p) => ({ slug: p.slug, name: p.displayName }));
}

/** Solitaire (4+) — slug du catalogue de compétences. */
const LONER_SLUG = "loner-4";

/** Fallback quand le roster est inconnu du moteur : lineman humain. */
const FALLBACK_STATS = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 } as const;

/** Fallback de valeur (po) quand le poste est inconnu : lineman à 50k. */
const FALLBACK_COST = 50_000;

export interface DeriveJourneymenInput {
  readonly side: "home" | "away";
  readonly roster: string;
  readonly ruleset?: string;
  /** Joueurs du roster (flags de dispo inclus). */
  readonly players: ReadonlyArray<{
    readonly number: number;
    readonly dead: boolean;
    readonly missNextMatch: boolean;
  }>;
  /**
   * Choix GLOBAL du coach (forme historique `{ position }`) — appliqué à
   * tous les journaliers qui n'ont pas de choix propre. null/inconnu =>
   * lineman de base.
   */
  readonly chosenPosition?: string | null;
  /**
   * Choix PAR RANG (`{ positions }`) : `chosenPositions[i]` est le poste du
   * journalier `i`. Un rang absent, `null` ou inconnu du roster retombe sur
   * `chosenPosition` puis sur le lineman de base.
   */
  readonly chosenPositions?: readonly (string | null)[] | null;
  /**
   * Postes du roster lus EN BASE (`Position`). Absents/vides => repli sur le
   * catalogue compilé.
   */
  readonly positions?: readonly JourneymanSourcePosition[] | null;
}

/**
 * Dérive (pur, déterministe) les journaliers nécessaires pour aligner 11
 * joueurs. Retourne [] quand l'équipe a déjà 11 joueurs disponibles.
 */
export function deriveJourneymen(
  input: DeriveJourneymenInput,
): SheetJourneyman[] {
  const eligible = input.players.filter((p) => !p.dead && !p.missNextMatch);
  const missing = Math.max(0, 11 - eligible.length);
  if (missing === 0) return [];

  const positions = rosterPositions(
    input.roster,
    input.ruleset,
    input.positions,
  );
  const linemen = linemanPositionsForRoster(
    input.roster,
    input.ruleset,
    input.positions,
  );
  /** Un slug n'est retenu que s'il désigne bien un lineman de ce roster. */
  const eligibleSlug = (slug: string | null | undefined): string | null =>
    slug && linemen.some((l) => l.slug === slug) ? slug : null;
  const globalSlug = eligibleSlug(input.chosenPosition);
  const defaultSlug = globalSlug ?? linemen[0]?.slug ?? null;
  const maxNumber = input.players.reduce((m, p) => Math.max(m, p.number), 0);

  return Array.from({ length: missing }, (_, i) => {
    const slug = eligibleSlug(input.chosenPositions?.[i]) ?? defaultSlug;
    const position = positions.find((p) => p.slug === slug);
    const baseSkills = (position?.skills ?? "")
      .split(",")
      .map((sk) => sk.trim())
      .filter((sk) => sk.length > 0);
    return {
      id: `${JOURNEYMAN_ID_PREFIX}${input.side}-${i + 1}`,
      number: maxNumber + i + 1,
      name: `Journalier ${i + 1}`,
      position: position?.slug ?? "journeyman",
      positionName: position
        ? `Journalier (${position.displayName})`
        : "Journalier",
      stats: position
        ? {
            ma: position.ma,
            st: position.st,
            ag: position.ag,
            pa: position.pa,
            av: position.av,
          }
        : FALLBACK_STATS,
      // Chaque journalier porte les compétences de SON poste + Solitaire.
      skills: [...baseSkills, LONER_SLUG].join(","),
      // Coût du poste (kpo moteur -> po) : compte dans la VEA du match.
      cost: position ? position.cost * 1000 : FALLBACK_COST,
    };
  });
}

/**
 * Libellé de poste porté par un journalier BAKÉ dans un snapshot de roster
 * (`positionName` : « Journalier » ou « Journalier (<poste>) »). Les joueurs
 * réels y portent leur SLUG de poste (`blitzer_skaven`…), jamais un libellé :
 * le préfixe discrimine donc les deux sans ambiguïté.
 */
const FROZEN_JOURNEYMAN_POSITION_PREFIX = "Journalier";

/** Roster FIGÉ d'un côté de la feuille (« version du match »). */
export interface FrozenSheetRoster {
  /**
   * Joueurs RÉELS figés, dans la forme attendue par `deriveJourneymen`. Le
   * gel exclut déjà les morts, les licenciés et les absents : tous les
   * joueurs du snapshot étaient donc disponibles pour ce match.
   */
  readonly players: ReadonlyArray<{
    readonly number: number;
    readonly dead: boolean;
    readonly missNextMatch: boolean;
  }>;
  /** Journaliers alignés, bakés au gel dans l'ordre de dérivation. */
  readonly journeymen: ReadonlyArray<{
    readonly number: number;
    readonly name: string;
  }>;
}

/**
 * Lit le roster figé d'un côté de la feuille (parse tolérant : objet natif
 * PG, chaîne JSON du miroir sqlite, null).
 *
 * Retourne `null` quand il n'y a RIEN de figé à lire — snapshot absent,
 * illisible, ou « en-tête seul » (feuilles antérieures au gel complet, qui
 * ne bakent ni le roster ni les journaliers). L'appelant retombe alors sur
 * le roster live.
 */
export function parseFrozenSheetRoster(raw: unknown): FrozenSheetRoster | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as { headerOnly?: unknown; players?: unknown };
  if (o.headerOnly === true) return null;
  if (!Array.isArray(o.players)) return null;

  const players: Array<{
    number: number;
    dead: boolean;
    missNextMatch: boolean;
  }> = [];
  const journeymen: Array<{ number: number; name: string }> = [];
  for (const entry of o.players) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { number?: unknown; name?: unknown; position?: unknown };
    const number = typeof e.number === "number" ? e.number : 0;
    if (
      typeof e.position === "string" &&
      e.position.startsWith(FROZEN_JOURNEYMAN_POSITION_PREFIX)
    ) {
      journeymen.push({
        number,
        name: typeof e.name === "string" ? e.name : "",
      });
      continue;
    }
    players.push({ number, dead: false, missNextMatch: false });
  }
  return { players, journeymen };
}

/**
 * Journaliers de la « VERSION DU MATCH » : dérivés du roster FIGÉ dès qu'il
 * existe, du roster live sinon.
 *
 * C'est la seule dérivation que doit utiliser la feuille de match. Repartir
 * du roster live rejouait le calcul sur un roster qui a bougé DEPUIS le coup
 * d'envoi : après validation, les morts et les blessures « rate le prochain
 * match » que la feuille vient d'appliquer faisaient apparaître (ou grossir)
 * un contingent de journaliers qui n'a jamais joué ce match-là — ceux-ci sont
 * pour la rencontre SUIVANTE.
 *
 * Les numéros et les noms viennent des journaliers bakés dans le snapshot :
 * le gel fait foi, y compris sur les feuilles figées avant cette correction.
 */
export function deriveMatchJourneymen(
  input: DeriveJourneymenInput & {
    /** Colonne `rosterSnapshotHome/Away` de la feuille (brute). */
    readonly frozenRosterSnapshot?: unknown;
  },
): SheetJourneyman[] {
  const frozen = parseFrozenSheetRoster(input.frozenRosterSnapshot);
  if (!frozen) return deriveJourneymen(input);
  const derived = deriveJourneymen({ ...input, players: frozen.players });
  return derived.map((j, i) => {
    const baked = frozen.journeymen[i];
    if (!baked) return j;
    return { ...j, number: baked.number, name: baked.name || j.name };
  });
}

/**
 * Choix de postes de journaliers lu sur la feuille : un choix GLOBAL
 * (forme historique) et/ou un choix PAR RANG.
 */
export interface JourneymenChoice {
  /** `{ position }` — s'applique aux rangs sans choix propre. */
  readonly position: string | null;
  /** `{ positions }` — `positions[i]` = poste du journalier `i`. */
  readonly positions: readonly (string | null)[];
}

const EMPTY_CHOICE: JourneymenChoice = { position: null, positions: [] };

/** Une valeur JSON exploitable, quelle que soit sa forme de stockage. */
function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj as Record<string, unknown>;
}

/** Un slug non vide, sinon `null` (une entrée illisible ne bloque rien). */
function slugOrNull(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/**
 * Parse tolérant du champ `journeymenHome/Away` — objet natif (PG), chaîne
 * JSON (miroir sqlite) ou null. Lit les DEUX formes :
 * `{ position }` (historique) et `{ positions: [...] }` (choix par rang).
 */
export function parseJourneymenChoices(raw: unknown): JourneymenChoice {
  const obj = parseJsonObject(raw);
  if (!obj) return EMPTY_CHOICE;
  const rawPositions = obj.positions;
  return {
    position: slugOrNull(obj.position),
    positions: Array.isArray(rawPositions)
      ? rawPositions.map((entry) => slugOrNull(entry))
      : [],
  };
}

/**
 * Choix GLOBAL seul (forme historique). Conservé pour les appelants qui ne
 * dérivent qu'une valeur par équipe (capture de snapshot, affichage).
 */
export function parseJourneymenChoice(raw: unknown): string | null {
  return parseJourneymenChoices(raw).position;
}

/**
 * Choix de postes, prêt à être étalé dans un `DeriveJourneymenInput`. Un
 * seul point d'entrée pour les quatre dérivations de la feuille : elles ne
 * peuvent plus diverger sur la forme lue (un côté qui lirait encore le seul
 * choix global produirait des journaliers différents de ceux affichés).
 */
export function journeymenChoiceInput(raw: unknown): {
  readonly chosenPosition: string | null;
  readonly chosenPositions: readonly (string | null)[];
} {
  const choice = parseJourneymenChoices(raw);
  return {
    chosenPosition: choice.position,
    chosenPositions: choice.positions,
  };
}

/**
 * Recrutement d'un journalier à la fin du match (séquence BB, étape 4 —
 * EMBAUCHES). Règle : le journalier engagé rejoint l'équipe au coût de son
 * poste, PERD Solitaire, et conserve ce qu'il a gagné pendant la rencontre
 * (PSP + évolution prise à l'étape 3, qui renchérit d'autant son prix).
 *
 * 100 % pur : la feuille de match fournit le journalier dérivé, ses PSP du
 * match et l'évolution éventuellement stagée pour lui.
 */
export interface JourneymanHireInput {
  readonly journeyman: SheetJourneyman;
  /** PSP gagnés sur ce match par ce journalier. */
  readonly earnedSpp: number;
  /**
   * Évolution stagée pour ce journalier à l'étape 3 (compétence ou
   * caractéristique). `null` = aucune.
   */
  readonly advancement?: {
    readonly type: string;
    readonly skillSlug?: string | null;
    readonly stat?: "ma" | "st" | "ag" | "pa" | "av" | null;
    readonly d8?: number | null;
    /** Coût PSP du 1er palier pour ce type. */
    readonly pspCost: number;
    /** Surcoût de VALEUR (po) de l'évolution — renchérit le recrutement. */
    readonly valueSurcharge: number;
  } | null;
}

export interface JourneymanHire {
  /** Coût de recrutement (po) : poste + surcoût de l'évolution prise. */
  readonly cost: number;
  /** PSP restants après paiement de l'évolution. */
  readonly spp: number;
  /** CSV de compétences à la création (Solitaire retiré côté matérialisation). */
  readonly skills: string;
  /** JSON des avancements pris (vide si aucune évolution). */
  readonly advancements: string;
  /** Caractéristiques finales (amélioration de carac appliquée). */
  readonly stats: SheetJourneyman["stats"];
}

/** Effet d'une amélioration de caractéristique BB (ag/pa : la cible baisse). */
function improveStat(
  stats: SheetJourneyman["stats"],
  stat: "ma" | "st" | "ag" | "pa" | "av",
): SheetJourneyman["stats"] {
  switch (stat) {
    case "ma":
      return { ...stats, ma: stats.ma + 1 };
    case "st":
      return { ...stats, st: stats.st + 1 };
    case "av":
      return { ...stats, av: stats.av + 1 };
    case "ag":
      return { ...stats, ag: stats.ag - 1 };
    case "pa":
      return stats.pa === null ? stats : { ...stats, pa: stats.pa - 1 };
  }
}

/**
 * Calcule (pur) le recrutement d'un journalier : prix, PSP restants,
 * compétences, avancements et caractéristiques finales.
 */
export function buildJourneymanHire(
  input: JourneymanHireInput,
): JourneymanHire {
  const { journeyman, earnedSpp } = input;
  const adv = input.advancement ?? null;
  // Évolution non payable (PSP insuffisants) : elle n'est pas prise.
  const takesAdvancement = adv !== null && earnedSpp >= adv.pspCost;
  if (!takesAdvancement) {
    return {
      cost: journeyman.cost,
      spp: Math.max(0, earnedSpp),
      skills: journeyman.skills,
      advancements: "[]",
      stats: journeyman.stats,
    };
  }
  const isCharacteristic = adv.type === "characteristic" && !!adv.stat;
  const skills =
    !isCharacteristic && adv.skillSlug
      ? [journeyman.skills, adv.skillSlug].filter((v) => v.length > 0).join(",")
      : journeyman.skills;
  return {
    cost: journeyman.cost + adv.valueSurcharge,
    spp: Math.max(0, earnedSpp - adv.pspCost),
    skills,
    advancements: JSON.stringify([
      {
        ...(isCharacteristic
          ? { stat: adv.stat, d8: adv.d8 ?? undefined }
          : { skillSlug: adv.skillSlug }),
        type: adv.type,
        isRandom: adv.type === "random-primary",
        at: 0,
      },
    ]),
    stats:
      isCharacteristic && adv.stat
        ? improveStat(journeyman.stats, adv.stat)
        : journeyman.stats,
  };
}
