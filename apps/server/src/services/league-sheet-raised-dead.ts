/**
 * Maîtres de la Non-vie — « Relever le Mort » sur la feuille de match.
 *
 * Règle (Saison 3, règles spéciales d'équipe) : une fois par match, si un
 * joueur ADVERSE ayant une Force de 4 ou moins et n'ayant pas le Trait Minus
 * subit un résultat Mort sur le Tableau d'Élimination, une équipe avec cette
 * règle spéciale peut Relever le Mort : elle ajoute immédiatement UN joueur
 * Trois-quart de sa Fiche d'Équipe à son Box des Réserves (l'équipe peut
 * temporairement dépasser 16 joueurs). À la Séquence d'Après Match, ce
 * Trois-quart peut être embauché de façon permanente et GRATUITEMENT, tant
 * que la Liste d'Équipe ne compte pas déjà 16 joueurs — sinon il est perdu.
 * Le joueur ajoute quand même sa valeur totale à la Valeur d'Équipe.
 *
 * Quatre rosters portent la règle : Morts-Vivants (Zombie OU Squelette),
 * Horreurs Nécromantiques (Zombie), Rois des Tombes (Squelette), Vampires
 * (Sbire).
 *
 * Le mort relevé est la TROISIÈME famille de joueurs SYNTHÉTIQUES de la
 * feuille, après les journaliers et les Star Players engagés :
 *  - jamais persisté en `TeamPlayer` tant qu'il n'est pas recruté ;
 *  - id déterministe `raised-<side>-1` (au plus un par côté et par match),
 *    accepté par `LeagueMatchEvent` (pas de FK) : il joue le match, marque,
 *    blesse, peut être Joueur du Match et gagner des PSP ;
 *  - exclu de la persistance post-match via `isSyntheticSheetPlayerId` ;
 *  - DÉRIVÉ à la lecture depuis le CHOIX stocké sur la feuille
 *    (`LeagueMatchSheet.raisedDeadHome/Away` : `{ victimId, position }`)
 *    et les morts consignés dans les évènements : si la sortie du mort est
 *    retirée (correction de saisie), le relevé disparaît avec elle.
 *
 * Contrairement au journalier, il ne porte PAS Solitaire : c'est un
 * Trois-quart ordinaire de la fiche, et son recrutement est gratuit
 * (`buildRaisedDeadHire` : coût 0, valeur pleine).
 *
 * Module 100 % PUR : la feuille de match fait toutes les lectures.
 */

import {
  buildJourneymanHire,
  linemanPositionsForRoster,
  rosterPositions,
  splitSkillCsv,
  type JourneymanHire,
  type JourneymanHireInput,
  type JourneymanPositionOption,
  type JourneymanSourcePosition,
} from "./league-sheet-journeymen";

export const RAISED_DEAD_ID_PREFIX = "raised-";

/** Slug de la règle spéciale d'équipe (catalogue `TEAM_SPECIAL_RULES`). */
export const MASTERS_OF_UNDEATH_RULE = "maitres_de_la_non_vie";

/** « Force de 4 ou moins » : au-delà, le mort n'est pas relevable. */
export const RAISE_DEAD_MAX_STRENGTH = 4;

/**
 * « N'ayant pas le Trait Minus » — Minus est le nom français de Stunty (le
 * catalogue de compétences le porte sous le slug `stunty`) ; Microbe
 * (`titchy`) est un autre Trait, qui n'entre pas dans la règle.
 */
const MINUS_TRAIT_SLUG = "stunty";

/** Un id de joueur synthétique « mort relevé » de feuille de match. */
export function isRaisedDeadId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(RAISED_DEAD_ID_PREFIX);
}

/**
 * Côté qui a relevé le mort, lu dans son id (`raised-<side>-1`). `null` si
 * l'id n'est pas celui d'un mort relevé.
 */
export function raisedDeadSide(
  id: string | null | undefined,
): "home" | "away" | null {
  if (!isRaisedDeadId(id)) return null;
  const rest = (id as string).slice(RAISED_DEAD_ID_PREFIX.length);
  if (rest.startsWith("home-")) return "home";
  if (rest.startsWith("away-")) return "away";
  return null;
}

/** Id du (seul) mort relevé d'un côté. */
export function raisedDeadIdFor(side: "home" | "away"): string {
  return `${RAISED_DEAD_ID_PREFIX}${side}-1`;
}

