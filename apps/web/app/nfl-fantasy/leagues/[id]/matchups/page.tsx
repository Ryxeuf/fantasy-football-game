"use client";

/**
 * Page matchups + standings d'une league.
 *
 *   - Section "Standings" : tableau agrege W-L-T-PF-PA derive de tous
 *     les matchups settles (computed cote serveur via getLeagueStandings).
 *   - Section "Matchups de la semaine" : selecteur weekId + liste des
 *     paires home/away avec scores + winner si settle.
 *
 * Pas d'auth restriction stricte : un user qui rejoint la league voit
 * tout, un user external 404 (route protegee par authUser + getLeague
 * cote backend).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import type {
  LeagueWithEntries,
  NflFantasyEntry,
  NflFantasyMatchup,
  StandingsRow,
} from "../../../types";

const DEFAULT_WEEK_ID = "2025:W10";

interface MeResponse {
  user?: { id?: string } | null;
}

function formatRecord(row: StandingsRow): string {
  if (row.ties === 0) return `${row.wins}-${row.losses}`;
  return `${row.wins}-${row.losses}-${row.ties}`;
}

function findTeamName(entries: NflFantasyEntry[], entryId: string): string {
  const e = entries.find((x) => x.id === entryId);
  return e?.teamName ?? entryId.slice(0, 8);
}

function matchupBadge(matchup: NflFantasyMatchup, userEntryId: string | null): string | null {
  if (!userEntryId) return null;
  if (matchup.homeEntryId !== userEntryId && matchup.awayEntryId !== userEntryId) {
    return null;
  }
  if (matchup.settledAt == null) return "Ton match";
  if (matchup.winnerId === userEntryId) return "Victoire 🎉";
  if (matchup.winnerId == null) return "Match nul";
  return "Défaite";
}

export default function MatchupsPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matchups, setMatchups] = useState<NflFantasyMatchup[]>([]);
  const [weekId, setWeekId] = useState(DEFAULT_WEEK_ID);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [busyMatchups, setBusyMatchups] = useState(false);

  // ────────── Load core (league + standings + me) ──────────

  const loadCore = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, st, me] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<{ standings: StandingsRow[] }>(
          `/api/nfl-fantasy/leagues/${leagueId}/standings`,
        ).catch(
          () => ({ standings: [] }) as { standings: StandingsRow[] },
        ),
        apiRequest<MeResponse>("/auth/me").catch(
          () => ({ user: null }) as MeResponse,
        ),
      ]);
      setLeague(lg);
      setStandings(st.standings);
      const uid = me.user?.id ?? null;
      const myEntry = uid ? lg.entries.find((e) => e.userId === uid) ?? null : null;
      setMyEntryId(myEntry?.id ?? null);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({ message: err instanceof Error ? err.message : "Erreur" });
      }
    }
  }, [leagueId]);

  const loadMatchups = useCallback(async () => {
    if (!leagueId) return;
    setBusyMatchups(true);
    try {
      const res = await apiRequest<{ matchups: NflFantasyMatchup[] }>(
        `/api/nfl-fantasy/leagues/${leagueId}/matchups?weekId=${encodeURIComponent(weekId)}`,
      );
      setMatchups(res.matchups);
    } catch (err) {
      // On laisse l'erreur silencieuse (peut etre 422 si weekId invalide
      // ou 404 si pas de matchups), on affiche un message vide.
      setMatchups([]);
    } finally {
      setBusyMatchups(false);
    }
  }, [leagueId, weekId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadMatchups();
  }, [loadMatchups]);

  // ────────── Render ──────────

  if (error?.status === 401) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
        >
          Se connecter
        </Link>
      </div>
    );
  }
  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">League introuvable</h1>
        <Link href="/nfl-fantasy" className="mt-4 inline-block text-sm text-orange-400">
          ← Retour
        </Link>
      </div>
    );
  }
  if (!league) {
    return <div className="text-sm text-slate-400">Chargement…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← {league.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Matchups &amp; standings</h1>
      </div>

      {/* Standings */}
      <section data-testid="nfl-fantasy-standings">
        <h2 className="text-lg font-semibold text-slate-200">Standings</h2>
        {standings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aucun matchup réglé pour l&apos;instant — les standings s&apos;affichent dès qu&apos;une semaine est settlée.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Équipe</th>
                  <th className="px-3 py-2 text-right">W-L-T</th>
                  <th className="px-3 py-2 text-right">PF</th>
                  <th className="px-3 py-2 text-right">PA</th>
                  <th className="px-3 py-2 text-right">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {standings.map((row, i) => {
                  const isMine = myEntryId !== null && row.entryId === myEntryId;
                  return (
                    <tr
                      key={row.entryId}
                      className={isMine ? "bg-orange-500/5" : undefined}
                    >
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-100">
                        {row.teamName}
                        {isMine && (
                          <span className="ml-2 rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[10px] uppercase text-orange-300">
                            Toi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-200">
                        {formatRecord(row)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {row.pointsFor}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {row.pointsAgainst}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          row.differential > 0
                            ? "text-emerald-300"
                            : row.differential < 0
                              ? "text-red-300"
                              : "text-slate-400"
                        }`}
                      >
                        {row.differential > 0 ? "+" : ""}
                        {row.differential}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Tri : victoires desc → différentiel desc → points marqués desc.
        </p>
      </section>

      {/* Matchups */}
      <section data-testid="nfl-fantasy-matchups">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-200">Matchups</h2>
          <label className="block text-sm">
            <span className="sr-only">Semaine</span>
            <input
              type="text"
              value={weekId}
              onChange={(e) => setWeekId(e.target.value)}
              pattern="\d{4}:W\d{1,2}"
              className="w-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-white focus:border-orange-400 focus:outline-none"
            />
          </label>
        </div>

        {busyMatchups && (
          <p className="mt-2 text-sm text-slate-500">Chargement…</p>
        )}

        {!busyMatchups && matchups.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">
            Aucun matchup pour {weekId} — l&apos;admin doit générer les matchups
            (route `generate-matchups`) ou attendre le settle hebdo.
          </p>
        )}

        {!busyMatchups && matchups.length > 0 && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {matchups.map((m) => {
              const settled = m.settledAt != null;
              const homeName = findTeamName(league.entries, m.homeEntryId);
              const awayName = findTeamName(league.entries, m.awayEntryId);
              const homeIsWinner = settled && m.winnerId === m.homeEntryId;
              const awayIsWinner = settled && m.winnerId === m.awayEntryId;
              const badge = matchupBadge(m, myEntryId);
              return (
                <li
                  key={m.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
                  data-testid={`nfl-fantasy-matchup-${m.id}`}
                >
                  {badge && (
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-orange-300">
                      {badge}
                    </p>
                  )}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className={homeIsWinner ? "text-emerald-300 font-semibold" : "text-slate-200"}>
                      {homeName}
                    </div>
                    <div className="font-mono text-lg text-slate-100">
                      {settled ? m.homeScore : "—"}{" "}
                      <span className="text-slate-500">vs</span>{" "}
                      {settled ? m.awayScore : "—"}
                    </div>
                    <div className={`text-right ${awayIsWinner ? "text-emerald-300 font-semibold" : "text-slate-200"}`}>
                      {awayName}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {settled
                      ? `Settled ${new Date(m.settledAt!).toLocaleDateString("fr-FR")}`
                      : "Non encore réglé"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
