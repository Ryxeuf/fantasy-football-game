"use client";

/**
 * Page lineup builder pour l'entry de l'utilisateur courant dans la
 * league. Affiche le roster (max 30 players), permet de choisir 11
 * starters + captain + vice, soumet PUT lineup.
 *
 * V1 minimal : pas de drag-and-drop, table avec checkboxes + radios.
 * Pas de regles positionnelles (lineup builder n'enforce que les
 * regles backend : 11 distincts, captain/vice in starters + distincts).
 */

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import type {
  LeagueWithEntries,
  NflFantasyEntry,
} from "../../../types";

interface NflPlayerInfo {
  id: string;
  pseudonym: string;
  realNameDisplay: boolean;
  teamCode: string | null;
  nflPosition: string;
  bbPosition: string;
  jerseyNumber: number | null;
  status: string;
}

interface RosterRow {
  rosterId: string;
  acquiredVia: string;
  acquiredAt: string;
  tvCost: number;
  player: NflPlayerInfo | null;
}

interface LineupStarter {
  id: string;
  playerId: string;
  bbPosition: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  rawSpp: number | null;
  finalSpp: number | null;
}

interface LineupResponse {
  lineup: {
    id: string;
    weekId: string;
    captainId: string | null;
    viceCaptainId: string | null;
    lockedAt: string | null;
    totalSpp: number | null;
    starters: LineupStarter[];
  } | null;
}

interface MeResponse {
  user?: { id?: string } | null;
}

const DEFAULT_WEEK_ID = "2025:W10";
const REQUIRED_STARTERS = 11;

function displayName(p: NflPlayerInfo | null): string {
  if (!p) return "(joueur inconnu)";
  return p.pseudonym;
}

