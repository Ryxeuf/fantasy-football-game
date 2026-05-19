"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import type { GameState, Player } from "@bb/game-engine";
import type { MatchEvent } from "@bb/shared-types";

import { useLanguage } from "../../../../contexts/LanguageContext";
import { ApiClientError, apiRequest } from "../../../../lib/api-client";
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

/**
 * Sous-ensemble du dump `/full-replay` utilisé par `MatchReplayPlayer` :
 * - `initialState.players` permet de résoudre les playerIds bruts (cuids)
 *   en "Nom (#N Position)" dans le feed d'évents.
 * - La simple présence du dump signale que la vue terrain BB est dispo
 *   (donc on l'active par défaut).
 */
interface ReplayTeamPaint {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly race: string;
  readonly primaryColor: string | null;
  readonly secondaryColor: string | null;
}

interface FullReplayDumpLite {
  readonly initialState: GameState;
  readonly states?: readonly GameState[];
  readonly teams?: {
    readonly home: ReplayTeamPaint | null;
    readonly away: ReplayTeamPaint | null;
  };
}

interface PlayerProps {
  readonly matchId: string;
}

/**
 * Badge "▶ Nom équipe" coloré avec la primaryColor de l'équipe active.
 * `side` = null pendant la phase kickoff ou avant le premier TURN_START.
 */
function ActiveTeamBadge({
  side,
  teams,
}: {
  side: "home" | "away" | null;
  teams: FullReplayDumpLite["teams"] | undefined;
}): JSX.Element | null {
  if (!side) return null;
  const team = side === "home" ? teams?.home : teams?.away;
  const color = team?.primaryColor || (side === "home" ? "#dc2626" : "#0085CA");
  const label = team?.name || (side === "home" ? "Home" : "Away");
  return (
    <span
      data-testid="replay-active-team"
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow"
      style={{ backgroundColor: color }}
    >
      <span aria-hidden="true">▶</span>
      <span>{label}</span>
    </span>
  );
}

/**
 * Construit un index `playerId → "Nom (#N Position)"` à partir des players
 * du `initialState` (les 22 starters) plus des `states` ultérieurs (qui
 * peuvent contenir des reserves ramenées sur le terrain en cours de match).
 * Fallback gracieux : si l'ID n'est pas dans la map, on retourne l'ID brut.
 */
function buildPlayerNameIndex(
  dump: FullReplayDumpLite | null,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  if (!dump) return map;
  const addPlayers = (players: readonly Player[] | undefined): void => {
    if (!players) return;
    for (const p of players) {
      if (!p?.id || map.has(p.id)) continue;
      const name = typeof p.name === "string" && p.name ? p.name : p.id;
      const num = typeof p.number === "number" ? `#${p.number}` : "";
      const pos = typeof p.position === "string" ? p.position : "";
      const suffix = [num, pos].filter(Boolean).join(" ");
      map.set(p.id, suffix ? `${name} (${suffix})` : name);
    }
  };
  addPlayers(dump.initialState?.players);
  if (dump.states) {
    for (const s of dump.states) addPlayers(s.players);
  }
  return map;
}

