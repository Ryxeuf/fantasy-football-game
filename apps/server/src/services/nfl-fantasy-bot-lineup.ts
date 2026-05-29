/**
 * Service NFL Fantasy Bot Lineup — helper "mode test".
 *
 * Genere automatiquement les lineups des coachs de test (tous sauf
 * `excludeEntryId`, generalement l'owner qui veut configurer sa
 * lineup manuellement). Permet de derouler une saison sans avoir a
 * cliquer dans 9 entries differentes chaque semaine.
 *
 * Strategie de selection :
 *   - Top 11 starters par currentValue desc (les meilleures cotes)
 *   - Tiebreak : pseudonym asc (deterministe)
 *   - Captain : #1 currentValue (max ROI ×1.5)
 *   - Vice    : #2 currentValue (×1.2)
 *
 * Idempotent : reutilise setLineup qui fait un upsert. Skip les
 * lineups deja locked (erreur LINEUP_LOCKED catchee, comptee).
 */

import { prisma } from "../prisma";
import {
  NflFantasyLineupError,
  setLineup,
  DEFAULT_STARTERS_COUNT,
} from "./nfl-fantasy-lineup";

export interface AutoFillTestLineupsOpts {
  readonly leagueId: string;
  readonly weekId: string;
  /** Entry a exclure (typiquement l'owner). Null = toutes les entries. */
  readonly excludeEntryId: string | null;
}

export interface AutoFillTestLineupsResult {
  readonly lineupsCreated: number;
  readonly lineupsSkippedLocked: number;
  readonly entriesTooSmall: number;
  readonly entriesProcessed: number;
}

interface RosterPick {
  readonly playerId: string;
  readonly bbPosition: string;
  readonly currentValue: number;
  readonly pseudonym: string;
}

/**
 * Pick les top N starters d'un roster. Trie par currentValue desc,
 * tiebreak pseudonym asc pour reproductibilite.
 *
 * Pur.
 */
export function pickTopStarters(
  roster: ReadonlyArray<RosterPick>,
  count: number,
): RosterPick[] {
  const sorted = [...roster].sort((a, b) => {
    if (a.currentValue !== b.currentValue) {
      return b.currentValue - a.currentValue;
    }
    return a.pseudonym.localeCompare(b.pseudonym);
  });
  return sorted.slice(0, count);
}

/**
 * Construit + persiste un default lineup pour une (entry, week) :
 * top 11 par currentValue, captain=#1, vice=#2. Reutilise par
 * `autoFillTestLineups` (mode test) et `ensureDefaultLineupsForWeek`
 * (fallback automatique au lock).
 *
 * Retourne :
 *   - "created"        : lineup creee
 *   - "too-small"      : roster < 11, skip
 *   - "locked-skipped" : lineup deja locked, on respecte le choix
 */
type DefaultLineupOutcome = "created" | "too-small" | "locked-skipped";

async function buildAndSetDefaultLineup(
  entryId: string,
  weekId: string,
): Promise<DefaultLineupOutcome> {
  type RosterRow = {
    playerId: string;
    player: {
      pseudonym: string;
      bbPosition: string;
      currentValue: number;
    } | null;
  };
  const rosterRows: ReadonlyArray<RosterRow> =
    await prisma.nflFantasyRoster.findMany({
      where: { entryId },
      select: {
        playerId: true,
        player: {
          select: {
            pseudonym: true,
            bbPosition: true,
            currentValue: true,
          },
        },
      },
    });

  const picks: RosterPick[] = rosterRows
    .filter((r): r is RosterRow & { player: NonNullable<RosterRow["player"]> } =>
      r.player !== null,
    )
    .map((r) => ({
      playerId: r.playerId,
      bbPosition: r.player.bbPosition,
      currentValue: r.player.currentValue,
      pseudonym: r.player.pseudonym,
    }));

  if (picks.length < DEFAULT_STARTERS_COUNT) {
    return "too-small";
  }

  const top = pickTopStarters(picks, DEFAULT_STARTERS_COUNT);
  try {
    await setLineup({
      entryId,
      weekId,
      starters: top.map((s) => ({
        playerId: s.playerId,
        bbPosition: s.bbPosition,
      })),
      captainId: top[0].playerId,
      viceCaptainId: top[1]?.playerId ?? null,
    });
    return "created";
  } catch (err) {
    if (err instanceof NflFantasyLineupError && err.code === "LINEUP_LOCKED") {
      return "locked-skipped";
    }
    throw err;
  }
}

export async function autoFillTestLineups(
  opts: AutoFillTestLineupsOpts,
): Promise<AutoFillTestLineupsResult> {
  const entries: ReadonlyArray<{ id: string }> = await prisma.nflFantasyEntry.findMany({
    where: {
      leagueId: opts.leagueId,
      ...(opts.excludeEntryId ? { id: { not: opts.excludeEntryId } } : {}),
    },
    select: { id: true },
  });

  let lineupsCreated = 0;
  let lineupsSkippedLocked = 0;
  let entriesTooSmall = 0;

  for (const e of entries) {
    const outcome = await buildAndSetDefaultLineup(e.id, opts.weekId);
    if (outcome === "created") lineupsCreated += 1;
    else if (outcome === "too-small") entriesTooSmall += 1;
    else if (outcome === "locked-skipped") lineupsSkippedLocked += 1;
  }

  return {
    lineupsCreated,
    lineupsSkippedLocked,
    entriesTooSmall,
    entriesProcessed: entries.length,
  };
}

// ────────────────────────────────────────────────────────────────────
// Fallback auto au moment du lock : tout coach qui n'a pas configure
// de lineup recupere un default (top 11 par cote), pour ne pas se
// retrouver avec 0 SPP sur la semaine.
// ────────────────────────────────────────────────────────────────────

export interface EnsureDefaultLineupsResult {
  readonly defaultsCreated: number;
  readonly defaultsTooSmall: number;
  readonly entriesScanned: number;
}

/**
 * Pour la semaine donnee, scanne les entries des leagues `in_progress`
 * qui n'ont pas encore de lineup et genere un default (top 11 par
 * currentValue). Idempotent : les entries deja munies d'une lineup
 * (lockee ou non) sont preservees -- le choix manuel du coach gagne
 * toujours.
 *
 * Appele par `lockLineups` juste avant l'updateMany du lock, pour
 * que le settle de la semaine ne donne pas 0 SPP a un coach
 * distrait.
 */
export async function ensureDefaultLineupsForWeek(
  weekId: string,
): Promise<EnsureDefaultLineupsResult> {
  const entries: ReadonlyArray<{ id: string }> =
    await prisma.nflFantasyEntry.findMany({
      where: {
        league: { status: "in_progress" },
        lineups: { none: { weekId } },
      },
      select: { id: true },
    });

  let defaultsCreated = 0;
  let defaultsTooSmall = 0;

  for (const e of entries) {
    const outcome = await buildAndSetDefaultLineup(e.id, weekId);
    if (outcome === "created") defaultsCreated += 1;
    else if (outcome === "too-small") defaultsTooSmall += 1;
    // "locked-skipped" impossible ici (on filtre deja les entries
    // sans lineup), mais le helper le gere gracieusement.
  }

  return {
    defaultsCreated,
    defaultsTooSmall,
    entriesScanned: entries.length,
  };
}