/** L'équipe porte la règle spéciale Maîtres de la Non-vie. */
export function hasMastersOfUndeath(
  specialRules: ReadonlyArray<string> | null | undefined,
): boolean {
  return (specialRules ?? []).some(
    (rule) => rule.trim() === MASTERS_OF_UNDEATH_RULE,
  );
}

/**
 * Choix stocké sur la feuille (`raisedDeadHome/Away`) : l'adversaire relevé
 * et, quand la fiche offre plusieurs Trois-quarts (Morts-Vivants : Zombie ou
 * Squelette), le poste choisi. `position: null` = Trois-quart de base.
 */
export interface RaisedDeadChoice {
  readonly victimId: string;
  readonly position: string | null;
}

/**
 * Parse tolérant du choix stocké — objet natif (PG), chaîne JSON (miroir
 * sqlite) ou null. Une entrée sans `victimId` exploitable vaut « pas relevé ».
 */
export function parseRaisedDeadChoice(raw: unknown): RaisedDeadChoice | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as { victimId?: unknown; position?: unknown };
  if (typeof o.victimId !== "string" || o.victimId.length === 0) return null;
  return {
    victimId: o.victimId,
    position:
      typeof o.position === "string" && o.position.length > 0
        ? o.position
        : null,
  };
}

/**
 * Joueur de la feuille tel que la règle doit le lire pour juger s'il est
 * relevable : roster réel, journalier ou Star Player du côté ADVERSE.
 */
export interface RaiseVictimSource {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly positionName: string;
  readonly stats: { readonly st: number };
  readonly skills: string | null;
}

/** Un adversaire tué ce match que la règle permet de relever. */
export interface RaiseVictimCandidate {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly positionName: string;
}

/**
 * Adversaires RELEVABLES par le côté `side` : tués pendant ce match (résultat
 * Mort consigné dans les évènements, côté opposé), Force ≤ 4 et sans le Trait
 * Minus. L'ordre est celui de la liste adverse (numéro de maillot).
 */
export function eligibleRaiseVictims(input: {
  readonly side: "home" | "away";
  /** `summary.injuries` de la feuille (victime, gravité, côté de la victime). */
  readonly injuries: ReadonlyArray<{
    readonly playerId: string;
    readonly severity: string;
    readonly side: "home" | "away";
  }>;
  /** Joueurs du côté ADVERSE (roster, journaliers, Star Players). */
  readonly opponents: ReadonlyArray<RaiseVictimSource>;
}): RaiseVictimCandidate[] {
  const dead = new Set<string>();
  for (const inj of input.injuries) {
    if (inj.severity === "dead" && inj.side !== input.side) {
      dead.add(inj.playerId);
    }
  }
  if (dead.size === 0) return [];
  const out: RaiseVictimCandidate[] = [];
  const seen = new Set<string>();
  for (const p of input.opponents) {
    if (!dead.has(p.id) || seen.has(p.id)) continue;
    if (p.stats.st > RAISE_DEAD_MAX_STRENGTH) continue;
    const skills = splitSkillCsv(p.skills).map((s) => s.toLowerCase());
    if (skills.includes(MINUS_TRAIT_SLUG)) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      number: p.number,
      name: p.name,
      positionName: p.positionName,
    });
  }
  return out;
}

/** Trois-quart relevé, exposé à l'UI comme un joueur de la feuille. */
export interface SheetRaisedDead {
  readonly id: string;
  readonly number: number;
  /** Le mort garde son nom : il a juste changé de maillot. */
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
  /** CSV de slugs : compétences du poste, SANS Solitaire. */
  readonly skills: string;
  /** Valeur du poste (po) : pleine valeur d'équipe, recrutement gratuit. */
  readonly cost: number;
  /** Adversaire relevé (id de feuille). */
  readonly victimId: string;
}

/** Libellé de poste d'un mort relevé : « Mort relevé (<poste>) ». */
export const RAISED_DEAD_POSITION_PREFIX = "Mort relevé";

/** Fallback quand le poste est inconnu : Trois-quart Zombie standard. */
const FALLBACK_STATS = { ma: 4, st: 3, ag: 4, pa: null, av: 9 } as const;
const FALLBACK_COST = 40_000;