function resolvePlayer(
  rawId: unknown,
  names: ReadonlyMap<string, string>,
): string {
  if (typeof rawId !== "string" || !rawId) return "?";
  return names.get(rawId) ?? rawId;
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

function summarizeMeta(
  ev: MatchEvent,
  e: EventsT,
  playerNames: ReadonlyMap<string, string>,
): string {
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  switch (ev.type) {
    case "KICKOFF": {
      const home = String(meta.homeName ?? meta.home ?? "home");
      const away = String(meta.awayName ?? meta.away ?? "away");
      // BB pré-match : on relate le coin toss, qui engage et la météo
      // pour donner du contexte au lecteur.
      const weatherLabels: Record<string, string> = {
        nice: "Beau temps",
        sweltering_heat: "Chaleur étouffante",
        very_sunny: "Très ensoleillé",
        pouring_rain: "Pluie battante",
        blizzard: "Blizzard",
      };
      const receivingTeam = String(meta.receivingTeam ?? "");
      const kickingTeam = String(meta.kickingTeam ?? "");
      const tossWinner = String(meta.tossWinner ?? "");
      const teamName = (slot: string): string =>
        slot === "home" ? home : slot === "away" ? away : "";
      const winnerName = teamName(tossWinner);
      const kickerName = teamName(kickingTeam);
      const receiverName = teamName(receivingTeam);
      const weatherKey = String(meta.weather ?? "");
      const weatherLabel = weatherLabels[weatherKey] ?? weatherKey;
      const base = e.kickoffPair.replace("{home}", home).replace("{away}", away);
      const extras: string[] = [];
      if (winnerName) {
        extras.push(`${winnerName} remporte le toss et choisit de recevoir`);
      }
      if (kickerName && receiverName) {
        extras.push(`${kickerName} engage, ${receiverName} reçoit`);
      }
      if (weatherLabel) {
        extras.push(`météo : ${weatherLabel}`);
      }
      return extras.length > 0 ? `${base} — ${extras.join(" · ")}` : base;
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
      const attacker = resolvePlayer(meta.attackerId, playerNames);
      const defender = resolvePlayer(meta.defenderId, playerNames);
      return e.blitzDeclared
        .replace("{attacker}", attacker)
        .replace("{defender}", defender);
    }
    case "BLOCK": {
      const hasAttacker = typeof meta.attackerId === "string" && meta.attackerId;
      const hasDefender = typeof meta.defenderId === "string" && meta.defenderId;
      if (hasAttacker && hasDefender) {
        return e.blockBetween
          .replace("{attacker}", resolvePlayer(meta.attackerId, playerNames))
          .replace("{defender}", resolvePlayer(meta.defenderId, playerNames));
      }
      return e.block;
    }
    case "KNOCKDOWN": {
      const player = resolvePlayer(meta.playerId, playerNames);
      const cause =
        typeof meta.causedBy === "string" && meta.causedBy
          ? resolvePlayer(meta.causedBy, playerNames)
          : "";
      if (cause) {
        return e.knockdownWithCause
          .replace("{player}", player)
          .replace("{cause}", cause);
      }
      return e.knockdown.replace("{player}", player);
    }
    case "DODGE": {
      const player = resolvePlayer(meta.playerId, playerNames);
      return e.dodge.replace("{player}", player);
    }
    case "PASS": {
      const passer = resolvePlayer(meta.passerId, playerNames);
      return e.pass.replace("{passer}", passer);
    }
    case "TD": {
      const team = String(meta.team ?? "").toUpperCase();
      return e.touchdownTeam.replace("{team}", team);
    }
    case "KO": {
      const player = resolvePlayer(meta.playerId, playerNames);
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
      const rawCause = meta.cause ? String(meta.cause) : "";
      // BB cause technique → libellé humain. "unknown" est filtré : il
      // signifie que `causeFromMove` n'a pas pu inférer la raison
      // (déclencheur hors Move courant) — autant ne rien afficher
      // plutôt qu'un faux libellé.
      const causeLabels: Record<string, string> = {
        pass_failed: "passe ratée",
        handoff_failed: "transmission ratée",
        dodge_failed: "esquive ratée",
        movement_failed: "mouvement raté",
        block_attacker_down: "attaquant à terre",
        foul_sent_off: "faute (expulsion)",
      };
      const label = causeLabels[rawCause];
      return label ? `${e.turnover} (${label})` : e.turnover;
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
  // Vue terrain BB (GameBoardWithDugouts + states[]) par défaut quand le
  // dump full-replay est disponible — c'est ce que l'utilisateur voit en
  // direct sur `/play` ou `/live`. Bascule sur la vue classique (terrain
  // abstrait + ball trail) si le full driver n'est pas disponible (replays
  // legacy / driver hybrid).
  const [viewMode, setViewMode] = useState<ReplayViewMode>("field");
  // Lot replay-fix — dump léger du full-replay pour résoudre les playerIds
  // bruts en "Nom (#N Position)" dans le feed, et savoir si la vue terrain
  // est dispo. Fetch en parallèle du `/replay` ; null si 404 (legacy).
  const [fullDump, setFullDump] = useState<FullReplayDumpLite | null>(null);
  const [fullDumpUnavailable, setFullDumpUnavailable] =
    useState<string | null>(null);

  useEffect(() => {
    if (redirect.redirecting) return;
    if (redirect.status !== null && redirect.status !== "completed") return;
    let cancelled = false;
    // Pattern `Promise.all([detail, optional])` (cf. CLAUDE.md) : le
    // dump events est obligatoire, le full-replay est optionnel et n'a
    // pas le droit de bloquer l'affichage si 404 (replay legacy).
    Promise.all([
      apiRequest<ReplayDump>(
        `/pro-league/matches/${encodeURIComponent(matchId)}/replay`,
      ),
      apiRequest<FullReplayDumpLite>(
        `/pro-league/matches/${encodeURIComponent(matchId)}/full-replay`,
      ).catch((e: unknown) => {
        // 404 / FULL_REPLAY_NOT_AVAILABLE → on basculera en vue classique.
        if (e instanceof ApiClientError) {
          return { __unavailable: e.message } as const;
        }
        return {
          __unavailable: e instanceof Error ? e.message : "fetch error",
        } as const;
      }),
    ])
      .then(([d, f]) => {
        if (cancelled) return;
        setDump(d);
        if ("__unavailable" in f) {
          setFullDump(null);
          setFullDumpUnavailable(f.__unavailable);
          setViewMode("classic");
        } else {
          setFullDump(f);
          setFullDumpUnavailable(null);
        }
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
  // Équipe active = `drivingTeam` du dernier `TURN_START` <= currentMs.
  // Permet d'afficher dans le header sticky qui joue actuellement, en
  // utilisant les couleurs primary/secondary de l'équipe correspondante.
  const activeTeamSide: "home" | "away" | null = useMemo(() => {
    for (let i = visibleEvents.length - 1; i >= 0; i -= 1) {
      const ev = visibleEvents[i];
      if (ev.type === "TURN_START") {
        const meta = (ev.meta ?? {}) as Record<string, unknown>;
        const drivingTeam = String(meta.drivingTeam ?? "");
        if (drivingTeam === "home" || drivingTeam === "away") {
          return drivingTeam;
        }
      }
    }
    return null;
  }, [visibleEvents]);
  const currentTurnInfo = useMemo(() => {
    for (let i = visibleEvents.length - 1; i >= 0; i -= 1) {
      const ev = visibleEvents[i];
      if (ev.type === "TURN_START") {
        const meta = (ev.meta ?? {}) as Record<string, unknown>;
        return {
          half: Number(meta.half ?? 0),
          turn: Number(meta.turn ?? 0),
        };
      }
    }
    return null;
  }, [visibleEvents]);
  const playerNames = useMemo(
    () => buildPlayerNameIndex(fullDump),
    [fullDump],
  );
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
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
        <p
          role="alert"
          data-testid="replay-error"
          className="max-w-md rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      </main>
    );
  }

  if (!dump) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-6 text-slate-100">
        <p data-testid="replay-loading" className="text-sm text-slate-400">
          {t.proLeague.replay.loading}
        </p>
      </main>
    );
  }

  const halfLabel =
    score.half === "final"
      ? t.proLeague.live.scoreFt
      : score.half === 1
        ? t.proLeague.live.scoreHalf1
        : t.proLeague.live.scoreHalf2;

  return (
    <main
      className="flex min-h-screen w-full flex-col bg-slate-950 text-slate-100"
      data-testid="replay-main"
    >
      {redirect.isTest && (
        <div
          data-testid="test-match-banner"
          className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-amber-950"
        >
          🧪 TEST MATCH — sandbox, ne compte ni dans les standings ni dans l&apos;ELO ni dans les paris.
        </div>
      )}

      {/* Header sticky : score, half/turn, équipe active, view tabs */}
      <header
        data-testid="replay-header"
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-2 shadow backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <span
            data-testid="replay-half"
            className="rounded bg-slate-800 px-2 py-1 font-mono text-xs uppercase tracking-wider text-slate-300"
          >
            {halfLabel}
            {currentTurnInfo && currentTurnInfo.turn > 0
              ? ` · Tour ${currentTurnInfo.turn}`
              : ""}
          </span>
          {/* Indicateur équipe active : couleur primary + nom de l'équipe */}
          <ActiveTeamBadge
            side={activeTeamSide}
            teams={fullDump?.teams}
          />
          <span
            data-testid="replay-score"
            className="font-mono text-xl font-bold tracking-wide"
          >
            {score.home} – {score.away}
          </span>
        </div>
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
            aria-disabled={fullDumpUnavailable !== null}
            disabled={fullDumpUnavailable !== null}
            data-testid="replay-view-field"
            onClick={() => {
              if (fullDumpUnavailable !== null) return;
              setViewMode("field");
            }}
            title={
              fullDumpUnavailable
                ? `Vue terrain indisponible (${fullDumpUnavailable})`
                : undefined
            }
            className={`rounded px-3 py-1 font-mono ${
              viewMode === "field"
                ? "bg-emerald-700 text-emerald-50"
                : fullDumpUnavailable !== null
                  ? "cursor-not-allowed text-slate-600"
                  : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Terrain
          </button>
        </div>
      </header>

      {viewMode === "field" && fullDumpUnavailable !== null && (
        <div
          role="alert"
          data-testid="replay-field-unavailable"
          className="mx-4 mt-2 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-xs text-amber-200"
        >
          Vue terrain indisponible ({fullDumpUnavailable}). Revenir en{" "}
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

      {/*
        Layout principal : terrain + log côte à côte sur desktop (xl), empilés
        sur mobile. Le terrain n'est plus contraint en largeur — il prend toute
        la place disponible dans sa colonne grid. Le log occupe ~360px à droite.
      */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:px-4">
        {/* Colonne terrain */}
        <section
          aria-label="Terrain"
          className="flex min-h-0 flex-col items-center justify-start"
          data-testid={
            viewMode === "classic"
              ? "replay-field-wrapper"
              : "replay-field-wrapper-full"
          }
        >
          {viewMode === "classic" ? (
            <div className="w-full max-w-3xl">
              <ProLeagueField fieldState={fieldState} />
            </div>
          ) : (
            <FullReplayField
              matchId={matchId}
              externalClock={clock}
              onFallback={({ message }) => {
                setFullDumpUnavailable(message);
                setViewMode("classic");
              }}
            />
          )}
        </section>

        {/* Colonne log textuel */}
        <aside
          aria-label="Journal du match"
          className="flex min-h-0 flex-col gap-2 rounded border border-slate-800 bg-slate-900/40"
        >
          <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Journal · {visibleEvents.length} évènement{visibleEvents.length > 1 ? "s" : ""}
          </div>
          <ol
            data-testid="replay-event-feed"
            className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 py-2 xl:max-h-[calc(100vh-280px)]"
          >
            {visibleEvents.length === 0 ? (
              <li className="px-2 py-3 text-sm text-slate-500">
                {t.proLeague.live.awaitingKickoff}
              </li>
            ) : (
              visibleEvents
                .filter((ev) => !HIDDEN_EVENT_TYPES.has(ev.type))
                .slice()
                .reverse()
                .map((ev, idx) => {
                  // TURN_START : séparateur de tour stylisé en bandeau
                  // avec accent latéral coloré (couleur primary de l'équipe
                  // qui démarre son tour) pour faciliter la navigation
                  // visuelle dans le journal.
                  if (ev.type === "TURN_START") {
                    const meta = (ev.meta ?? {}) as Record<string, unknown>;
                    const side = String(meta.drivingTeam ?? "");
                    const team =
                      side === "home"
                        ? fullDump?.teams?.home
                        : side === "away"
                          ? fullDump?.teams?.away
                          : null;
                    const accent =
                      team?.primaryColor ||
                      (side === "home" ? "#dc2626" : "#0085CA");
                    return (
                      <li
                        key={`${visibleEvents.length - 1 - idx}-${ev.type}-${ev.displayAtMs}`}
                        className="mt-1 flex items-center gap-2 rounded bg-slate-950/60 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200"
                        style={{ borderLeft: `4px solid ${accent}` }}
                      >
                        <span className="font-mono text-[10px] text-slate-500">
                          {formatReplayClock(ev.displayAtMs)}
                        </span>
                        <span className="flex-1">
                          {summarizeMeta(ev, t.proLeague.events, playerNames)}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={`${visibleEvents.length - 1 - idx}-${ev.type}-${ev.displayAtMs}`}
                      className="flex items-start gap-2 rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs leading-relaxed"
                    >
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        {formatReplayClock(ev.displayAtMs)}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono ${EVENT_BADGE_STYLES[ev.type] ?? "bg-slate-700 text-slate-100"}`}
                      >
                        {ev.type}
                      </span>
                      <span className="flex-1 text-slate-200">
                        {summarizeMeta(ev, t.proLeague.events, playerNames)}
                      </span>
                    </li>
                  );
                })
            )}
          </ol>
        </aside>
      </div>

      {/* Footer sticky : scrub + controls */}
      <footer
        data-testid="replay-scrubber"
        className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-slate-800 bg-slate-900/95 px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.3)] backdrop-blur"
      >
        <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            className="hidden text-[11px] text-slate-500 lg:block"
            dangerouslySetInnerHTML={{
              __html: t.proLeague.replay.shortcutsHint,
            }}
          />
        </div>
      </footer>
    </main>
  );
}
