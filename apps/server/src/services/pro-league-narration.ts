/**
 * Lot 3.E.4 — narration text d'un match Pro League pour la review admin.
 *
 * Réutilise le `narrateMatch()` du sim-engine (Lot 0.E.2, enrichi
 * 3.A.4 avec `rosters`) pour produire un texte humain-lisible des
 * events d'un match `completed`. Le service charge :
 *
 *   1. `ProLeagueMatch` (status + meta équipe)
 *   2. `Replay.payload` → `events[]` via `decompressEvents`
 *   3. `ProTeamRoster` des deux équipes → `SimRosterPlayer[]`
 *
 * Puis il reconstruit un `SimResult` partiel (events + summary
 * minimal + engineVer extrait du `KICKOFF` event) et appelle le
 * narrator avec le mapping roster pour produire des lignes du type :
 *
 *   [T+00:15] Vraskar (#3 Lineman) avance de (5,7) à (7,7)
 *
 * Si les events ne portent pas de `playerId` correspondant aux
 * `ProTeamRoster.id` (cas matches simulés sans `SimInput.roster`
 * — sim hybrid driver ou pré-Lot 3.A.2.c), le narrator retombe sur
 * l'id brut. Le texte reste utile pour debug même dégradé.
 *
 * Erreurs (sous-classe `NarrationError`) :
 *   - `MATCH_NOT_FOUND` (404) — id inconnu
 *   - `MATCH_NOT_REPLAYABLE` (409) — status != 'completed'
 *   - `REPLAY_NOT_FOUND` (404) — pas de replay associé
 */

import { decompressEvents, narrateMatch } from "@bb/sim-engine";
import type { SimRosterPlayer, SimResult } from "@bb/sim-engine";
import type { MatchEvent } from "@bb/shared-types";

import { prisma } from "../prisma";

export class NarrationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "NarrationError";
  }
}

export interface MatchNarration {
  readonly matchId: string;
  readonly status: string;
  readonly narration: string;
  readonly engineVer: string;
  readonly eventCount: number;
  readonly rosterCount: { home: number; away: number };
}

interface RawRoster {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: unknown;
}

function parseSkills(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toSimRosterPlayers(
  raws: readonly RawRoster[],
): readonly SimRosterPlayer[] {
  return raws.map((r, idx) => ({
    id: r.id,
    // BB jersey numbers traditionnellement 1..16 ; on suit l'ordre
    // d'insertion du roster pour stabilité (le DB ne stocke pas un
    // numéro de jersey explicite).
    number: idx + 1,
    name: r.name,
    position: r.position,
    ma: r.ma,
    st: r.st,
    ag: r.ag,
    pa: r.pa ?? 0,
    av: r.av,
    skills: parseSkills(r.skills),
  }));
}

function reconstructResult(
  events: readonly MatchEvent[],
  match: { scoreHome: number | null; scoreAway: number | null },
): SimResult {
  const kickoff = events.find((e) => e.type === "KICKOFF");
  const engineVer = kickoff?.engineVer ?? "unknown";
  const home = match.scoreHome ?? 0;
  const away = match.scoreAway ?? 0;
  const outcome = home > away ? "home" : away > home ? "away" : "draw";
  return {
    result: outcome,
    events,
    casualties: [],
    engineVer,
    summary: {
      outcome,
      score: { home, away },
      touchdownCount: home + away,
      turnoverCount: events.filter((e) => e.type === "TURNOVER").length,
      nuffleCount: 0,
      underdogBoostCount: 0,
      durationMs: events[events.length - 1]?.displayAtMs ?? 0,
      momentum: [],
    },
  };
}

export async function getMatchNarration(
  matchId: string,
): Promise<MatchNarration> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      scoreHome: true,
      scoreAway: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  if (!match) {
    throw new NarrationError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (match.status !== "completed") {
    throw new NarrationError(
      "MATCH_NOT_REPLAYABLE",
      `ProLeagueMatch '${matchId}' status='${match.status}' n'est pas narrable (attendu 'completed')`,
    );
  }
  const replay = await prisma.replay.findUnique({
    where: { matchId },
    select: { payload: true },
  });
  if (!replay) {
    throw new NarrationError(
      "REPLAY_NOT_FOUND",
      `Replay pour match '${matchId}' introuvable`,
    );
  }

  const [homeRosterRaw, awayRosterRaw] = await Promise.all([
    prisma.proTeamRoster.findMany({
      where: { teamId: match.homeTeamId as string },
      select: {
        id: true,
        name: true,
        position: true,
        ma: true,
        st: true,
        ag: true,
        pa: true,
        av: true,
        skills: true,
      },
      orderBy: { name: "asc" },
    }) as unknown as RawRoster[],
    prisma.proTeamRoster.findMany({
      where: { teamId: match.awayTeamId as string },
      select: {
        id: true,
        name: true,
        position: true,
        ma: true,
        st: true,
        ag: true,
        pa: true,
        av: true,
        skills: true,
      },
      orderBy: { name: "asc" },
    }) as unknown as RawRoster[],
  ]);

  const homeRoster = toSimRosterPlayers(homeRosterRaw);
  const awayRoster = toSimRosterPlayers(awayRosterRaw);
  const events = await decompressEvents(replay.payload as Buffer);
  const result = reconstructResult(events, {
    scoreHome: match.scoreHome as number | null,
    scoreAway: match.scoreAway as number | null,
  });

  const narration = narrateMatch(result, {
    title: `${match.homeTeam?.name ?? "home"} vs ${match.awayTeam?.name ?? "away"}`,
    rosters: { home: homeRoster, away: awayRoster },
  });

  return {
    matchId,
    status: match.status as string,
    narration,
    engineVer: result.engineVer,
    eventCount: events.length,
    rosterCount: { home: homeRoster.length, away: awayRoster.length },
  };
}
