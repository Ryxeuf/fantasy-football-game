/**
 * Star Players engagés en coup de pouce sur une feuille de match de ligue.
 *
 * Un Star Player recruté à l'avant-match JOUE la rencontre : il peut marquer,
 * blesser, être blessé, être Joueur du Match. Il doit donc figurer dans les
 * pickers d'acteur / de cible des évènements — au même titre qu'un journalier.
 *
 * Comme les journaliers, ce sont des joueurs SYNTHÉTIQUES de la feuille :
 *  - jamais persistés en `TeamPlayer` (ils quittent l'équipe après le match) ;
 *  - id déterministe `star-<side>-<slug>` — accepté par les LeagueMatchEvent
 *    (pas de FK sur actorPlayerId/targetPlayerId) ;
 *  - exclus de la persistance post-match (SPP, blessures, licenciements…) via
 *    `isSyntheticSheetPlayerId`.
 *
 * Leur valeur n'entre PAS dans la VEA du match : le coût du Star Player est
 * déjà payé en coup de pouce (petty cash / trésorerie).
 */

import { getStarPlayerBySlugDb } from "../utils/star-player-repository";
import { DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import { isJourneymanId, journeymanSide } from "./league-sheet-journeymen";
import { isRaisedDeadId, raisedDeadSide } from "./league-sheet-raised-dead";

export const STAR_PLAYER_ID_PREFIX = "star-";

/** Un id de joueur synthétique « Star Player » de feuille de match. */
export function isSheetStarPlayerId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(STAR_PLAYER_ID_PREFIX);
}

/**
 * Côté qui a engagé un Star Player, lu dans son id (`star-<side>-<slug>`).
 * `null` si l'id n'est pas celui d'un Star Player de la feuille.
 */
export function sheetStarPlayerSide(
  id: string | null | undefined,
): "home" | "away" | null {
  if (!isSheetStarPlayerId(id)) return null;
  const rest = (id as string).slice(STAR_PLAYER_ID_PREFIX.length);
  if (rest.startsWith("home-")) return "home";
  if (rest.startsWith("away-")) return "away";
  return null;
}

/**
 * Un id de joueur SYNTHÉTIQUE de la feuille (journalier, Star Player ou mort
 * relevé par Maîtres de la Non-vie) : visible sur la feuille, jamais persisté
 * sur le roster — sauf recrutement explicite à l'étape EMBAUCHES.
 */
export function isSyntheticSheetPlayerId(
  id: string | null | undefined,
): boolean {
  return isJourneymanId(id) || isSheetStarPlayerId(id) || isRaisedDeadId(id);
}

/**
 * Côté d'un joueur SYNTHÉTIQUE de la feuille. Les joueurs réels sont
 * résolus par leur équipe ; les synthétiques n'existant que sur la feuille,
 * leur id est la seule source — c'est ce qui permet de créditer les PSP
 * d'un Joueur du Match sans stat-line à un journalier.
 */
export function syntheticSheetPlayerSide(
  id: string | null | undefined,
): "home" | "away" | null {
  return journeymanSide(id) ?? sheetStarPlayerSide(id) ?? raisedDeadSide(id);
}

/** Star Player aligné, exposé à l'UI comme un joueur de la feuille. */
export interface SheetStarPlayer {
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
  /** CSV de slugs de compétences du Star Player. */
  readonly skills: string;
  /** Slug catalogue (pour retrouver la fiche). */
  readonly slug: string;
  /** Coût payé en coup de pouce (po). */
  readonly cost: number;
  /**
   * `true` pour un Star Player du roster D'INSCRIPTION (coupe) : il a été
   * payé sur le budget de construction, pas sur la feuille.
   */
  readonly registered?: boolean;
}

/** Une sélection de Star Player lue dans `inducementsHome/Away`. */
interface StarSelection {
  readonly slug: string;
  readonly name: string;
  readonly cost: number;
  readonly qty: number;
}

/**
 * Parse tolérant (array PG / string sqlite / null) des coups de pouce d'un
 * côté, filtré sur les Star Players (`slug: "star_player"` +
 * `starPlayerSlug`). Ignore les entrées illisibles et dédoublonne par slug
 * (un même Star Player ne peut être engagé qu'une fois).
 */
export function parseStarPlayerInducements(
  raw: unknown,
): readonly StarSelection[] {
  let arr: unknown = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: StarSelection[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (o.slug !== "star_player") continue;
    const slug = o.starPlayerSlug;
    if (typeof slug !== "string" || slug.length === 0) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      slug,
      name: typeof o.name === "string" && o.name ? o.name : slug,
      cost:
        typeof o.cost === "number" && Number.isFinite(o.cost)
          ? Math.max(0, Math.floor(o.cost))
          : 0,
      qty: 1,
    });
  }
  return out;
}

/**
 * Numéro d'affichage des Star Players : au-delà des 16 numéros de maillot
 * réglementaires, pour ne jamais entrer en collision avec un joueur du
 * roster ni avec un journalier.
 */
const STAR_NUMBER_BASE = 80;

/** Compétition d'une feuille, lue sur sa ligne (`pairingId` XOR `cupPairingId`). */
export type SheetCompetitionKind = "league" | "cup";

