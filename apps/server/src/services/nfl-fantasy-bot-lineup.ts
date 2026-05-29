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
        where: { entryId: e.id },
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
      entriesTooSmall += 1;
      continue;
    }

    const top = pickTopStarters(picks, DEFAULT_STARTERS_COUNT);
    const captainId = top[0].playerId;
    const viceCaptainId = top[1]?.playerId ?? null;

    try {
      await setLineup({
        entryId: e.id,
        weekId: opts.weekId,
        starters: top.map((s) => ({
          playerId: s.playerId,
          bbPosition: s.bbPosition,
        })),
        captainId,
        viceCaptainId,
      });
      lineupsCreated += 1;
    } catch (err) {
      if (
        err instanceof NflFantasyLineupError &&
        err.code === "LINEUP_LOCKED"
      ) {
        lineupsSkippedLocked += 1;
        continue;
      }
      throw err;
    }
  }

  return {
    lineupsCreated,
    lineupsSkippedLocked,
    entriesTooSmall,
    entriesProcessed: entries.length,
  };
}
