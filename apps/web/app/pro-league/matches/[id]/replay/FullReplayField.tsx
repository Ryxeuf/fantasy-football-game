/**
 * Lot 3.D.4 — Vue terrain du replay full driver.
 *
 * Rend le `<GameBoardWithDugouts>` (le même qu'utilisé sur `/play`)
 * piloté par le hook `useFullReplay` qui rejoue `states[]` step-by-step.
 *
 * Pas d'interaction joueur : c'est une vue passive de replay. Les
 * contrôles play/pause/step/seek/speed naviguent dans la timeline.
 *
 * Le composant est `dynamic(ssr:false)` au point d'import parent pour
 * laisser Pixi (>500KB) hors du bundle initial — même pattern que
 * `<ProLeagueField>`.
 */

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { getMoveActivePlayerId } from "../../../../lib/move-active-player";
import {
  PLAYBACK_SPEEDS,
  formatReplayClock,
} from "../../../../lib/use-replay-clock";
import {
  type FullReplayTeamPaint,
  useFullReplay,
} from "../../../../lib/use-full-replay";

/**
 * Lot 3.D.5 — convertit une race "Wood Elf" (telle qu'écrite dans le
 * profile sim-engine) en rosterSlug "wood_elf" tel qu'attendu par
 * `getTeamColors` / `ROSTER_COLORS` côté @bb/game-engine. Permet le
 * fallback couleurs quand `ProTeam.primaryColor` est null.
 */
function raceToRosterSlug(race: string | null | undefined): string | undefined {
  if (!race) return undefined;
  return race.toLowerCase().replace(/\s+/g, "_");
}

/**
 * Convertit une couleur hex string (`#ffaa00`) en number 0xRRGGBB
 * attendu par PixiBoard. Retourne `undefined` si pas exploitable.
 */
function hexStringToNumber(hex: string | null | undefined): number | undefined {
  if (!hex || typeof hex !== "string") return undefined;
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (clean.length !== 6) return undefined;
  const n = Number.parseInt(clean, 16);
  return Number.isFinite(n) ? n : undefined;
}

function paintOverrideFor(
  team: FullReplayTeamPaint | null,
): { primary: number; secondary: number } | undefined {
  if (!team) return undefined;
  const primary = hexStringToNumber(team.primaryColor);
  const secondary = hexStringToNumber(team.secondaryColor);
  if (primary === undefined || secondary === undefined) return undefined;
  return { primary, secondary };
}

interface FullReplayFieldProps {
  readonly matchId: string;
  /** Callback pour signaler au parent qu'il faut retomber sur la vue textuelle. */
  readonly onFallback?: (reason: { code: string | null; message: string }) => void;
}

const GameBoardWithDugouts = dynamic(
  () => import("@bb/ui").then((m) => m.GameBoardWithDugouts),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[3/1] w-full animate-pulse rounded bg-slate-800/60"
        aria-label="Loading the field"
      />
    ),
  },
);

export default function FullReplayField({
  matchId,
  onFallback,
}: FullReplayFieldProps): JSX.Element {
  const replay = useFullReplay(matchId);

  // Notifie le parent si l'API retourne 404 (replay legacy ou hybrid).
  useMemo(() => {
    if (replay.error && onFallback) {
      onFallback({ code: replay.errorCode, message: replay.error });
    }
  }, [replay.error, replay.errorCode, onFallback]);

  if (replay.loading) {
    return (
      <div
        className="aspect-[3/1] w-full animate-pulse rounded bg-slate-800/60"
        aria-label="Loading full replay"
        data-testid="full-replay-loading"
      />
    );
  }

  if (replay.error || !replay.dump || !replay.currentState) {
    return (
      <div
        role="alert"
        data-testid="full-replay-error"
        className="rounded border border-rose-700 bg-rose-950 px-4 py-3 text-sm text-rose-200"
      >
        Vue terrain indisponible : {replay.error ?? "données absentes"}
        {replay.errorCode ? ` (${replay.errorCode})` : null}
      </div>
    );
  }

  // Lot 3.D.5 — couleurs : priorité au branding ProTeam (`primaryColor`
  // / `secondaryColor` en hex). Fallback sur le rosterSlug dérivé de
  // la race (`Skaven` → `skaven` qui matche `ROSTER_COLORS`).
  const homeRosterSlug = raceToRosterSlug(replay.dump.teams.home?.race);
  const awayRosterSlug = raceToRosterSlug(replay.dump.teams.away?.race);
  const homeOverride = paintOverrideFor(replay.dump.teams.home);
  const awayOverride = paintOverrideFor(replay.dump.teams.away);
  const score = {
    home: replay.currentState.score.teamA,
    away: replay.currentState.score.teamB,
  };

  // Lot 3.E.1 — surligne sur le terrain le joueur dont vient de jouer
  // le move courant. `null` au kickoff (index = -1) et sur les moves
  // sans joueur (END_TURN, REROLL_CHOOSE, KICKOFF_BLITZ_RESOLVE...).
  const selectedPlayerId = getMoveActivePlayerId(replay.currentMove);

  return (
    <div className="flex flex-col gap-3" data-testid="full-replay-field">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
        <div className="flex items-center gap-3 font-mono text-slate-300">
          <span>
            Half {replay.currentState.half} · Turn {replay.currentState.turn}
          </span>
          <span className="text-slate-500">·</span>
          <span>
            {replay.clockLabel} / {formatReplayClock(replay.durationMs)}
          </span>
          <span className="text-slate-500">·</span>
          <span>
            Move {replay.currentMoveIndex + 1} / {replay.totalMoves}
          </span>
        </div>
        <div className="font-mono text-xl font-bold tracking-wide">
          {score.home} – {score.away}
        </div>
      </header>

      <div data-testid="full-replay-pixi">
        <GameBoardWithDugouts
          state={replay.currentState}
          selectedPlayerId={selectedPlayerId}
          teamRosters={{ teamA: homeRosterSlug, teamB: awayRosterSlug }}
          teamColorOverrides={{
            teamA: homeOverride,
            teamB: awayOverride,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => replay.controls.restart()}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          aria-label="Restart"
          data-testid="full-replay-restart"
        >
          ⟲
        </button>
        <button
          type="button"
          onClick={() => replay.controls.stepBackward()}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          aria-label="Previous move"
          data-testid="full-replay-prev"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => replay.controls.toggle()}
          className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-600"
          aria-label={replay.playing ? "Pause" : "Play"}
          data-testid="full-replay-play-pause"
        >
          {replay.playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => replay.controls.stepForward()}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          aria-label="Next move"
          data-testid="full-replay-next"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => replay.controls.skipToEnd()}
          className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
          aria-label="Skip to end"
          data-testid="full-replay-end"
        >
          ⤓
        </button>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-slate-500">Vitesse</span>
          {PLAYBACK_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => replay.controls.setSpeed(s)}
              data-testid={`full-replay-speed-${s}`}
              className={`rounded px-2 py-0.5 text-xs font-mono ${
                replay.playbackSpeed === s
                  ? "bg-emerald-700 text-emerald-50"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={replay.durationMs}
        step={100}
        value={replay.currentMs}
        onChange={(e) =>
          replay.controls.seek(Number.parseInt(e.target.value, 10))
        }
        data-testid="full-replay-scrub"
        aria-label="Scrub"
        className="w-full accent-emerald-600"
      />
    </div>
  );
}
