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
 * Si le roster offre PLUSIEURS postes de lineman, le coach choisit le
 * poste via la feuille (`LeagueMatchSheet.journeymenHome/Away`,
 * `{ position: slug }`). Par défaut : le lineman « de base » (max le
 * plus élevé, puis coût le plus bas).
 */

import {
  TEAM_ROSTERS_BY_RULESET,
  DEFAULT_RULESET,
  type Ruleset,
} from "@bb/game-engine";

export const JOURNEYMAN_ID_PREFIX = "journeyman-";

/** Un id de joueur synthétique « journalier » de feuille de match. */
export function isJourneymanId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(JOURNEYMAN_ID_PREFIX);
}

/** Seuil BB « 0-12 ou plus » : un poste éligible aux journaliers. */
const JOURNEYMAN_ELIGIBLE_MAX = 12;

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
}

interface EnginePosition {
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
}

function rosterPositions(roster: string, ruleset?: string): EnginePosition[] {
  const rs = (ruleset as Ruleset) ?? DEFAULT_RULESET;
  const map = TEAM_ROSTERS_BY_RULESET[rs] ?? TEAM_ROSTERS_BY_RULESET[DEFAULT_RULESET];
  const def = (map as Record<string, { positions?: EnginePosition[] }>)[roster];
  return def?.positions ?? [];
}

/**
 * Postes de type « lineman » du roster (max >= 12), triés par max
 * décroissant puis coût croissant : le premier est le lineman de base.
 */
export function linemanPositionsForRoster(
  roster: string,
  ruleset?: string,
): JourneymanPositionOption[] {
  return rosterPositions(roster, ruleset)
    .filter((p) => p.max >= JOURNEYMAN_ELIGIBLE_MAX)
    .sort((a, b) => b.max - a.max || a.cost - b.cost)
    .map((p) => ({ slug: p.slug, name: p.displayName }));
}

/** Solitaire (4+) — slug du catalogue de compétences. */
const LONER_SLUG = "loner-4";

/** Fallback quand le roster est inconnu du moteur : lineman humain. */
const FALLBACK_STATS = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 } as const;

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
  /** Choix du coach ({ position }) — null/inconnu => lineman de base. */
  readonly chosenPosition?: string | null;
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

  const positions = rosterPositions(input.roster, input.ruleset);
  const linemen = linemanPositionsForRoster(input.roster, input.ruleset);
  const chosenSlug =
    input.chosenPosition &&
    linemen.some((l) => l.slug === input.chosenPosition)
      ? input.chosenPosition
      : linemen[0]?.slug;
  const position = positions.find((p) => p.slug === chosenSlug);

  const baseSkills = (position?.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const skills = [...baseSkills, LONER_SLUG].join(",");
  const maxNumber = input.players.reduce((m, p) => Math.max(m, p.number), 0);

  return Array.from({ length: missing }, (_, i) => ({
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
    skills,
  }));
}

/** Parse tolérant du champ `journeymenHome/Away` ({ position } | null). */
export function parseJourneymenChoice(raw: unknown): string | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const position = (obj as { position?: unknown }).position;
  return typeof position === "string" && position.length > 0 ? position : null;
}
