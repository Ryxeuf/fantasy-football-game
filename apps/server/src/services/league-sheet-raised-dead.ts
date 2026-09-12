/**
 * Joueur RELEVÉ pendant le match — « Relever le Mort » (Maîtres de la
 * Non-vie) et Trait « Contagieux » (Nurgle) sur la feuille de match.
 *
 * Deux règles font naître un Trois-quart de la fiche d'équipe PENDANT le
 * match, quand un adversaire meurt ; la feuille les porte par UNE seule
 * mécanique, la SOURCE du relevé faisant la différence :
 *
 *  - `masters_of_undeath` — règle spéciale d'équipe (Morts-Vivants : Zombie
 *    OU Squelette ; Horreurs Nécromantiques : Zombie ; Rois des Tombes :
 *    Squelette ; Vampires : Sbire). Une fois par match, si un joueur ADVERSE
 *    de Force 4 ou moins et sans le Trait Minus subit un résultat Mort, quelle
 *    qu'en soit la cause, l'équipe ajoute un Trois-quart à sa réserve. À la
 *    Séquence d'Après Match il est embauché GRATUITEMENT tant que la liste ne
 *    compte pas déjà 16 joueurs — sinon il est perdu — et ajoute quand même sa
 *    valeur pleine à la Valeur d'Équipe.
 *  - `plague_ridden` — Trait « Contagieux » (slug `contagieux` en Saison 3,
 *    `plague-ridden` sur le catalogue antérieur et les Star Players). Une fois
 *    par match, quand un joueur qui a le Trait inflige une Élimination sur une
 *    Action de BLOCAGE et que la victime subit un résultat Mort (non sauvée
 *    par un Apothicaire), l'équipe ajoute un Trois-quart de sa fiche à sa
 *    réserve. Il s'embauche « de la même manière que les Joueurs
 *    Journaliers » : AU PRIX du poste (plus le surcoût de son évolution). Le
 *    Trait ne s'utilise ni contre un Gros Bras, ni contre un joueur ayant
 *    Décomposition, Régénération ou Minus.
 *
 * Le joueur relevé est la TROISIÈME famille de joueurs SYNTHÉTIQUES de la
 * feuille, après les journaliers et les Star Players engagés :
 *  - jamais persisté en `TeamPlayer` tant qu'il n'est pas recruté ;
 *  - id déterministe `raised-<side>-1` (au plus un par côté et par match,
 *    quelle que soit la source), accepté par `LeagueMatchEvent` (pas de FK) :
 *    il joue le match, marque, blesse, peut être Joueur du Match et gagner
 *    des PSP ;
 *  - exclu de la persistance post-match via `isSyntheticSheetPlayerId` ;
 *  - DÉRIVÉ à la lecture depuis le CHOIX stocké sur la feuille
 *    (`LeagueMatchSheet.raisedDeadHome/Away` : `{ victimId, position }`) et
 *    les morts consignés dans les évènements : si la sortie du mort est
 *    retirée (correction de saisie), le relevé disparaît avec elle. La SOURCE
 *    n'est pas stockée : elle se redérive de l'éligibilité de la victime (la
 *    gratuite l'emporte si les deux s'appliquent).
 *
 * Contrairement au journalier, il ne porte PAS Solitaire : c'est un
 * Trois-quart ordinaire de la fiche.
 *
 * Module 100 % PUR : la feuille de match fait toutes les lectures.
 */

import { isBigGuy } from "@bb/game-engine";
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

/** « Force de 4 ou moins » : au-delà, le mort n'est pas relevable (Maîtres). */
export const RAISE_DEAD_MAX_STRENGTH = 4;

/**
 * Règle qui fait naître le joueur relevé. `masters_of_undeath` = règle
 * spéciale d'équipe, embauche gratuite ; `plague_ridden` = Trait Contagieux
 * d'un joueur, embauche au prix du poste.
 */
export type RaiseSource = "masters_of_undeath" | "plague_ridden";

