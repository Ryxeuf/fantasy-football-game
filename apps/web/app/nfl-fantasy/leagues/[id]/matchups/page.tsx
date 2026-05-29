"use client";

/**
 * Page matchups + standings d'un championnat.
 *
 *   - Section "Standings" : tableau agrege W-L-T-PF-PA derive de tous
 *     les matchups settles (computed cote serveur via getLeagueStandings).
 *   - Section "Matchups de la semaine" : selecteur weekId + liste des
 *     paires home/away avec scores + winner si settle.
 *
 * Pas d'auth restriction stricte : un user qui rejoint le championnat voit
 * tout, un user external 404 (route protegee par authUser + getLeague
 * cote backend).
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import { WeekPicker } from "../WeekPicker";
import type {
  LeagueWithEntries,
  NflFantasyEntry,
  NflFantasyMatchup,
  StandingsRow,
} from "../../../types";

interface MeResponse {
  user?: { id?: string } | null;
}

interface LeagueWeekRow {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  isPlayoffs: boolean;
  matchupCount: number;
  settledCount: number;
}

interface LeagueWeeksResponse {
  weeks: LeagueWeekRow[];
  defaultWeekId: string | null;
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
  const [weeks, setWeeks] = useState<LeagueWeekRow[]>([]);
  const [weekId, setWeekId] = useState<string>("");
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [busyMatchups, setBusyMatchups] = useState(false);

  // ────────── Load core (league + standings + me) ──────────

  const loadCore = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, st, me, wks] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<{ standings: StandingsRow[] }>(
          `/api/nfl-fantasy/leagues/${leagueId}/standings`,
        ).catch(
          () => ({ standings: [] }) as { standings: StandingsRow[] },
        ),
        apiRequest<MeResponse>("/auth/me").catch(
          () => ({ user: null }) as MeResponse,
        ),
        apiRequest<LeagueWeeksResponse>(
          `/api/nfl-fantasy/leagues/${leagueId}/weeks`,
        ).catch(
          () =>
            ({ weeks: [], defaultWeekId: null }) as LeagueWeeksResponse,
        ),
      ]);
      setLeague(lg);
      setStandings(st.standings);
      setWeeks(wks.weeks);
      // Selectionne la semaine par defaut renvoyee par le serveur
      // (en cours, sinon derniere settled, sinon 1ere) — uniquement si
      // l'user n'a pas deja change manuellement la selection.
      if (!weekId && wks.defaultWeekId) {
        setWeekId(wks.defaultWeekId);
      }
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
  }, [leagueId, weekId]);

  const loadMatchups = useCallback(async () => {
    if (!leagueId || !weekId) return;
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
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Authentification requise</h1>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center rounded-md bg-nuffle-gold px-3 py-1.5 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80"
        >
          Se connecter
        </Link>
      </div>
    );
  }
  if (error?.status === 404 || error?.status === 403) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Championnat introuvable</h1>
        <Link href="/nfl-fantasy" className="mt-4 inline-block text-sm text-nuffle-gold">
          ← Retour
        </Link>
      </div>
    );
  }
  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← {league.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Matchups &amp; standings</h1>
      </div>

      {/* Standings */}
      <section data-testid="nfl-fantasy-standings">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">Standings</h2>
        {standings.length === 0 ? (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">
            Aucun matchup réglé pour l&apos;instant — les standings s&apos;affichent dès qu&apos;une semaine est settlée.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-nuffle-bronze/20 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Équipe</th>
                  <th className="px-3 py-2 text-right">W-L-T</th>
                  <th className="px-3 py-2 text-right">PF</th>
                  <th className="px-3 py-2 text-right">PA</th>
                  <th className="px-3 py-2 text-right">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nuffle-bronze/20">
                {standings.map((row, i) => {
                  const isMine = myEntryId !== null && row.entryId === myEntryId;
                  return (
                    <tr
                      key={row.entryId}
                      className={isMine ? "bg-nuffle-gold/5" : undefined}
                    >
                      <td className="px-3 py-2 text-nuffle-anthracite/60">{i + 1}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite">
                        {row.teamName}
                        {isMine && (
                          <span className="ml-2 rounded-full bg-nuffle-gold/20 px-1.5 py-0.5 text-[10px] uppercase text-nuffle-gold">
                            Toi
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-nuffle-anthracite">
                        {formatRecord(row)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-nuffle-anthracite/80">
                        {row.pointsFor}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-nuffle-anthracite/80">
                        {row.pointsAgainst}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          row.differential > 0
                            ? "text-emerald-700"
                            : row.differential < 0
                              ? "text-red-700"
                              : "text-nuffle-anthracite/70"
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
        <p className="mt-2 text-[11px] text-nuffle-anthracite/60">
          Tri : victoires desc → différentiel desc → points marqués desc.
        </p>
      </section>

      {/* Matchups */}
      <section data-testid="nfl-fantasy-matchups">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-nuffle-anthracite">Matchups</h2>
          <WeekPicker
            weeks={weeks}
            value={weekId}
            onChange={setWeekId}
          />
        </div>

        {busyMatchups && (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">Chargement…</p>
        )}

        {!busyMatchups && matchups.length === 0 && (
          <p className="mt-2 text-sm text-nuffle-anthracite/60">
            Aucun matchup généré pour cette semaine. Les matchups sont
            pré-générés au démarrage de la saison ; si tu vois ce message,
            le championnat n&apos;a peut-être pas encore été démarré.
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
                <li key={m.id} data-testid={`nfl-fantasy-matchup-${m.id}`}>
                  <Link
                    href={`/nfl-fantasy/leagues/${league.id}/matchups/${m.id}`}
                    className="block rounded-lg border border-nuffle-bronze/20 bg-white p-4 transition-colors hover:border-nuffle-gold/60 hover:bg-nuffle-gold/5"
                  >
                    {badge && (
                      <p className="mb-2 text-[10px] uppercase tracking-wide text-nuffle-gold">
                        {badge}
                      </p>
                    )}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className={homeIsWinner ? "text-emerald-700 font-semibold" : "text-nuffle-anthracite"}>
                        {homeName}
                      </div>
                      <div className="font-mono text-lg text-nuffle-anthracite">
                        {settled ? m.homeScore : "—"}{" "}
                        <span className="text-nuffle-anthracite/60">vs</span>{" "}
                        {settled ? m.awayScore : "—"}
                      </div>
                      <div className={`text-right ${awayIsWinner ? "text-emerald-700 font-semibold" : "text-nuffle-anthracite"}`}>
                        {awayName}
                      </div>
                    </div>
                    <p className="mt-2 flex items-center justify-between text-[11px] text-nuffle-anthracite/60">
                      <span>
                        {settled
                          ? `Settled ${new Date(m.settledAt!).toLocaleDateString("fr-FR")}`
                          : "Non encore réglé"}
                      </span>
                      <span className="text-nuffle-gold">Voir le détail →</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
