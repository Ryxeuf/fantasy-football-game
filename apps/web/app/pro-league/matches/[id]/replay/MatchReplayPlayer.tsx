"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type { MatchEvent } from "@bb/shared-types";

import { apiRequest } from "../../../../lib/api-client";
import { deriveProLeagueFieldState } from "../../../../lib/pro-league-field-state";
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  formatReplayClock,
  useReplayClock,
} from "../../../../lib/use-replay-clock";

/**
 * Sprint 1.G.2 — Player de replay Pro League.
 *
 * Charge le dump complet via `/pro-league/matches/:id/replay` (lot 1.G.1)
 * puis pilote l'avancement cote browser : play/pause, scrub bar, controls
 * de vitesse 0.5/1/2/4/8×, skip-to-end, restart.
 *
 * Re-utilise `<ProLeagueField>` (Pixi) + `deriveProLeagueFieldState`
 * (pure) en filtrant les events `displayAtMs <= currentMs`.
 *
 * Markers (TD/CAS/NUFFLE) et keyboard shortcuts arrivent en 1.G.4 / 1.G.5.
 */

// Lazy-load Pixi (>500KB) — meme pattern que /live.
const ProLeagueField = dynamic(
  () =>
    import("../live/ProLeagueField").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div
        className="aspect-[3/1] w-full animate-pulse rounded bg-slate-800/60"
        aria-label="Chargement du terrain"
      />
    ),
  },
);

interface ReplayDump {
  readonly matchId: string;
  readonly status: string;
  readonly durationMs: number;
  readonly eventCount: number;
  readonly events: readonly MatchEvent[];
}

interface PlayerProps {
  readonly matchId: string;
}

const EVENT_BADGE_STYLES: Record<string, string> = {
  KICKOFF: "bg-slate-700 text-slate-100",
  TURN_START: "bg-slate-800 text-slate-300",
  BLOCK: "bg-amber-900 text-amber-100",
  DODGE: "bg-sky-900 text-sky-100",
  PASS: "bg-blue-900 text-blue-100",
  TD: "bg-emerald-700 text-emerald-50 font-semibold",
  KO: "bg-orange-900 text-orange-100",
  CASUALTY: "bg-red-700 text-red-50 font-semibold",
  TURNOVER: "bg-rose-900 text-rose-100",
  NUFFLE: "bg-purple-700 text-purple-50 font-semibold",
  HALFTIME: "bg-indigo-900 text-indigo-100",
  END: "bg-slate-900 text-slate-100 font-semibold",
};

function summarizeMeta(ev: MatchEvent): string {
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "KICKOFF": {
      const home = String(meta.homeName ?? meta.home ?? "home");
      const away = String(meta.awayName ?? meta.away ?? "away");
      return `${home} vs ${away}`;
    }
    case "TURN_START": {
      const half = meta.half;
      const turn = meta.turn;
      const drivingTeam = String(meta.drivingTeam ?? "");
      return `Half ${half ?? ""} · Turn ${turn ?? ""}${drivingTeam ? ` · ${drivingTeam}` : ""}`;
    }
    case "TD": {
      const team = String(meta.team ?? "");
      return `TOUCHDOWN ${team.toUpperCase()}`;
    }
    case "CASUALTY": {
      const cause = meta.causedBy ? ` (${String(meta.causedBy)})` : "";
      return `Casualty${cause}`;
    }
    case "NUFFLE": {
      const id = meta.id ?? meta.eventId ?? "?";
      return `Nuffle: ${String(id)}`;
    }
    case "HALFTIME":
      return "Halftime";
    case "END":
      return "Match end";
    default:
      return ev.type;
  }
}

function deriveScore(events: readonly MatchEvent[]): {
  home: number;
  away: number;
  half: 1 | 2 | "final";
} {
  let home = 0;
  let away = 0;
  let half: 1 | 2 | "final" = 1;
  for (const ev of events) {
    if (ev.type === "TD") {
      const team = (ev.meta as { team?: string } | undefined)?.team;
      if (team === "home") home += 1;
      else if (team === "away") away += 1;
    } else if (ev.type === "HALFTIME") {
      half = 2;
    } else if (ev.type === "END") {
      half = "final";
    }
  }
  return { home, away, half };
}

interface ControlsProps {
  readonly playing: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly onToggle: () => void;
  readonly onSpeedChange: (s: PlaybackSpeed) => void;
  readonly onSkipToEnd: () => void;
  readonly onRestart: () => void;
}

