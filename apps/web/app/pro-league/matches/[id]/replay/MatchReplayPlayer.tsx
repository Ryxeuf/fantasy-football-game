"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type { MatchEvent } from "@bb/shared-types";

import { useLanguage } from "../../../../contexts/LanguageContext";
import { apiRequest } from "../../../../lib/api-client";
import { deriveProLeagueFieldState } from "../../../../lib/pro-league-field-state";
import {
  type ScrubMarker,
  buildScrubMarkers,
} from "../../../../lib/replay-scrub-markers";
import { useMatchModeRedirect } from "../../../../lib/use-match-mode-redirect";
import {
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  formatReplayClock,
  useReplayClock,
} from "../../../../lib/use-replay-clock";
import { useReplayShortcuts } from "../../../../lib/use-replay-shortcuts";

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
        aria-label="Loading the field"
      />
    ),
  },
);

// Lot 3.D.4 — vue terrain BB (full driver replay). Lazy-load séparé
// pour ne pas charger le bundle Pixi roster-aware quand l'utilisateur
// reste sur la vue classique.
const FullReplayField = dynamic(() => import("./FullReplayField"), {
  ssr: false,
  loading: () => (
    <div
      className="aspect-[3/1] w-full animate-pulse rounded bg-slate-800/60"
      aria-label="Loading full replay field"
    />
  ),
});

type ReplayViewMode = "classic" | "field";

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
  BLITZ_DECLARED: "bg-yellow-700 text-yellow-50 font-semibold",
  BLOCK: "bg-amber-900 text-amber-100",
  KNOCKDOWN: "bg-orange-800 text-orange-50",
  DODGE: "bg-sky-900 text-sky-100",
  PASS: "bg-blue-900 text-blue-100",
  MOVE: "bg-slate-700 text-slate-200",
  TD: "bg-emerald-700 text-emerald-50 font-semibold",
  KO: "bg-orange-900 text-orange-100",
  CASUALTY: "bg-red-700 text-red-50 font-semibold",
  TURNOVER: "bg-rose-900 text-rose-100",
  NUFFLE: "bg-purple-700 text-purple-50 font-semibold",
  HALFTIME: "bg-indigo-900 text-indigo-100",
  END: "bg-slate-900 text-slate-100 font-semibold",
};

const HIDDEN_EVENT_TYPES = new Set<string>(["PLAYER_ACTIVATION"]);

interface EventsT {
  kickoffPair: string;
  turnStart: string;
  turnStartWithTeam: string;
  touchdownTeam: string;
  casualty: string;
  casualtyWithCause: string;
  nuffle: string;
  halftime: string;
  matchEnd: string;
  blitzDeclared: string;
  knockdown: string;
  knockdownWithCause: string;
  block: string;
  blockBetween: string;
  pass: string;
  dodge: string;
  ko: string;
  turnover: string;
}

