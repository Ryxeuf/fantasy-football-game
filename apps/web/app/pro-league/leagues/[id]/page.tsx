"use client";

/**
 * Sprint Q lot Q.D.1 — Page detail d'une ligue de pronostics.
 *
 * Trois sections :
 *  - Header : nom + code (copy to clipboard) + memberCount
 *  - Leaderboard custom (trie par corrects desc)
 *  - Mes picks (passes + en cours), groupes par status
 */

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

interface LeagueMember {
  readonly userId: string;
  readonly name: string | null;
  readonly email: string;
  readonly joinedAt: string;
  readonly isOwner: boolean;
}

interface LeagueDetail {
  readonly id: string;
  readonly name: string;
  readonly joinCode: string;
  readonly isPrivate: boolean;
  readonly isOwner: boolean;
  readonly ownerId: string;
  readonly memberCount: number;
  readonly createdAt: string;
  readonly members: readonly LeagueMember[];
}

interface LeaderboardEntry {
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly totalPicks: number;
  readonly correctPicks: number;
  readonly accuracy: number;
}

interface MyPick {
  readonly id: string;
  readonly matchId: string;
  readonly selection: string;
  readonly result: string | null;
  readonly correct: boolean | null;
  readonly createdAt: string;
  readonly match: {
    readonly id: string;
    readonly status: string;
    readonly scheduledAt: string | null;
    readonly homeTeamId: string;
    readonly awayTeamId: string;
    readonly scoreHome: number | null;
    readonly scoreAway: number | null;
  };
}

export default function PredictionLeagueDetailPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [detail, setDetail] = useState<LeagueDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<readonly LeaderboardEntry[]>(
    [],
  );
  const [picks, setPicks] = useState<readonly MyPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const load = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, lb, p] = await Promise.all([
        apiRequest<LeagueDetail>(
          `/pro-league/prediction-leagues/${leagueId}`,
        ),
        apiRequest<{ entries: LeaderboardEntry[] }>(
          `/pro-league/prediction-leagues/${leagueId}/leaderboard`,
        ),
        apiRequest<{ picks: MyPick[] }>(
          `/pro-league/prediction-leagues/${leagueId}/picks/me`,
        ),
      ]);
      setDetail(d);
      setLeaderboard(lb.entries);
      setPicks(p.picks);
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "Erreur";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyCode = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      // ignore — l'utilisateur peut copier manuellement
    }
  };

  if (loading) {
    return (
      <div
        className="text-sm text-gray-500"
        data-testid="league-detail-loading"
      >
        Chargement…
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="space-y-4">
        <div
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          data-testid="league-detail-error"
        >
          {error}
        </div>
        <Link
          href={"/pro-league/leagues" as any}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Mes ligues
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
            🎯 {detail.name}
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {detail.memberCount} membre{detail.memberCount > 1 ? "s" : ""}
            {detail.isOwner ? " · vous etes admin" : ""}
          </p>
        </div>
        <Link
          href={"/pro-league/leagues" as any}
          className="text-sm text-blue-700 hover:underline"
        >
          ← Mes ligues
        </Link>
      </div>

      <div
        className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between"
        data-testid="join-code-section"
      >
        <div>
          <div className="text-xs uppercase text-blue-700 font-semibold">
            Code de jonction
          </div>
          <code className="block mt-1 text-2xl font-mono tracking-widest text-blue-900">
            {detail.joinCode}
          </code>
          <div className="text-xs text-blue-700 mt-1">
            Partagez ce code pour inviter des amis dans la ligue.
          </div>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="px-3 py-1.5 rounded bg-white border border-blue-300 text-sm hover:bg-blue-100"
          data-testid="btn-copy-code"
        >
          {copiedCode ? "Copie !" : "Copier"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section
          className="p-5 rounded-xl border bg-white border-gray-200"
          data-testid="leaderboard"
        >
          <h2 className="text-lg font-semibold mb-3">🏆 Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucun pick n&apos;a encore ete enregistre.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-gray-600">
                <tr>
                  <th className="text-left py-1">#</th>
                  <th className="text-left py-1">Joueur</th>
                  <th className="text-right py-1">Bons</th>
                  <th className="text-right py-1">Total</th>
                  <th className="text-right py-1">%</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((e, i) => (
                  <tr
                    key={e.userId}
                    className="border-t border-gray-100"
                    data-testid={`lb-row-${e.userId}`}
                  >
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5">{e.userName ?? e.userEmail}</td>
                    <td className="py-1.5 text-right font-semibold">
                      {e.correctPicks}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {e.totalPicks}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {(e.accuracy * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section
          className="p-5 rounded-xl border bg-white border-gray-200"
          data-testid="members"
        >
          <h2 className="text-lg font-semibold mb-3">
            👥 Membres ({detail.memberCount})
          </h2>
          <ul className="text-sm space-y-1">
            {detail.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between py-1 border-b border-gray-50 last:border-none"
                data-testid={`member-${m.userId}`}
              >
                <span>{m.name ?? m.email}</span>
                {m.isOwner && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    OWNER
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        className="p-5 rounded-xl border bg-white border-gray-200"
        data-testid="my-picks"
      >
        <h2 className="text-lg font-semibold mb-3">📝 Mes picks</h2>
        {picks.length === 0 ? (
          <p className="text-sm text-gray-500">
            Vous n&apos;avez pas encore fait de pronostic. Allez sur la fiche
            d&apos;un match pour piquer un vainqueur.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left py-1">Match</th>
                <th className="text-left py-1">Pick</th>
                <th className="text-left py-1">Resultat</th>
                <th className="text-right py-1">Statut</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-gray-100"
                  data-testid={`pick-${p.id}`}
                >
                  <td className="py-1.5">
                    <Link
                      href={`/pro-league/matches/${p.matchId}` as any}
                      className="text-blue-700 hover:underline"
                    >
                      {p.match.homeTeamId} vs {p.match.awayTeamId}
                    </Link>
                  </td>
                  <td className="py-1.5 font-semibold capitalize">
                    {p.selection}
                  </td>
                  <td className="py-1.5">
                    {p.match.scoreHome != null && p.match.scoreAway != null
                      ? `${p.match.scoreHome}-${p.match.scoreAway}`
                      : "—"}
                  </td>
                  <td className="py-1.5 text-right">
                    {p.correct === true && (
                      <span className="text-emerald-700 font-semibold">
                        ✓
                      </span>
                    )}
                    {p.correct === false && (
                      <span className="text-rose-700 font-semibold">✗</span>
                    )}
                    {p.correct === null && (
                      <span className="text-gray-500 text-xs">en cours</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
