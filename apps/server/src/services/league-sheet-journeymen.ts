/**
 * Journaliers (journeymen) de la feuille de match de ligue.
 *
 * Règle BB : une équipe qui ne peut pas aligner 11 joueurs (morts,
 * absents/missNextMatch, licenciés) engage un journalier par joueur
 * manquant. Le journalier joue à un poste de Trois-quart de quantité 0-16
 * (livre p.94 ; repli « plus grand max ≥ 12 » pour un roster sans
 * mots-clés) avec la compétence Solitaire (4+).
 *
 * Ici les journaliers sont des joueurs SYNTHÉTIQUES de la feuille :
 *  - jamais persistés en TeamPlayer (ils quittent l'équipe après le
 *    match) ;
 *  - id déterministe `journeyman-<side>-<n>` — accepté par les
 *    LeagueMatchEvent (pas de FK sur actorPlayerId/targetPlayerId) ;
 *  - exclus de la persistance post-match (SPP, blessures…) via
 *    `isJourneymanId` (cf. league-match-sheet.buildOfflineInputFromSummary).
 *
 * Si le roster offre PLUSIEURS Trois-quarts 0-16 (Morts-Vivants : Trois-quart
 * Squelette OU Trois-quart Zombie), le coach choisit le poste de CHAQUE
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
  applyCharacteristicImprovement,
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

/**
 * Quantité exigée d'un poste de journalier (livre p.94) : seul un poste de
 * Trois-quart de quantité 0-16 fournit un journalier.
 */
const JOURNEYMAN_REQUIRED_MAX = 16;

/**
 * Seuil historique « 0-12 ou plus » : repli des rosters SANS mots-clés de
 * poste (Saison 2, données anciennes) et sélection des Trois-quarts de la
 * fiche pour le mort relevé (`troisQuartPositionsForRoster`).
 */
const LEGACY_LINEMAN_MIN_MAX = 12;

/**
 * Mot-clé de poste qui désigne un Trois-quart (« Orque, Trois-quart »).
 */
const LINEMAN_KEYWORD = "trois-quart";

/** Mots-clés d'un poste : ceux de la base, sinon la transcription moteur. */
function positionKeywords(p: JourneymanSourcePosition): string {
  return p.keywords ?? KEYWORDS_SEASON3[p.slug] ?? "";
}

/** Le poste se déclare Trois-quart dans ses Mots-clés. */
function hasLinemanKeyword(p: JourneymanSourcePosition): boolean {
  return positionKeywords(p)
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .includes(LINEMAN_KEYWORD);
}

/**
 * Règle des journaliers (livre p.94) : un poste dont les Mots-clés
 * déclarent « Trois-quart » ET dont la quantité est 0-16. Un Trois-quart à
 * quota réduit (Orques : Trois-quart Gobelin 0-4 ; Alliance du Vieux Monde :
 * Aspirant Halfling 0-3, Trois-Quart Nain 0-3) n'en fournit pas.
 */
function isJourneymanEligible(p: JourneymanSourcePosition): boolean {
  return p.max >= JOURNEYMAN_REQUIRED_MAX && hasLinemanKeyword(p);
}

/** Tri commun : max décroissant puis coût croissant (le 0-16 en tête). */
function byMaxThenCost(
  a: JourneymanSourcePosition,
  b: JourneymanSourcePosition,
): number {
  return b.max - a.max || a.cost - b.cost;
}

/**
 * Postes fournissant un journalier, triés (défaut en tête).
 *
 * Repli pour un roster dont aucun poste ne remplit la règle — typiquement
 * un roster SANS mots-clés (Saison 2, données anciennes) : le ou les postes
 * de plus grand `max`, s'il atteint 12 (« 0-12 ou plus », comportement
 * historique). Aucun roster connu ne se retrouve ainsi sans journalier.
 */
