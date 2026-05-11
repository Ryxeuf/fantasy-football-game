"use client";

/**
 * Sprint O — Lot O.C.2 : banner "Dernier match" sur la page d'une
 * equipe.
 *
 * Affiche le dernier match (status=completed) joue dans les 7 derniers
 * jours par l'utilisateur courant avec cette equipe :
 *
 *   - Score (myScore - opponentScore) colorise selon victoire/defaite/nul.
 *   - Coach + nom de l'equipe adverse.
 *   - Date relative ("il y a 2j").
 *   - Bouton "Voir details" → /match/[id]/details.
 *   - Dismiss avec flag localStorage par teamId+matchId (eviter
 *     re-affichage permanent).
 *
 * Coupling avec `PendingAdvancementsBanner` : ce composant est
 * **complementaire**. Si advancements en attente, l'autre banner
 * apparait au-dessus avec son propre CTA.
 *
 * Backend : reuse `GET /match/my-matches` (existing) + filtre par
 * `myTeam.teamId === teamId` (champ ajoute par Lot O.C.2 dans
 * `match-details-handlers.ts`).
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "../../../lib/api-client";

interface MyMatch {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  myScore: number;
  opponentScore: number;
  myTeam: {
    teamId: string | null;
    teamName: string;
    coachName: string;
  } | null;
  opponent: {
    teamName: string;
    coachName: string;
  } | null;
}

interface MyMatchesResponse {
  matches: MyMatch[];
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

interface Props {
  teamId: string;
}

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function dismissKey(teamId: string, matchId: string): string {
  return `match_report_dismissed:${teamId}:${matchId}`;
}

function isDismissed(teamId: string, matchId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(dismissKey(teamId, matchId)) === "1";
}

function markDismissed(teamId: string, matchId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dismissKey(teamId, matchId), "1");
}

function formatRelative(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = now - t;
  if (diff < 0) return "à l'instant";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "il y a < 1h";
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function MatchReportBanner({ teamId }: Props): JSX.Element | null {
  const [match, setMatch] = useState<MyMatch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    setLoading(true);
    apiRequest<ApiEnvelope<MyMatchesResponse> | MyMatchesResponse>(
      "/match/my-matches",
    )
      .then((response) => {
        if (cancelled) return;
        // L'endpoint utilise un envelope { success, data: { matches } }.
        const data =
          "data" in response && response.data ? response.data : response;
        const matches =
          (data as MyMatchesResponse).matches ?? ([] as MyMatch[]);
        const now = Date.now();
        const recent = matches.find((m) => {
          if (m.status !== "completed") return false;
          if (m.myTeam?.teamId !== teamId) return false;
          const at = new Date(m.lastMoveAt ?? m.createdAt).getTime();
          if (Number.isNaN(at)) return false;
          return now - at <= RECENT_WINDOW_MS;
        });
        if (recent && !isDismissed(teamId, recent.id)) {
          setMatch(recent);
        }
      })
      .catch(() => {
        // Erreur silencieuse — non-critique pour la page.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading || dismissed || !match) return null;

  const won = match.myScore > match.opponentScore;
  const drew = match.myScore === match.opponentScore;
  const resultLabel = won ? "Victoire" : drew ? "Match nul" : "Défaite";
  const resultEmoji = won ? "🏆" : drew ? "🤝" : "💀";
  const tone = won
    ? "border-emerald-700 bg-emerald-950/40 text-emerald-100"
    : drew
      ? "border-slate-600 bg-slate-900 text-slate-100"
      : "border-rose-800 bg-rose-950/40 text-rose-100";
  const scoreTone = won
    ? "text-emerald-300"
    : drew
      ? "text-slate-200"
      : "text-rose-300";

  const opponentLabel =
    match.opponent?.teamName ?? match.opponent?.coachName ?? "Adversaire";
  const relative = formatRelative(
    match.lastMoveAt ?? match.createdAt,
    Date.now(),
  );

  return (
    <section
      data-testid="match-report-banner"
      className={`mb-4 flex flex-col gap-2 rounded border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${tone}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          {resultEmoji}
        </span>
        <div>
          <div className="text-xs uppercase opacity-80">
            Dernier match {relative}
          </div>
          <div className="text-sm font-semibold">
            {resultLabel} contre{" "}
            <span className="font-bold">{opponentLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <span
          data-testid="match-report-score"
          className={`font-mono text-2xl font-bold ${scoreTone}`}
        >
          {match.myScore} – {match.opponentScore}
        </span>
        <Link
          data-testid="match-report-details"
          href={`/match/${match.id}/details`}
          className="rounded border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          Voir détails →
        </Link>
        <button
          type="button"
          data-testid="match-report-dismiss"
          onClick={() => {
            markDismissed(teamId, match.id);
            setDismissed(true);
          }}
          aria-label="Masquer ce résumé"
          className="rounded p-1 opacity-60 hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </section>
  );
}