/**
 * « N'ayant pas le Trait Minus » — Minus est le nom français de Stunty (le
 * catalogue de compétences le porte sous le slug `stunty`) ; Microbe
 * (`titchy`) est un autre Trait, qui n'entre pas dans la règle.
 */
const MINUS_TRAIT_SLUG = "stunty";
/** Décomposition (Decay) et Régénération : la victime ne peut être contaminée. */
const DECAY_TRAIT_SLUG = "decay";
const REGENERATION_TRAIT_SLUG = "regeneration";

/**
 * Slugs du Trait « Contagieux ». Le roster Nurgle de Saison 3 le porte sous
 * `contagieux` ; le catalogue antérieur et les Star Players (Guffle Pussmaw)
 * sous `plague-ridden` — la base connaît les deux.
 */
export const PLAGUE_RIDDEN_TRAIT_SLUGS: ReadonlyArray<string> = [
  "contagieux",
  "plague-ridden",
];

/**
 * Causes d'une sortie (`InjuredPlayer.cause` = `causeDetail ?? kind`) qui
 * valent « Élimination sur Action de Blocage ». Un évènement `casualty` sans
 * détail est un blocage ; `self` (forme historique d'une auto-élimination)
 * n'en est pas un.
 */
const BLOCK_CASUALTY_CAUSES: ReadonlySet<string> = new Set([
  "casualty",
  "block",
  "blitz",
]);

/** Mot-clé de position « Gros Bras » (Saison 3), CSV « Lignée, Type ». */
const BIG_GUY_KEYWORD = /gros[\s-]*bras/i;

/** Un id de joueur synthétique « relevé » de feuille de match. */
export function isRaisedDeadId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(RAISED_DEAD_ID_PREFIX);
}

/**
 * Côté qui a relevé le joueur, lu dans son id (`raised-<side>-1`). `null` si
 * l'id n'est pas celui d'un relevé.
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

/** Id du (seul) joueur relevé d'un côté. */
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

/** Le CSV de compétences porte le Trait Contagieux (l'un ou l'autre slug). */
export function hasPlagueRiddenTrait(
  skills: string | null | undefined,
): boolean {
  const slugs = splitSkillCsv(skills).map((s) => s.toLowerCase());
  return PLAGUE_RIDDEN_TRAIT_SLUGS.some((slug) => slugs.includes(slug));
}

/**
 * Sources de relevé dont dispose un côté : la règle spéciale de son roster
 * et/ou un joueur (roster, journalier, Star Player) porteur du Trait
 * Contagieux. La gratuite (Maîtres) vient en premier : c'est celle qu'on
 * préfère quand les deux s'appliquent à la même victime.
 */