function journeymanPositions(
  all: readonly JourneymanSourcePosition[],
): JourneymanSourcePosition[] {
  const eligible = all.filter(isJourneymanEligible);
  if (eligible.length > 0) return [...eligible].sort(byMaxThenCost);
  const topMax = all.reduce((m, p) => Math.max(m, p.max), 0);
  if (topMax < LEGACY_LINEMAN_MIN_MAX) return [];
  return all.filter((p) => p.max === topMax).sort(byMaxThenCost);
}

/**
 * Ancienne sélection (« 0-12 ou plus » OU Mot-clé « Trois-quart ») : les
 * Trois-quarts de la fiche, quel que soit leur quota. Sert au mort relevé
 * (règle « un Trois-quart de la fiche », sans condition de quantité) et à
 * relire un journalier baké dans le gel d'une feuille antérieure à la règle
 * p.94.
 */
function isTroisQuartPosition(p: JourneymanSourcePosition): boolean {
  return p.max >= LEGACY_LINEMAN_MIN_MAX || hasLinemanKeyword(p);
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
 * a, sinon le catalogue compilé. Partagé avec la relève des morts
 * (`league-sheet-raised-dead`), qui matérialise elle aussi un Trois-quart de
 * la fiche d'équipe.
 */
export function rosterPositions(
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
 * Postes pouvant fournir un JOURNALIER (règle p.94 : Trois-quart 0-16, repli
 * « plus grand max ≥ 12 » sans mots-clés), triés par max décroissant puis
 * coût croissant : le PREMIER est le défaut.
 */
export function linemanPositionsForRoster(
  roster: string,
  ruleset?: string,
  positions?: readonly JourneymanSourcePosition[] | null,
): JourneymanPositionOption[] {
  return journeymanPositions(rosterPositions(roster, ruleset, positions)).map(
    (p) => ({ slug: p.slug, name: p.displayName }),
  );
}

/**
 * TOUS les postes de Trois-quart de la fiche (0-12 ou plus, ou Mot-clé
 * « Trois-quart »), triés comme `linemanPositionsForRoster`. Ce n'est PAS la
 * règle des journaliers (p.94, quantité 0-16 exigée) : c'est celle du mort
 * relevé (« un Trois-quart de la fiche d'équipe »), découplée exprès.
 */
export function troisQuartPositionsForRoster(
  roster: string,
  ruleset?: string,
  positions?: readonly JourneymanSourcePosition[] | null,
): JourneymanPositionOption[] {
  return rosterPositions(roster, ruleset, positions)
    .filter(isTroisQuartPosition)
    .sort(byMaxThenCost)
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
  /**
   * Libellés « Journalier (<poste>) » BAKÉS dans le gel, par rang. Un choix
   * stocké devenu inéligible (Trois-quart à quota réduit, choisissable avant
   * la règle p.94) n'est conservé QUE s'il correspond au journalier baké de
   * ce rang : le gel fait foi pour une feuille figée (validée comprise), et
   * tout autre cas retombe sur le défaut.
   */
  readonly bakedPositionNames?: readonly (string | null)[] | null;
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
  const linemen = journeymanPositions(positions);
  /** Un slug n'est retenu que s'il désigne bien un journalier de ce roster. */
  const eligibleSlug = (slug: string | null | undefined): string | null =>
    slug && linemen.some((l) => l.slug === slug) ? slug : null;
  /**
   * Choix antérieur à la règle p.94 (Trois-quart à quota réduit) : retenu
   * seulement si le gel a baké CE poste à CE rang.
   */
  const frozenLegacySlug = (
    slug: string | null | undefined,
    rank: number,
  ): string | null => {
    const baked = input.bakedPositionNames?.[rank];
    if (!slug || !baked) return null;
    const p = positions.find(
      (pos) => pos.slug === slug && isTroisQuartPosition(pos),
    );
    return p && baked === `${FROZEN_JOURNEYMAN_POSITION_PREFIX} (${p.displayName})`
      ? slug
      : null;
  };
  const globalSlug = eligibleSlug(input.chosenPosition);
  const defaultSlug = linemen[0]?.slug ?? null;
  const maxNumber = input.players.reduce((m, p) => Math.max(m, p.number), 0);

  return Array.from({ length: missing }, (_, i) => {
    const ranked = input.chosenPositions?.[i];
    const slug =
      eligibleSlug(ranked) ??
      frozenLegacySlug(ranked, i) ??
      globalSlug ??
      frozenLegacySlug(input.chosenPosition, i) ??
      defaultSlug;
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
    /** Libellé baké « Journalier (<poste>) ». */
    readonly positionName: string;
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
  const journeymen: Array<{
    number: number;
    name: string;
    positionName: string;
  }> = [];
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
        positionName: e.position,
      });
      continue;
    }
    players.push({ number, dead: false, missNextMatch: false });
  }
  return { players, journeymen };
}

