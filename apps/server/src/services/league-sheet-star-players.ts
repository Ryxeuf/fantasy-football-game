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
import { isJourneymanId } from "./league-sheet-journeymen";

export const STAR_PLAYER_ID_PREFIX = "star-";

/** Un id de joueur synthétique « Star Player » de feuille de match. */
export function isSheetStarPlayerId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(STAR_PLAYER_ID_PREFIX);
}

/**
 * Un id de joueur SYNTHÉTIQUE de la feuille (journalier ou Star Player) :
 * visible sur la feuille, jamais persisté sur le roster.
 */
export function isSyntheticSheetPlayerId(
  id: string | null | undefined,
): boolean {
  return isJourneymanId(id) || isSheetStarPlayerId(id);
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

/**
 * Dérive les Star Players alignés d'un côté depuis les coups de pouce
 * saisis. Chaque fiche est lue en base (source de vérité du catalogue) ;
 * une fiche introuvable retombe sur les seules données de la sélection
 * (nom + coût) avec des caractéristiques neutres, pour que le joueur reste
 * sélectionnable dans les évènements.
 */
export async function deriveSheetStarPlayers(input: {
  readonly side: "home" | "away";
  readonly inducements: unknown;
  readonly ruleset?: string;
}): Promise<SheetStarPlayer[]> {
  const selections = parseStarPlayerInducements(input.inducements);
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
    });
  }
  return out;
}