function PlayerControls({
  playing,
  playbackSpeed,
  onToggle,
  onSpeedChange,
  onSkipToEnd,
  onRestart,
}: ControlsProps): JSX.Element {
  return (
    <div
      data-testid="replay-controls"
      className="flex items-center gap-2"
    >
      <button
        type="button"
        onClick={onRestart}
        aria-label="Restart"
        data-testid="replay-restart"
        className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⏮
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
        data-testid="replay-toggle"
        className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold text-emerald-50 hover:bg-emerald-600"
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        onClick={onSkipToEnd}
        aria-label="Skip to end"
        data-testid="replay-skip-end"
        className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⏭
      </button>
      <div
        role="group"
        aria-label="Playback speed"
        data-testid="replay-speed-group"
        className="ml-2 flex items-center gap-1 rounded border border-slate-800 bg-slate-900 p-0.5"
      >
        {PLAYBACK_SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSpeedChange(s)}
            aria-pressed={playbackSpeed === s}
            data-testid={`replay-speed-${s}`}
            className={`rounded px-2 py-0.5 text-xs font-mono ${
              playbackSpeed === s
                ? "bg-emerald-700 text-emerald-50"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MatchReplayPlayer({
  matchId,
}: PlayerProps): JSX.Element {
  const [dump, setDump] = useState<ReplayDump | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ReplayDump>(
      `/pro-league/matches/${encodeURIComponent(matchId)}/replay`,
    )
      .then((d) => {
        if (cancelled) return;
        setDump(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch error");
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const durationMs = dump?.durationMs ?? 0;
  const clock = useReplayClock({ durationMs });

  const visibleEvents = useMemo(() => {
    if (!dump) return [];
    return dump.events.filter((ev) => ev.displayAtMs <= clock.currentMs);
  }, [dump, clock.currentMs]);

  const fieldState = useMemo(
    () => deriveProLeagueFieldState(visibleEvents),
    [visibleEvents],
  );
  const score = useMemo(() => deriveScore(visibleEvents), [visibleEvents]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
        <p
          role="alert"
          data-testid="replay-error"
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      </main>
    );
  }

  if (!dump) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
        <p data-testid="replay-loading" className="text-sm text-slate-400">
          Chargement du replay…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 text-slate-100">
      <header
        data-testid="replay-header"
        className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 shadow"
      >
        <span
          data-testid="replay-half"
          className="font-mono text-sm text-slate-400"
        >
          {score.half === "final"
            ? "FT"
            : score.half === 1
              ? "1st half"
              : "2nd half"}
        </span>
        <span
          data-testid="replay-score"
          className="font-mono text-2xl font-bold tracking-wide"
        >
          {score.home} – {score.away}
        </span>
      </header>

      <div className="px-4 pt-4" data-testid="replay-field-wrapper">
        <ProLeagueField fieldState={fieldState} />
      </div>

      <section
        data-testid="replay-scrubber"
        className="px-4 py-3 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between font-mono text-xs text-slate-400">
          <span data-testid="replay-current-time">
            {formatReplayClock(clock.currentMs)}
          </span>
          <span data-testid="replay-duration">
            {formatReplayClock(durationMs)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={durationMs}
          step={500}
          value={clock.currentMs}
          onChange={(e) => clock.seek(Number(e.target.value))}
          aria-label="Scrub replay"
          data-testid="replay-scrub"
          className="w-full accent-emerald-500"
        />
        <PlayerControls
          playing={clock.playing}
          playbackSpeed={clock.playbackSpeed}
          onToggle={clock.toggle}
          onSpeedChange={clock.setSpeed}
          onSkipToEnd={clock.skipToEnd}
          onRestart={clock.restart}
        />
      </section>

      <ol
        data-testid="replay-event-feed"
        className="flex flex-1 flex-col gap-1 px-4 py-3"
      >
        {visibleEvents.length === 0 ? (
          <li className="text-sm text-slate-500">En attente du kickoff…</li>
        ) : (
          visibleEvents
            .slice()
            .reverse()
            .map((ev, idx) => (
              <li
                key={`${visibleEvents.length - 1 - idx}-${ev.type}-${ev.displayAtMs}`}
                className="flex items-start gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-slate-500">
                  {formatReplayClock(ev.displayAtMs)}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-mono ${EVENT_BADGE_STYLES[ev.type] ?? "bg-slate-700 text-slate-100"}`}
                >
                  {ev.type}
                </span>
                <span className="flex-1 text-slate-200">
                  {summarizeMeta(ev)}
                </span>
              </li>
            ))
        )}
      </ol>
    </main>
  );
}