/** Un joueur du snapshot est un journalier baké (libellé « Journalier… »). */
function isFrozenJourneymanEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const position = (entry as { position?: unknown }).position;
  return (
    typeof position === "string" &&
    position.startsWith(FROZEN_JOURNEYMAN_POSITION_PREFIX)
  );
}

/**
 * Valeur totale (po) d'un contingent de journaliers : leur part de la VEA
 * du match (règle BB — un journalier aligné compte dans la CTV).
 */
export function sumJourneymenValue(
  journeymen: ReadonlyArray<{ readonly cost: number }>,
): number {
  return journeymen.reduce((sum, j) => sum + j.cost, 0);
}

/** Entrée d'un journalier telle que BAKÉE dans le snapshot de roster. */
export interface FrozenJourneymanEntry {
  readonly name: string;
  /** Libellé « Journalier (<poste>) » : discrimine des joueurs réels. */
  readonly position: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly spp: 0;
  readonly advancements: "[]";
}

export function toFrozenJourneymanEntry(
  j: SheetJourneyman,
): FrozenJourneymanEntry {
  return {
    name: j.name,
    position: j.positionName,
    number: j.number,
    ma: j.stats.ma,
    st: j.stats.st,
    ag: j.stats.ag,
    pa: j.stats.pa,
    av: j.stats.av,
    skills: j.skills,
    spp: 0,
    advancements: "[]",
  };
}

/**
 * Valeur des journaliers tels qu'ils sont BAKÉS dans le snapshot (snapshot
 * sans `journeymenValue`) : le poste se relit dans le libellé de chaque
 * entrée ; un libellé qui ne correspond à aucun poste retombe sur le
 * journalier re-dérivé du même rang (puis sur la valeur de repli).
 */
function bakedJourneymenValue(
  baked: readonly unknown[],
  derived: readonly SheetJourneyman[],
  positions: readonly JourneymanSourcePosition[],
): number {
  const costByLabel = new Map<string, number>();
  for (const p of positions) {
    costByLabel.set(`${FROZEN_JOURNEYMAN_POSITION_PREFIX} (${p.displayName})`, p.cost * 1000);
  }
  return baked.reduce<number>((sum, entry, i) => {
    const label = (entry as { position?: unknown }).position;
    const fromLabel =
      typeof label === "string" ? costByLabel.get(label) : undefined;
    return sum + (fromLabel ?? derived[i]?.cost ?? FALLBACK_COST);
  }, 0);
}

/**
 * Re-bake (pur) les journaliers d'un snapshot FIGÉ après un changement de
 * poste d'avant-match.
 *
 * Le gel bake les journaliers (poste, stats, compétences) ET leur valeur
 * dans la VEA figée. Sans re-gel, changer le poste d'un journalier (Orques :
 * Trois-quart Orque 50 k → Gobelin 40 k) ne touchait ni la VEA affichée et
 * budgétée (cagnotte des coups de pouce) ni le roster « version du match » —
 * seuls les pickers d'évènements suivaient le choix.
 *
 * `previous` / `next` sont les journaliers dérivés du roster FIGÉ avec
 * l'ancien et le nouveau choix (numéros et noms bakés conservés par
 * `deriveMatchJourneymen`). La valeur retirée est celle stockée à part
 * (`journeymenValue`, snapshots récents) ou, à défaut, celle re-dérivée de
 * l'ancien choix — un snapshot antérieur reste donc lisible sans backfill.
 *
 * Retourne le snapshot sérialisé, ou `null` s'il n'y a rien de figé à
 * re-baker (absent, illisible, « en-tête seul » — les journaliers y sont
 * alors ajoutés en live).
 */