function summarizeMeta(ev: MatchEvent, e: EventsT): string {
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "KICKOFF": {
      const home = String(meta.homeName ?? meta.home ?? "home");
      const away = String(meta.awayName ?? meta.away ?? "away");
      return e.kickoffPair.replace("{home}", home).replace("{away}", away);
    }
    case "TURN_START": {
      const half = String(meta.half ?? "");
      const turn = String(meta.turn ?? "");
      const drivingTeam = String(meta.drivingTeam ?? "");
      const tpl = drivingTeam ? e.turnStartWithTeam : e.turnStart;
      return tpl
        .replace("{half}", half)
        .replace("{turn}", turn)
        .replace("{team}", drivingTeam);
    }
    case "BLITZ_DECLARED": {
      const attacker = String(meta.attackerId ?? "?");
      const defender = String(meta.defenderId ?? "?");
      return e.blitzDeclared
        .replace("{attacker}", attacker)
        .replace("{defender}", defender);
    }
    case "BLOCK": {
      const attacker = String(meta.attackerId ?? "");
      const defender = String(meta.defenderId ?? "");
      if (attacker && defender) {
        return e.blockBetween
          .replace("{attacker}", attacker)
          .replace("{defender}", defender);
      }
      return e.block;
    }
    case "KNOCKDOWN": {
      const player = String(meta.playerId ?? "?");
      const cause = meta.causedBy ? String(meta.causedBy) : "";
      if (cause) {
        return e.knockdownWithCause
          .replace("{player}", player)
          .replace("{cause}", cause);
      }
      return e.knockdown.replace("{player}", player);
    }
    case "DODGE": {
      const player = String(meta.playerId ?? "?");
      return e.dodge.replace("{player}", player);
    }
    case "PASS": {
      const passer = String(meta.passerId ?? "?");
      return e.pass.replace("{passer}", passer);
    }
    case "TD": {
      const team = String(meta.team ?? "").toUpperCase();
      return e.touchdownTeam.replace("{team}", team);
    }
    case "KO": {
      const player = String(meta.playerId ?? "?");
      return e.ko.replace("{player}", player);
    }
    case "CASUALTY": {
      if (meta.causedBy) {
        return e.casualtyWithCause.replace(
          "{cause}",
          String(meta.causedBy),
        );
      }
      return e.casualty;
    }
    case "TURNOVER": {
      const cause = meta.cause ? String(meta.cause) : "";
      return cause ? `${e.turnover} (${cause})` : e.turnover;
    }
    case "NUFFLE": {
      const id = String(meta.id ?? meta.eventId ?? "?");
      return e.nuffle.replace("{id}", id);
    }
    case "HALFTIME":
      return e.halftime;
    case "END":
      return e.matchEnd;
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

const MARKER_COLOR_CLASSES: Record<ScrubMarker["type"], string> = {
  TD: "bg-emerald-500 hover:bg-emerald-300",
  CASUALTY: "bg-rose-500 hover:bg-rose-300",
  NUFFLE: "bg-purple-500 hover:bg-purple-300",
};

interface ScrubMarkersProps {
  readonly markers: readonly ScrubMarker[];
  readonly onSeek: (ms: number) => void;
}

function ScrubMarkers({
  markers,
  onSeek,
}: ScrubMarkersProps): JSX.Element | null {
  const { t } = useLanguage();
  if (markers.length === 0) return null;
  return (
    <div
      data-testid="scrub-markers"
      role="list"
      aria-label={t.proLeague.replay.labelKeyMoments}
      className="relative h-2"
    >
      {markers.map((m) => (
        <button
          key={`${m.eventIndex}-${m.type}`}
          type="button"
          role="listitem"
          onClick={() => onSeek(m.displayAtMs)}
          aria-label={t.proLeague.replay.seekLabel.replace("{label}", m.label)}
          title={m.label}
          data-testid={`scrub-marker-${m.type.toLowerCase()}`}
          data-event-index={m.eventIndex}
          style={{ left: `${m.percent}%` }}
          className={`absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full ${MARKER_COLOR_CLASSES[m.type]} transition-colors`}
        />
      ))}
    </div>
  );
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
  const { t } = useLanguage();
  return (
    <div
      data-testid="replay-controls"
      className="flex items-center gap-2"
    >
      <button
        type="button"
        onClick={onRestart}
        aria-label={t.proLeague.replay.labelRestart}
        data-testid="replay-restart"
        className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⏮
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? t.proLeague.replay.labelPause : t.proLeague.replay.labelPlay}
        aria-pressed={playing}
        aria-keyshortcuts="Space"
        data-testid="replay-toggle"
        className="rounded bg-emerald-700 px-3 py-1 text-sm font-semibold text-emerald-50 hover:bg-emerald-600"
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        onClick={onSkipToEnd}
        aria-label={t.proLeague.replay.labelSkipToEnd}
        data-testid="replay-skip-end"
        className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
      >
        ⏭
      </button>
      <div
        role="group"
        aria-label={t.proLeague.replay.labelPlaybackSpeed}
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
  const { t } = useLanguage();
  const redirect = useMatchModeRedirect(matchId, "replay");
  const [dump, setDump] = useState<ReplayDump | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lot 3.D.4 — bascule entre vue classique (events + ProLeagueField
  // abstrait) et vue terrain BB (GameBoardWithDugouts + states[]).
  // Vue classique par défaut : disponible pour tous les replays.
  const [viewMode, setViewMode] = useState<ReplayViewMode>("classic");
  const [fieldUnavailable, setFieldUnavailable] = useState<string | null>(null);

  useEffect(() => {
    if (redirect.redirecting) return;
    if (redirect.status !== null && redirect.status !== "completed") return;
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
  }, [matchId, redirect.redirecting, redirect.status]);

  if (redirect.redirecting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
        <p data-testid="replay-redirecting" className="text-sm text-slate-400">
          {t.proLeague.replay.redirecting}
        </p>
      </main>
    );
  }

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
  const markers = useMemo(() => {
    if (!dump) return [];
    return buildScrubMarkers({
      events: dump.events,
      durationMs: dump.durationMs,
    });
  }, [dump]);

  useReplayShortcuts({
    enabled: dump !== null,
    currentMs: clock.currentMs,
    onToggle: clock.toggle,
    onSeek: clock.seek,
    onRestart: clock.restart,
    onSkipToEnd: clock.skipToEnd,
    markers,
  });

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
          {t.proLeague.replay.loading}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 text-slate-100">
      {redirect.isTest && (
        <div
          data-testid="test-match-banner"
          className="sticky top-0 z-20 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow"
        >
          🧪 TEST MATCH — sandbox, ne compte ni dans les standings ni
          dans l&apos;ELO ni dans les paris.
        </div>
      )}
      <header
        data-testid="replay-header"
        className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 shadow"
      >
        <span
          data-testid="replay-half"
          className="font-mono text-sm text-slate-400"
        >
          {score.half === "final"
            ? t.proLeague.live.scoreFt
            : score.half === 1
              ? t.proLeague.live.scoreHalf1
              : t.proLeague.live.scoreHalf2}
        </span>
        <span
          data-testid="replay-score"
          className="font-mono text-2xl font-bold tracking-wide"
        >
          {score.home} – {score.away}
        </span>
      </header>

      <div className="flex items-center justify-end gap-2 px-4 pt-3">
        <div
          role="tablist"
          aria-label="Replay view mode"
          className="inline-flex rounded border border-slate-700 bg-slate-900 p-0.5 text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "classic"}
            data-testid="replay-view-classic"
            onClick={() => setViewMode("classic")}
            className={`rounded px-3 py-1 font-mono ${
              viewMode === "classic"
                ? "bg-emerald-700 text-emerald-50"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Classique
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "field"}
            data-testid="replay-view-field"
            onClick={() => setViewMode("field")}
            className={`rounded px-3 py-1 font-mono ${
              viewMode === "field"
                ? "bg-emerald-700 text-emerald-50"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Terrain
          </button>
        </div>
      </div>

      {viewMode === "field" && fieldUnavailable && (
        <div
          role="alert"
          data-testid="replay-field-unavailable"
          className="mx-4 mt-2 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-xs text-amber-200"
        >
          Vue terrain indisponible ({fieldUnavailable}). Revenir en{" "}
          <button
            type="button"
            onClick={() => setViewMode("classic")}
            className="underline"
          >
            vue classique
          </button>
          .
        </div>
      )}

      {viewMode === "classic" ? (
        <div className="px-4 pt-4" data-testid="replay-field-wrapper">
          <ProLeagueField fieldState={fieldState} />
        </div>
      ) : (
        <div className="px-4 pt-4" data-testid="replay-field-wrapper-full">
          <FullReplayField
            matchId={matchId}
            onFallback={({ message }) => setFieldUnavailable(message)}
          />
        </div>
      )}

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
        <ScrubMarkers markers={markers} onSeek={clock.seek} />
        <input
          type="range"
          min={0}
          max={durationMs}
          step={500}
          value={clock.currentMs}
          onChange={(e) => clock.seek(Number(e.target.value))}
          aria-label={t.proLeague.replay.labelScrub}
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
        <p
          data-testid="replay-shortcuts-hint"
          className="text-[11px] text-slate-500"
          // Le texte translation contient des <kbd> qui doivent etre rendus
          // comme HTML — dangerouslySetInnerHTML est sur ici car la chaine
          // vient d'une constante de traduction (pas de user input).
          dangerouslySetInnerHTML={{
            __html: t.proLeague.replay.shortcutsHint,
          }}
        />
      </section>

      <ol
        data-testid="replay-event-feed"
        className="flex flex-1 flex-col gap-1 px-4 py-3"
      >
        {visibleEvents.length === 0 ? (
          <li className="text-sm text-slate-500">
            {t.proLeague.live.awaitingKickoff}
          </li>
        ) : (
          visibleEvents
            .filter((ev) => !HIDDEN_EVENT_TYPES.has(ev.type))
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
                  {summarizeMeta(ev, t.proLeague.events)}
                </span>
              </li>
            ))
        )}
      </ol>
    </main>
  );
}