export interface DeriveRaisedDeadInput {
  readonly side: "home" | "away";
  readonly roster: string;
  readonly ruleset?: string;
  /** Postes du roster lus EN BASE ; absents/vides ⇒ catalogue compilé. */
  readonly positions?: readonly JourneymanSourcePosition[] | null;
  /** Choix stocké sur la feuille (null = pas relevé). */
  readonly choice: RaisedDeadChoice | null;
  /** Adversaires relevables (cf. `eligibleRaiseVictims`). */
  readonly victims: readonly RaiseVictimCandidate[];
  /** Numéros déjà portés de ce côté (roster + journaliers) : le relevé prend le suivant. */
  readonly takenNumbers: readonly number[];
}

/**
 * Postes de Trois-quart que la règle permet de relever : les mêmes que
 * ceux d'un journalier (0-12 ou plus, ou Mot-clé « Trois-quart »), le
 * Trois-quart de base en premier.
 */
export function raisedDeadPositionOptions(
  roster: string,
  ruleset?: string,
  positions?: readonly JourneymanSourcePosition[] | null,
): JourneymanPositionOption[] {
  return linemanPositionsForRoster(roster, ruleset, positions);
}

/**
 * Dérive (pur, déterministe) le Trois-quart relevé d'un côté, ou `null`
 * quand rien n'est relevé — pas de choix, ou un choix qui ne désigne plus
 * un mort relevable (évènement de sortie retiré, gravité corrigée).
 *
 * Le poste choisi doit être un Trois-quart du roster ; sinon (rang inconnu,
 * slug renommé) on retombe sur le Trois-quart de base, comme un journalier.
 */
export function deriveRaisedDead(
  input: DeriveRaisedDeadInput,
): SheetRaisedDead | null {
  const { choice } = input;
  if (!choice) return null;
  const victim = input.victims.find((v) => v.id === choice.victimId);
  if (!victim) return null;

  const options = raisedDeadPositionOptions(
    input.roster,
    input.ruleset,
    input.positions,
  );
  const slug =
    choice.position && options.some((o) => o.slug === choice.position)
      ? choice.position
      : (options[0]?.slug ?? null);
  const position = rosterPositions(
    input.roster,
    input.ruleset,
    input.positions,
  ).find((p) => p.slug === slug);
  const number = input.takenNumbers.reduce((m, n) => Math.max(m, n), 0) + 1;

  return {
    id: raisedDeadIdFor(input.side),
    number,
    name: victim.name,
    position: position?.slug ?? slug ?? "raised_dead",
    positionName: position
      ? `${RAISED_DEAD_POSITION_PREFIX} (${position.displayName})`
      : RAISED_DEAD_POSITION_PREFIX,
    stats: position
      ? {
          ma: position.ma,
          st: position.st,
          ag: position.ag,
          pa: position.pa,
          av: position.av,
        }
      : FALLBACK_STATS,
    // Compétences du poste, telles quelles : pas de Solitaire (ce n'est pas
    // un journalier).
    skills: splitSkillCsv(position?.skills).join(","),
    cost: position ? position.cost * 1000 : FALLBACK_COST,
    victimId: victim.id,
  };
}

/**
 * « Tant que votre Liste d'Équipe ne compte pas déjà 16 joueurs, sinon il est
 * perdu » : l'effectif compté est le roster ACTIF au moment des embauches —
 * les morts de ce match en sont déjà retirés (le livre les sort en premier).
 */
export function canHireRaisedDead(input: {
  readonly activePlayerCount: number;
  readonly maxPlayers: number;
}): boolean {
  return input.activePlayerCount < input.maxPlayers;
}

export interface RaisedDeadHire extends JourneymanHire {
  /**
   * Valeur (po) que le joueur ajoute à la Valeur d'Équipe : poste + surcoût
   * de l'évolution prise à l'étape 3. Distincte du COÛT, qui est nul.
   */
  readonly value: number;
}

/**
 * Recrutement (pur) d'un mort relevé à l'étape EMBAUCHES : GRATUIT, mais le
 * joueur garde ses PSP du match et l'évolution éventuellement prise à
 * l'étape 3, et sa valeur pleine entre dans la Valeur d'Équipe. Même moteur
 * que le journalier (`buildJourneymanHire`), le prix en moins.
 */
export function buildRaisedDeadHire(input: {
  readonly raised: SheetRaisedDead;
  readonly earnedSpp: number;
  readonly advancement?: JourneymanHireInput["advancement"];
}): RaisedDeadHire {
  const hire = buildJourneymanHire({
    journeyman: input.raised,
    earnedSpp: input.earnedSpp,
    advancement: input.advancement ?? null,
  });
  return { ...hire, value: hire.cost, cost: 0 };
}