export function rebakeFrozenJourneymen(input: {
  readonly raw: unknown;
  readonly previous: readonly SheetJourneyman[];
  readonly next: readonly SheetJourneyman[];
  /**
   * Roster et postes (base, sinon catalogue) : servent à relire le POSTE des
   * journaliers BAKÉS (libellé « Journalier (<poste>) ») quand le snapshot
   * ne porte pas `journeymenValue`. C'est ce qui est réellement figé dans la
   * VEA, alors que `previous` re-dérive le choix STOCKÉ — les deux divergent
   * sur une feuille dont le poste avait changé avant que le re-gel existe.
   */
  readonly roster?: string;
  readonly ruleset?: string;
  readonly positions?: readonly JourneymanSourcePosition[] | null;
}): string | null {
  const obj = parseJsonObject(input.raw);
  if (!obj || obj.headerOnly === true || !Array.isArray(obj.players)) {
    return null;
  }
  const realPlayers = obj.players.filter((e) => !isFrozenJourneymanEntry(e));
  const isFiniteNumber = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const previousValue = isFiniteNumber(obj.journeymenValue)
    ? obj.journeymenValue
    : bakedJourneymenValue(
        obj.players.filter(isFrozenJourneymanEntry),
        input.previous,
        input.roster !== undefined
          ? rosterPositions(input.roster, input.ruleset, input.positions)
          : [],
      );
  const nextValue = sumJourneymenValue(input.next);
  return JSON.stringify({
    ...obj,
    currentValue: isFiniteNumber(obj.currentValue)
      ? obj.currentValue - previousValue + nextValue
      : obj.currentValue,
    journeymenValue: nextValue,
    players: [...realPlayers, ...input.next.map(toFrozenJourneymanEntry)],
  });
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
  const derived = deriveJourneymen({
    ...input,
    players: frozen.players,
    bakedPositionNames: frozen.journeymen.map((j) => j.positionName),
  });
  return derived.map((j, i) => {
    const baked = frozen.journeymen[i];
    if (!baked) return j;
    return { ...j, number: baked.number, name: baked.name || j.name };
  });
}

/**
 * Options de poste servies au picker : la règle p.94, plus le poste d'un
 * journalier effectivement aligné qui n'y figure plus (Trois-quart à quota
 * réduit baké dans le gel d'une feuille antérieure). Sans ce complément, le
 * picker afficherait un poste absent de sa liste.
 */
export function withFrozenLegacyOptions(
  options: readonly JourneymanPositionOption[],
  journeymen: readonly SheetJourneyman[],
): JourneymanPositionOption[] {
  const out = [...options];
  const prefix = `${FROZEN_JOURNEYMAN_POSITION_PREFIX} (`;
  for (const j of journeymen) {
    if (out.some((o) => o.slug === j.position)) continue;
    if (!j.positionName.startsWith(prefix)) continue;
    out.push({
      slug: j.position,
      name: j.positionName.slice(prefix.length, -1),
    });
  }
  return out;
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
  /** L'évolution stagée a été prise (PSP du match suffisants). */
  readonly advancementTaken: boolean;
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
      advancementTaken: false,
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
    advancementTaken: true,
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
    // Mêmes bornes BB2025 (MA ≤ 9, ST ≤ 5, AV ≤ 11, AG/PA ≥ 1) que pour un
    // joueur du roster : un journalier recruté ne dépasse jamais la limite.
    stats:
      isCharacteristic && adv.stat
        ? applyCharacteristicImprovement(journeyman.stats, adv.stat)
        : journeyman.stats,
  };
}
