"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import type { MatchEvent } from "@bb/shared-types";

import { useLanguage } from "../../../../contexts/LanguageContext";
import { deriveProLeagueFieldState } from "../../../../lib/pro-league-field-state";
import { useMatchModeRedirect } from "../../../../lib/use-match-mode-redirect";
import { useProLeagueMatchStream } from "../../../../lib/use-pro-league-match-stream";

// Lazy-load Pixi (>500KB) — même pattern que /play et /spectate PvP.
// Le chunk /pro-league/matches ne porte plus le moteur de rendu en
// main bundle (sprint 1.B.3). Le aria-label du loading reste statique
// pour ne pas exposer le hook hors d'un Provider — c'est un fallback
// court qui disparait des qu'EE Pixi est chargee.
const ProLeagueField = dynamic(
  () => import("./ProLeagueField").then((m) => m.default),
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

/**
 * Page de spectate textuel d'un match Pro League — sprint 1.B.4.
 *
 * Vue alternative pure texte pour mobile / low-bandwidth :
 * - Score sticky en haut (mis à jour à chaque event TD).
 * - Timeline scrollable des events avec badges (TD / CAS / NUFFLE).
 * - Auto-refresh via SSE (`useProLeagueMatchStream`).
 *
 * Pas d'auth — les matchs Pro League sont publics au MVP.
 */
interface LivePageProps {
  readonly params: { id: string };
}

interface ScoreState {
  home: number;
  away: number;
  half: 1 | 2 | "final";
}

function deriveScore(events: readonly MatchEvent[]): ScoreState {
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

// Lot 3.A.3 — events trop bruyants pour le ticker (PLAYER_ACTIVATION
// ~28/match). Filtrés par défaut ; restent disponibles dans le payload
// MatchEvent pour le narrator détaillé et un futur highlight sur le
// terrain Pixi.
const HIDDEN_EVENT_TYPES = new Set<string>(["PLAYER_ACTIVATION"]);

function formatClock(displayAtMs: number): string {
  const seconds = Math.floor(displayAtMs / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

function ConnectionBadge({
  state,
}: {
  state: "connecting" | "open" | "error" | "closed";
}): JSX.Element {
  const { t } = useLanguage();
  const label =
    state === "open"
      ? t.proLeague.live.connOpen
      : state === "connecting"
        ? t.proLeague.live.connConnecting
        : state === "error"
          ? t.proLeague.live.connError
          : t.proLeague.live.connClosed;
  const klass =
    state === "open"
      ? "bg-emerald-600 text-emerald-50"
      : state === "connecting"
        ? "bg-slate-600 text-slate-100"
        : state === "error"
          ? "bg-amber-600 text-amber-50"
          : "bg-slate-700 text-slate-300";
  return (
    <span
      data-testid="connection-badge"
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono ${klass}`}
    >
      {label}
    </span>
  );
}

export default function LiveProMatchPage({
  params,
}: LivePageProps): JSX.Element {
  const { t } = useLanguage();
  const redirect = useMatchModeRedirect(params.id, "live");
  const { events, connectionState, error } = useProLeagueMatchStream(params.id);
  const score = useMemo(() => deriveScore(events), [events]);
  const fieldState = useMemo(
    () => deriveProLeagueFieldState(events),
    [events],
  );

  if (redirect.redirecting) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col bg-slate-950 px-4 py-6 text-slate-100">
        <p data-testid="live-redirecting" className="text-sm text-slate-400">
          {t.proLeague.live.redirectingToReplay}
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
        data-testid="score-header"
        className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3 shadow"
      >
        <div className="flex items-center gap-3">
          <ConnectionBadge state={connectionState} />
          <span className="font-mono text-sm text-slate-400">
            {score.half === "final"
              ? t.proLeague.live.scoreFt
              : score.half === 1
                ? t.proLeague.live.scoreHalf1
                : t.proLeague.live.scoreHalf2}
          </span>
        </div>
        <div
          data-testid="score-display"
          className="font-mono text-2xl font-bold tracking-wide"
        >
          {score.home} – {score.away}
        </div>
      </header>

      <div className="px-4 pt-4" data-testid="field-wrapper">
        <ProLeagueField fieldState={fieldState} />
      </div>

      {error ? (
        <div
          role="alert"
          className="m-4 rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}

      <ol
        data-testid="event-feed"
        className="flex flex-1 flex-col gap-1 px-4 py-3"
      >
        {events.length === 0 ? (
          <li className="text-sm text-slate-500">
            {t.proLeague.live.awaitingKickoff}
          </li>
        ) : (
          events
            .filter((ev) => !HIDDEN_EVENT_TYPES.has(ev.type))
            .slice()
            .reverse()
            .map((ev, idx) => (
              <li
                key={`${events.length - 1 - idx}-${ev.type}-${ev.displayAtMs}`}
                className="flex items-start gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-slate-500">
                  {formatClock(ev.displayAtMs)}
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