export default function LineupBuilderPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [myEntry, setMyEntry] = useState<NflFantasyEntry | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [lineup, setLineup] = useState<LineupResponse["lineup"]>(null);
  const [weekId, setWeekId] = useState<string>(DEFAULT_WEEK_ID);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);

  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ────────── Load ──────────

  const loadCore = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, me] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<MeResponse>("/auth/me").catch(() => ({ user: null }) as MeResponse),
      ]);
      setLeague(lg);
      const userId = me.user?.id ?? null;
      const entry = userId
        ? lg.entries.find((e) => e.userId === userId) ?? null
        : null;
      setMyEntry(entry);
      setError(null);

      if (entry) {
        const rosterRes = await apiRequest<{ roster: RosterRow[] }>(
          `/api/nfl-fantasy/entries/${entry.id}/roster`,
        );
        setRoster(rosterRes.roster);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({ message: err instanceof Error ? err.message : "Erreur" });
      }
    }
  }, [leagueId]);

  // Charge le lineup courant de la week selectionnee
  const loadLineup = useCallback(async () => {
    if (!myEntry) return;
    try {
      const res = await apiRequest<LineupResponse>(
        `/api/nfl-fantasy/entries/${myEntry.id}/lineup?weekId=${encodeURIComponent(weekId)}`,
      );
      setLineup(res.lineup);
      if (res.lineup) {
        const next = new Set<string>(res.lineup.starters.map((s) => s.playerId));
        setSelected(next);
        setCaptainId(res.lineup.captainId);
        setViceCaptainId(res.lineup.viceCaptainId);
      } else {
        setSelected(new Set());
        setCaptainId(null);
        setViceCaptainId(null);
      }
    } catch (err) {
      // 404 -> pas de lineup encore, ok
      if (!(err instanceof ApiClientError) || err.status !== 404) {
        setActionError(err instanceof Error ? err.message : "Erreur lineup");
      }
    }
  }, [myEntry, weekId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadLineup();
  }, [loadLineup]);

  // ────────── Toggle handlers ──────────

  const toggleStarter = useCallback(
    (playerId: string) => {
      setActionError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
          if (captainId === playerId) setCaptainId(null);
          if (viceCaptainId === playerId) setViceCaptainId(null);
        } else {
          if (next.size >= REQUIRED_STARTERS) {
            setActionError(`Maximum ${REQUIRED_STARTERS} starters.`);
            return prev;
          }
          next.add(playerId);
        }
        return next;
      });
    },
    [captainId, viceCaptainId],
  );

  const setCaptain = useCallback(
    (playerId: string | null) => {
      setActionError(null);
      if (playerId && !selected.has(playerId)) return;
      setCaptainId(playerId);
      if (playerId && viceCaptainId === playerId) setViceCaptainId(null);
    },
    [selected, viceCaptainId],
  );

  const setVice = useCallback(
    (playerId: string | null) => {
      setActionError(null);
      if (playerId && !selected.has(playerId)) return;
      if (playerId && captainId === playerId) {
        setActionError("Captain et vice doivent être différents.");
        return;
      }
      setViceCaptainId(playerId);
    },
    [selected, captainId],
  );

  // ────────── Submit ──────────

  async function onSubmit(): Promise<void> {
    if (!myEntry) return;
    if (selected.size !== REQUIRED_STARTERS) {
      setActionError(`Il faut exactement ${REQUIRED_STARTERS} starters.`);
      return;
    }
    if (!captainId) {
      setActionError("Choisis un captain.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const byPlayerId = new Map(
        roster.filter((r) => r.player).map((r) => [r.player!.id, r.player!]),
      );
      const starters = Array.from(selected).map((playerId) => {
        const player = byPlayerId.get(playerId);
        return {
          playerId,
          bbPosition: player?.bbPosition ?? "Lineman",
        };
      });
      await apiRequest(`/api/nfl-fantasy/entries/${myEntry.id}/lineup`, {
        method: "PUT",
        body: JSON.stringify({
          weekId,
          starters,
          captainId,
          viceCaptainId: viceCaptainId ?? null,
        }),
      });
      await loadLineup();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  // ────────── Render ──────────

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) =>
      displayName(a.player).localeCompare(displayName(b.player)),
    );
  }, [roster]);

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
        <h1 className="text-xl font-semibold">League introuvable</h1>
        <Link
          href="/nfl-fantasy"
          className="mt-4 inline-block text-sm text-nuffle-gold hover:text-nuffle-gold"
        >
          ← Retour
        </Link>
      </div>
    );
  }

  if (!league) {
    return <div className="text-sm text-nuffle-anthracite/70">Chargement…</div>;
  }

  if (!myEntry) {
    return (
      <div className="rounded-lg border border-nuffle-bronze/20 bg-white p-6">
        <h1 className="text-xl font-semibold">Tu n&apos;es pas membre de cette league</h1>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="mt-4 inline-block text-sm text-nuffle-gold"
        >
          ← Détail
        </Link>
      </div>
    );
  }

  const locked = lineup?.lockedAt != null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← {league.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Lineup hebdo</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {myEntry.teamName} · roster {roster.length} joueurs · objectif{" "}
          {REQUIRED_STARTERS} starters + captain (×1.5) + vice (×1.2)
        </p>
      </div>

      <div className="flex items-end gap-4">
        <label className="block text-sm">
          <span className="text-nuffle-anthracite/80">Semaine</span>
          <input
            type="text"
            value={weekId}
            onChange={(e) => setWeekId(e.target.value)}
            pattern="\d{4}:W\d{1,2}"
            className="mt-1 w-40 rounded-md border border-nuffle-bronze/30 bg-white px-3 py-1.5 font-mono text-sm text-nuffle-anthracite focus:border-nuffle-gold focus:outline-none"
          />
        </label>
        {lineup && (
          <p className="text-xs text-nuffle-anthracite/70">
            Lineup actuel : {lineup.starters.length} starters,{" "}
            {locked
              ? `lockée ${new Date(lineup.lockedAt!).toLocaleString("fr-FR")}`
              : "non lockée"}
            {lineup.totalSpp !== null && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                {lineup.totalSpp} SPP
              </span>
            )}
          </p>
        )}
      </div>

      {locked && (
        <div className="rounded-md border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-700">
          ⚠ Lineup lockée : tu ne peux plus la modifier pour cette semaine.
        </div>
      )}

      {roster.length === 0 && (
        <div className="rounded-lg border border-dashed border-nuffle-bronze/20 bg-white p-10 text-center">
          <p className="text-base text-nuffle-anthracite/80">Roster vide.</p>
          <p className="mt-1 text-sm text-nuffle-anthracite/60">
            Demande à l&apos;admin de lancer l&apos;auto-fill rosters.
          </p>
        </div>
      )}

      {roster.length > 0 && (
        <>
          <div className="rounded-lg border border-nuffle-bronze/20 bg-white">
            <table className="w-full text-sm" data-testid="nfl-fantasy-lineup-table">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
                <tr>
                  <th className="px-3 py-2">Starter</th>
                  <th className="px-3 py-2">Joueur</th>
                  <th className="px-3 py-2">BB pos</th>
                  <th className="px-3 py-2">NFL pos</th>
                  <th className="px-3 py-2">Équipe</th>
                  <th className="px-3 py-2 text-center">C ×1.5</th>
                  <th className="px-3 py-2 text-center">V ×1.2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nuffle-bronze/20">
                {sortedRoster.map((row) => {
                  const player = row.player;
                  const playerId = player?.id ?? "";
                  if (!playerId) return null;
                  const isSelected = selected.has(playerId);
                  return (
                    <tr
                      key={row.rosterId}
                      className={isSelected ? "bg-nuffle-gold/5" : undefined}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={locked}
                          onChange={() => toggleStarter(playerId)}
                          data-testid={`lineup-select-${playerId}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-nuffle-anthracite">{displayName(player)}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite/80">{player?.bbPosition ?? "—"}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite/70">{player?.nflPosition ?? "—"}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite/70">{player?.teamCode ?? "FA"}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="radio"
                          name="captain"
                          checked={captainId === playerId}
                          disabled={locked || !isSelected}
                          onChange={() => setCaptain(playerId)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="radio"
                          name="vice"
                          checked={viceCaptainId === playerId}
                          disabled={locked || !isSelected}
                          onChange={() => setVice(playerId)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-nuffle-anthracite/70">
              {selected.size}/{REQUIRED_STARTERS} starters ·
              {captainId ? " captain ✓" : " captain ✗"} ·
              {viceCaptainId ? " vice ✓" : " vice (optionnel)"}
            </div>
            <div className="flex items-center gap-3">
              {actionError && (
                <span className="text-xs text-red-700">{actionError}</span>
              )}
              <button
                onClick={onSubmit}
                disabled={
                  locked ||
                  submitting ||
                  selected.size !== REQUIRED_STARTERS ||
                  !captainId
                }
                className="rounded-md bg-nuffle-gold px-4 py-2 text-sm font-medium text-nuffle-anthracite hover:bg-nuffle-gold/80 disabled:cursor-not-allowed disabled:bg-nuffle-bronze/20"
                data-testid="lineup-submit"
              >
                {submitting ? "Enregistrement…" : "Enregistrer le lineup"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