export function raiseSourcesFor(input: {
  readonly specialRules: ReadonlyArray<string> | null | undefined;
  readonly players: ReadonlyArray<{ readonly skills: string | null }>;
}): RaiseSource[] {
  const out: RaiseSource[] = [];
  if (hasMastersOfUndeath(input.specialRules)) out.push("masters_of_undeath");
  if (input.players.some((p) => hasPlagueRiddenTrait(p.skills))) {
    out.push("plague_ridden");
  }
  return out;
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
 * Joueur de la feuille tel que les règles doivent le lire : roster réel,
 * journalier ou Star Player — de l'un ou l'autre côté (victime possible chez
 * l'adversaire, auteur possible d'un blocage chez soi).
 */
export interface RaiseVictimSource {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly positionName: string;
  readonly stats: { readonly st: number };
  readonly skills: string | null;
  /**
   * Mots-clés du poste (CSV « Lignée, Type », ex: « Rejeton, Gros Bras »),
   * lus en base ou dans le catalogue ; `null`/absent quand inconnus — on
   * retombe alors sur l'heuristique du moteur (Solitaire = Gros Bras).
   */
  readonly keywords?: string | null;
}

/** Un adversaire tué ce match qu'une règle permet de relever. */
export interface RaiseVictimCandidate {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly positionName: string;
  /** Règle qui le rend relevable (la gratuite si les deux s'appliquent). */
  readonly source: RaiseSource;
}

/**
 * « On ne peut pas utiliser ce Trait contre des joueurs Gros Bras » : le
 * Mot-clé de poste fait foi quand il est connu ; sinon l'heuristique du
 * moteur (`isBigGuy` : Solitaire), qui ne s'applique donc jamais à un Star
 * Player — sa table de mots-clés est toujours connue.
 */
export function isBigGuyVictim(
  victim: Pick<RaiseVictimSource, "keywords" | "skills">,
): boolean {
  if (typeof victim.keywords === "string") {
    return BIG_GUY_KEYWORD.test(victim.keywords);
  }
  return isBigGuy({ skills: victim.skills ?? "" });
}

/** Blessure du résumé de la feuille, telle que l'éligibilité la lit. */
export interface RaiseInjury {
  readonly playerId: string;
  readonly severity: string;
  /** Côté de la VICTIME. */
  readonly side: "home" | "away";
  /** Cause de la sortie (`causeDetail ?? kind`) ; absent = inconnue. */
  readonly cause?: string | null;
  /** Adversaire qui a infligé la sortie, `null` sans auteur (foule, chute). */
  readonly causedByPlayerId?: string | null;
}

/**
 * Adversaires RELEVABLES par le côté `side` : tués pendant ce match (résultat
 * Mort consigné dans les évènements, côté opposé) et acceptés par au moins
 * une des sources du côté :
 *  - Maîtres de la Non-vie : Force ≤ 4, sans Minus, quelle que soit la cause ;
 *  - Contagieux : sortie infligée sur un BLOCAGE par un joueur du côté qui a
 *    le Trait, victime ni Gros Bras, ni Décomposition, ni Régénération, ni
 *    Minus.
 * L'ordre est celui de la liste adverse (numéro de maillot). Sans `sources`,
 * seule la règle Maîtres est jouée (compatibilité des appelants).
 */
export function eligibleRaiseVictims(input: {
  readonly side: "home" | "away";
  /** `summary.injuries` de la feuille. */
  readonly injuries: ReadonlyArray<RaiseInjury>;
  /** Joueurs du côté ADVERSE (roster, journaliers, Star Players). */
  readonly opponents: ReadonlyArray<RaiseVictimSource>;
  /** Sources dont dispose le côté (cf. `raiseSourcesFor`). */
  readonly sources?: ReadonlyArray<RaiseSource>;
  /** Joueurs du côté qui relève : auteurs possibles d'un blocage contagieux. */
  readonly own?: ReadonlyArray<RaiseVictimSource>;
}): RaiseVictimCandidate[] {
  const sources = input.sources ?? ["masters_of_undeath"];
  const canRaise = sources.includes("masters_of_undeath");
  const canInfect = sources.includes("plague_ridden");
  if (!canRaise && !canInfect) return [];

  const deaths = new Map<string, RaiseInjury[]>();
  for (const inj of input.injuries) {
    if (inj.severity !== "dead" || inj.side === input.side) continue;
    const list = deaths.get(inj.playerId);
    if (list) list.push(inj);
    else deaths.set(inj.playerId, [inj]);
  }
  if (deaths.size === 0) return [];

  const carriers = new Set(
    (input.own ?? [])
      .filter((p) => hasPlagueRiddenTrait(p.skills))
      .map((p) => p.id),
  );
  const out: RaiseVictimCandidate[] = [];
  const seen = new Set<string>();
  for (const p of input.opponents) {
    const injuries = deaths.get(p.id);
    if (!injuries || seen.has(p.id)) continue;
    const skills = splitSkillCsv(p.skills).map((s) => s.toLowerCase());
    const minus = skills.includes(MINUS_TRAIT_SLUG);

    const byMasters =
      canRaise && p.stats.st <= RAISE_DEAD_MAX_STRENGTH && !minus;
    const byPlague =
      canInfect &&
      !minus &&
      !skills.includes(DECAY_TRAIT_SLUG) &&
      !skills.includes(REGENERATION_TRAIT_SLUG) &&
      !isBigGuyVictim(p) &&
      injuries.some(
        (inj) =>
          BLOCK_CASUALTY_CAUSES.has(inj.cause ?? "") &&
          !!inj.causedByPlayerId &&
          carriers.has(inj.causedByPlayerId),
      );
    if (!byMasters && !byPlague) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      number: p.number,
      name: p.name,
      positionName: p.positionName,
      source: byMasters ? "masters_of_undeath" : "plague_ridden",
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
  /** Valeur du poste (po) : c'est ce qu'il ajoute à la Valeur d'Équipe. */
  readonly cost: number;
  /** Adversaire relevé (id de feuille). */
  readonly victimId: string;
  /** Règle qui l'a fait naître. */
  readonly source: RaiseSource;
  /**
   * Prix de l'embauche d'après-match (po), hors surcoût d'évolution : 0 pour
   * un mort relevé (Maîtres de la Non-vie), le prix du poste pour un
   * Contaminé (« de la même manière que les Joueurs Journaliers »).
   */
  readonly hireCost: number;
}

/** Libellé de poste d'un mort relevé (Maîtres) : « Mort relevé (<poste>) ». */
export const RAISED_DEAD_POSITION_PREFIX = "Mort relevé";
/** Libellé de poste d'une recrue contagieuse : « Contaminé (<poste>) ». */
export const PLAGUE_RIDDEN_POSITION_PREFIX = "Contaminé";

/** Préfixe du libellé de poste selon la règle. */
export function raisedDeadPositionPrefix(source: RaiseSource): string {
  return source === "plague_ridden"
    ? PLAGUE_RIDDEN_POSITION_PREFIX
    : RAISED_DEAD_POSITION_PREFIX;
}

/** L'embauche d'après-match est gratuite (Maîtres) ou au prix du poste. */
export function isFreeRaise(source: RaiseSource): boolean {
  return source === "masters_of_undeath";
}

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
 * Postes de Trois-quart que les règles permettent de relever : les mêmes
 * que ceux d'un journalier (0-12 ou plus, ou Mot-clé « Trois-quart »), le
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
 * un mort relevable (évènement de sortie retiré, gravité corrigée, auteur du
 * blocage changé).
 *
 * Le poste choisi doit être un Trois-quart du roster ; sinon (rang inconnu,
 * slug renommé) on retombe sur le Trois-quart de base, comme un journalier.
 * La SOURCE est celle de la victime : elle fixe le libellé et le prix de
 * l'embauche.
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
  const cost = position ? position.cost * 1000 : FALLBACK_COST;
  const prefix = raisedDeadPositionPrefix(victim.source);

  return {
    id: raisedDeadIdFor(input.side),
    number,
    name: victim.name,
    position: position?.slug ?? slug ?? "raised_dead",
    positionName: position ? `${prefix} (${position.displayName})` : prefix,
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
    cost,
    victimId: victim.id,
    source: victim.source,
    hireCost: isFreeRaise(victim.source) ? 0 : cost,
  };
}

/**
 * « Tant que votre Liste d'Équipe ne compte pas déjà 16 joueurs, sinon il est
 * perdu » (Maîtres) — et un journalier ne s'embauche pas non plus au-delà de
 * la liste (Contagieux) : l'effectif compté est le roster ACTIF au moment des
 * embauches — les morts de ce match en sont déjà retirés (le livre les sort
 * en premier).
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
   * de l'évolution prise à l'étape 3. Égale au COÛT pour un Contaminé,
   * distincte pour un mort relevé (gratuit).
   */
  readonly value: number;
}

/**
 * Recrutement (pur) d'un joueur relevé à l'étape EMBAUCHES. Le joueur garde
 * ses PSP du match et l'évolution éventuellement prise à l'étape 3, et sa
 * valeur pleine entre dans la Valeur d'Équipe. Même moteur que le journalier
 * (`buildJourneymanHire`) : au prix du poste pour un Contaminé, GRATUIT pour
 * un mort relevé par Maîtres de la Non-vie.
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
  return {
    ...hire,
    value: hire.cost,
    cost: isFreeRaise(input.raised.source) ? 0 : hire.cost,
  };
}