/**
 * Compétition d'une feuille de match à partir de sa ligne : une feuille de
 * coupe porte `cupPairingId`. Une ligne partielle (test, objet construit à
 * la main) sans la colonne est lue comme une feuille de ligue.
 */
export function sheetCompetitionKind(sheet: {
  readonly cupPairingId?: unknown;
}): SheetCompetitionKind {
  return typeof sheet.cupPairingId === "string" && sheet.cupPairingId !== ""
    ? "cup"
    : "league";
}

/**
 * Star Players figés dans un roster « version du match » (`RosterSnapshot`
 * sérialisé : objet natif PG ou chaîne du miroir SQLite). Tolérant : toute
 * forme illisible vaut « aucun ». Dédoublonné par slug.
 */
export function parseFrozenStarPlayers(
  raw: unknown,
): readonly StarSelection[] {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const list = (obj as { starPlayers?: unknown }).starPlayers;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: StarSelection[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const slug = o.starPlayerSlug;
    if (typeof slug !== "string" || slug.length === 0 || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    out.push({
      slug,
      name: slug,
      cost:
        typeof o.cost === "number" && Number.isFinite(o.cost)
          ? Math.max(0, Math.floor(o.cost))
          : 0,
      qty: 1,
    });
  }
  return out;
}

/**
 * Slugs des Star Players figés au roster D'INSCRIPTION d'une équipe de
 * coupe (vide en ligue : la « version du match » d'une ligue n'aligne que
 * les Star Players engagés en coup de pouce).
 */
export function registeredStarPlayerSlugs(input: {
  readonly frozenSnapshot?: unknown;
  readonly competitionKind: SheetCompetitionKind;
}): readonly string[] {
  if (input.competitionKind !== "cup") return [];
  return parseFrozenStarPlayers(input.frozenSnapshot).map((s) => s.slug);
}

/**
 * Dérive les Star Players qui JOUENT la rencontre d'un côté. UNE seule
 * dérivation pour tous les chemins de la feuille (lecture, pickers, Haine,
 * relève, noms des actions de coupe) :
 *
 *  - en coupe, ceux du roster figé de la feuille — c'est le roster
 *    d'inscription, donc les Star Players achetés à la création ;
 *  - ceux engagés en coup de pouce d'avant-match.
 *
 * Dédoublonné par slug (un Star Player ne joue qu'une fois par équipe) ;
 * l'id reste `star-<side>-<slug>`, ce qui garde intacts tous les filtres de
 * joueurs synthétiques. Chaque fiche est lue en base (source de vérité du
 * catalogue) ; une fiche introuvable retombe sur les seules données de la
 * sélection (nom + coût) avec des caractéristiques neutres, pour que le
 * joueur reste sélectionnable dans les évènements.
 */
export async function deriveSideStarPlayers(input: {
  readonly side: "home" | "away";
  readonly inducements: unknown;
  readonly ruleset?: string;
  /** Roster « version du match » du côté (colonne `rosterSnapshotHome/Away`). */
  readonly frozenSnapshot?: unknown;
  readonly competitionKind?: SheetCompetitionKind;
}): Promise<SheetStarPlayer[]> {
  const registered =
    input.competitionKind === "cup"
      ? parseFrozenStarPlayers(input.frozenSnapshot)
      : [];
  const registeredSlugs = new Set(registered.map((s) => s.slug));
  const selections = [
    ...registered.map((s) => ({ ...s, registered: true })),
    ...parseStarPlayerInducements(input.inducements)
      .filter((s) => !registeredSlugs.has(s.slug))
      .map((s) => ({ ...s, registered: false })),
  ];
  if (selections.length === 0) return [];
  const ruleset = (input.ruleset as Ruleset) ?? DEFAULT_RULESET;

  const out: SheetStarPlayer[] = [];
  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i];
    let def: Awaited<ReturnType<typeof getStarPlayerBySlugDb>> = null;
    try {
      def = await getStarPlayerBySlugDb(sel.slug, ruleset);
    } catch {
      def = null;
    }
    out.push({
      id: `${STAR_PLAYER_ID_PREFIX}${input.side}-${sel.slug}`,
      number: STAR_NUMBER_BASE + i + 1,
      name: def?.displayName ?? sel.name,
      position: "star_player",
      positionName: "Star Player",
      stats: {
        ma: def?.ma ?? 6,
        st: def?.st ?? 3,
        ag: def?.ag ?? 3,
        pa: def?.pa ?? null,
        av: def?.av ?? 9,
      },
      skills: def?.skills ?? "",
      slug: sel.slug,
      cost: def?.cost ?? sel.cost,
      ...(sel.registered ? { registered: true } : {}),
    });
  }
  return out;
}

/**
 * Star Players engagés en coup de pouce sur la feuille, sans roster figé
 * (variante historique de `deriveSideStarPlayers`, conservée pour ses
 * appelants hors feuille).
 */
export async function deriveSheetStarPlayers(input: {
  readonly side: "home" | "away";
  readonly inducements: unknown;
  readonly ruleset?: string;
}): Promise<SheetStarPlayer[]> {
  return deriveSideStarPlayers(input);
}
