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
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiRequest, ApiClientError } from "../../../../lib/api-client";
import { WeekPicker, type WeekPickerOption } from "../WeekPicker";
import { OpponentBanner } from "./OpponentBanner";
import { PlayerCard } from "./PlayerCard";
import type {
  LeagueWithEntries,
  NflFantasyEntry,
  NflFantasyMatchup,
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
  currentValue?: number;
  bbRace?: string | null;
  raceLabel?: string | null;
  lastSpp?: number | null;
  lastWeekId?: string | null;
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

const REQUIRED_STARTERS = 11;

interface LeagueWeeksResponse {
  weeks: WeekPickerOption[];
  defaultWeekId: string | null;
}

type SortKey =
  | "value-desc"
  | "value-asc"
  | "lastSpp-desc"
  | "name-asc"
  | "position";

const SORT_LABELS: Readonly<Record<SortKey, string>> = {
  "value-desc": "Cote ↓",
  "value-asc": "Cote ↑",
  "lastSpp-desc": "Dernier SPP ↓",
  "name-asc": "Nom A→Z",
  position: "Position BB",
};

function sortPlayers(rows: RosterRow[], by: SortKey): RosterRow[] {
  return [...rows].sort((a, b) => {
    const pa = a.player;
    const pb = b.player;
    if (!pa || !pb) return 0;
    switch (by) {
      case "value-desc":
        return (pb.currentValue ?? 0) - (pa.currentValue ?? 0);
      case "value-asc":
        return (pa.currentValue ?? 0) - (pb.currentValue ?? 0);
      case "lastSpp-desc":
        return (pb.lastSpp ?? -1) - (pa.lastSpp ?? -1);
      case "name-asc":
        return pa.pseudonym.localeCompare(pb.pseudonym);
      case "position":
        return (
          pa.bbPosition.localeCompare(pb.bbPosition) ||
          (pb.currentValue ?? 0) - (pa.currentValue ?? 0)
        );
    }
  });
}

export default function LineupBuilderPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [league, setLeague] = useState<LeagueWithEntries | null>(null);
  const [myEntry, setMyEntry] = useState<NflFantasyEntry | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [lineup, setLineup] = useState<LineupResponse["lineup"]>(null);
  const [weekId, setWeekId] = useState<string>("");
  const [weeks, setWeeks] = useState<WeekPickerOption[]>([]);
  const [matchup, setMatchup] = useState<NflFantasyMatchup | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);

  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtres/tri pour la section Disponibles. State purement client.
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("value-desc");
  const [positionFilter, setPositionFilter] = useState<string | null>(null);

  // ────────── Load ──────────

  const loadCore = useCallback(async () => {
    if (!leagueId) return;
    try {
      const [lg, me, wks] = await Promise.all([
        apiRequest<LeagueWithEntries>(`/api/nfl-fantasy/leagues/${leagueId}`),
        apiRequest<MeResponse>("/auth/me").catch(() => ({ user: null }) as MeResponse),
        apiRequest<LeagueWeeksResponse>(
          `/api/nfl-fantasy/leagues/${leagueId}/weeks`,
        ).catch(
          () => ({ weeks: [], defaultWeekId: null }) as LeagueWeeksResponse,
        ),
      ]);
      setLeague(lg);
      setWeeks(wks.weeks);
      if (!weekId && wks.defaultWeekId) {
        setWeekId(wks.defaultWeekId);
      }
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
  }, [leagueId, weekId]);

  // Charge le lineup + le matchup de la semaine selectionnee. Le
  // matchup permet d'afficher contre quel coach on joue (les
  // matchups sont pre-generes des le demarrage de la saison).
  const loadLineup = useCallback(async () => {
    if (!myEntry || !leagueId || !weekId) return;
    try {
      const [lineupRes, matchupsRes] = await Promise.all([
        apiRequest<LineupResponse>(
          `/api/nfl-fantasy/entries/${myEntry.id}/lineup?weekId=${encodeURIComponent(weekId)}`,
        ).catch((err) => {
          if (err instanceof ApiClientError && err.status === 404) {
            return { lineup: null } as LineupResponse;
          }
          throw err;
        }),
        apiRequest<{ matchups: NflFantasyMatchup[] }>(
          `/api/nfl-fantasy/leagues/${leagueId}/matchups?weekId=${encodeURIComponent(weekId)}`,
        ).catch(() => ({ matchups: [] }) as { matchups: NflFantasyMatchup[] }),
      ]);
      setLineup(lineupRes.lineup);
      if (lineupRes.lineup) {
        const next = new Set<string>(
          lineupRes.lineup.starters.map((s) => s.playerId),
        );
        setSelected(next);
        setCaptainId(lineupRes.lineup.captainId);
        setViceCaptainId(lineupRes.lineup.viceCaptainId);
      } else {
        setSelected(new Set());
        setCaptainId(null);
        setViceCaptainId(null);
      }
      const mine = matchupsRes.matchups.find(
        (m) => m.homeEntryId === myEntry.id || m.awayEntryId === myEntry.id,
      );
      setMatchup(mine ?? null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur lineup");
    }
  }, [myEntry, leagueId, weekId]);

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

  // ────────── Render derivations ──────────

  // Split roster en starters (selectionnes) et available (banc).
  // Le tri des starters : captain en 1er, vice en 2e, puis ordre
  // d'ajout via selected (preservation Set order).
  const selectedRoster = useMemo(() => {
    const inSelection = roster.filter(
      (r) => r.player && selected.has(r.player.id),
    );
    inSelection.sort((a, b) => {
      const aId = a.player!.id;
      const bId = b.player!.id;
      const aRank =
        aId === captainId ? 0 : aId === viceCaptainId ? 1 : 2;
      const bRank =
        bId === captainId ? 0 : bId === viceCaptainId ? 1 : 2;
      if (aRank !== bRank) return aRank - bRank;
      // tiebreak: par cote desc pour visibilite des meilleurs
      const av = a.player!.currentValue ?? 0;
      const bv = b.player!.currentValue ?? 0;
      if (av !== bv) return bv - av;
      return a.player!.pseudonym.localeCompare(b.player!.pseudonym);
    });
    return inSelection;
  }, [roster, selected, captainId, viceCaptainId]);

  const availableRoster = useMemo(() => {
    return roster.filter(
      (r) => r.player && !selected.has(r.player.id),
    );
  }, [roster, selected]);

  // Liste des positions BB presentes dans le roster (pour chips filtre).
  const bbPositions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster) {
      if (r.player?.bbPosition) set.add(r.player.bbPosition);
    }
    return Array.from(set).sort();
  }, [roster]);

  // Comptage par BB position sur la SELECTION (utile pour quotas).
  const positionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of selectedRoster) {
      const pos = r.player?.bbPosition ?? "?";
      counts.set(pos, (counts.get(pos) ?? 0) + 1);
    }
    return counts;
  }, [selectedRoster]);

  // Pipe filtre + tri sur la liste Available.
  const filteredAvailable = useMemo(() => {
    const norm = search.trim().toLowerCase();
    let list = availableRoster.filter((r) => {
      if (!r.player) return false;
      if (norm && !r.player.pseudonym.toLowerCase().includes(norm)) {
        return false;
      }
      if (positionFilter && r.player.bbPosition !== positionFilter) {
        return false;
      }
      return true;
    });
    list = sortPlayers(list, sortBy);
    return list;
  }, [availableRoster, search, positionFilter, sortBy]);

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
        <h1 className="text-xl font-semibold">Tu n&apos;es pas membre de ce championnat</h1>
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
  const canAddMore = selected.size < REQUIRED_STARTERS;

  return (
    <div className="space-y-4">
      {/* Header compact */}
      <div>
        <Link
          href={`/nfl-fantasy/leagues/${league.id}`}
          className="text-sm text-nuffle-anthracite/70 hover:text-nuffle-bronze"
        >
          ← {league.name}
        </Link>
        <h1 className="mt-2 text-xl font-semibold sm:text-2xl">Lineup hebdo</h1>
        <p className="mt-1 text-sm text-nuffle-anthracite/70">
          {myEntry.teamName} ·{" "}
          <span className="text-nuffle-anthracite/50">
            {roster.length} joueurs · 11 starters + ×1.5/×1.2
          </span>
        </p>
      </div>

      {/* Week + status compact */}
      <div className="flex flex-wrap items-center gap-3">
        <WeekPicker weeks={weeks} value={weekId} onChange={setWeekId} />
        {lineup && lineup.totalSpp !== null && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
            Total {lineup.totalSpp} SPP
          </span>
        )}
        {lineup && (
          <span className="text-xs text-nuffle-anthracite/60">
            {locked
              ? `Lockée ${new Date(lineup.lockedAt!).toLocaleString("fr-FR")}`
              : "Brouillon"}
          </span>
        )}
      </div>

      {/* Adversaire */}
      <OpponentBanner
        matchup={matchup}
        myEntryId={myEntry.id}
        entries={league.entries}
      />

      {locked && (
        <div
          className="rounded-md border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-800"
          role="status"
        >
          🔒 Lineup lockée — tu ne peux plus la modifier pour cette semaine.
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
          {/* Section : Ma selection (XXX/11) avec quotas par position */}
          <section
            className="rounded-xl border border-nuffle-bronze/20 bg-white p-3 shadow-sm sm:p-4"
            data-testid="lineup-selected-section"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-nuffle-anthracite">
                Ma sélection{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    selected.size === REQUIRED_STARTERS
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-nuffle-bronze/15 text-nuffle-anthracite/70"
                  }`}
                >
                  {selected.size}/{REQUIRED_STARTERS}
                </span>
              </h2>
              <div className="text-xs text-nuffle-anthracite/60">
                {captainId ? "👑 ✓" : "👑 manquant"} ·{" "}
                {viceCaptainId ? "🥈 ✓" : "🥈 optionnel"}
              </div>
            </div>

            {positionCounts.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(positionCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([pos, n]) => (
                    <span
                      key={pos}
                      className="rounded-full bg-nuffle-ivory/60 px-2 py-0.5 text-[11px] font-medium text-nuffle-anthracite"
                      title={`${n} ${pos}`}
                    >
                      {pos} <strong>{n}</strong>
                    </span>
                  ))}
              </div>
            )}

            {selectedRoster.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-nuffle-bronze/20 px-3 py-6 text-center text-sm text-nuffle-anthracite/60">
                Aucun starter sélectionné. Pick-toi 11 joueurs depuis le
                banc ci-dessous, puis un captain.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedRoster.map((row) => {
                  const pid = row.player!.id;
                  return (
                    <PlayerCard
                      key={row.rosterId}
                      row={row}
                      isStarter
                      isCaptain={captainId === pid}
                      isVice={viceCaptainId === pid}
                      locked={locked}
                      canAddMore={canAddMore}
                      onToggle={() => toggleStarter(pid)}
                      onCaptain={() =>
                        setCaptain(captainId === pid ? null : pid)
                      }
                      onVice={() => setVice(viceCaptainId === pid ? null : pid)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Section : Disponibles + filtres + tri + search */}
          {!locked && (
            <section
              className="rounded-xl border border-nuffle-bronze/20 bg-white p-3 shadow-sm sm:p-4"
              data-testid="lineup-available-section"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-nuffle-anthracite">
                  Disponibles{" "}
                  <span className="ml-1 rounded-full bg-nuffle-bronze/15 px-2 py-0.5 text-xs font-bold text-nuffle-anthracite/70">
                    {filteredAvailable.length}
                  </span>
                </h2>
              </div>

              {/* Filter / sort bar — sticky en mobile pour que les
                  controles restent accessibles en scrollant */}
              <div className="sticky top-0 z-10 -mx-3 mt-3 bg-white/95 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Filtrer par nom…"
                    className="w-full rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm focus:border-nuffle-gold focus:outline-none sm:max-w-xs"
                    data-testid="lineup-search"
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="rounded-md border border-nuffle-bronze/30 bg-white px-3 py-2 text-sm focus:border-nuffle-gold focus:outline-none"
                    data-testid="lineup-sort"
                  >
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <option key={k} value={k}>
                        {SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                {bbPositions.length > 1 && (
                  <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    <PositionChip
                      label="Tous"
                      active={positionFilter === null}
                      onClick={() => setPositionFilter(null)}
                    />
                    {bbPositions.map((p) => (
                      <PositionChip
                        key={p}
                        label={p}
                        active={positionFilter === p}
                        onClick={() =>
                          setPositionFilter(positionFilter === p ? null : p)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {filteredAvailable.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-nuffle-bronze/20 px-3 py-6 text-center text-sm text-nuffle-anthracite/60">
                  {availableRoster.length === 0
                    ? "Tous les joueurs du roster sont dans ton lineup."
                    : "Aucun joueur ne matche ces filtres."}
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {filteredAvailable.map((row) => {
                    const pid = row.player!.id;
                    return (
                      <PlayerCard
                        key={row.rosterId}
                        row={row}
                        isStarter={false}
                        isCaptain={false}
                        isVice={false}
                        locked={locked}
                        canAddMore={canAddMore}
                        onToggle={() => toggleStarter(pid)}
                        onCaptain={() => {}}
                        onVice={() => {}}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Sticky bottom action bar : suit la largeur du conteneur
              parent (vs fixed inset-x-0 qui debordait sur les pages
              avec gutter). Reste pousse en bas du viewport tant que
              l'utilisateur n'a pas scrolle jusqu'au bas de la page. */}
          {!locked && (
            <div
              className="sticky bottom-0 z-30 rounded-t-xl border border-nuffle-bronze/20 bg-white/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur sm:px-4"
              data-testid="lineup-action-bar"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">
                      {selected.size}/{REQUIRED_STARTERS}
                    </span>
                    <span className="text-nuffle-anthracite/60">starters</span>
                    {captainId && (
                      <span title="Captain choisi" className="text-amber-600">
                        👑
                      </span>
                    )}
                    {viceCaptainId && (
                      <span title="Vice choisi" className="text-slate-500">
                        🥈
                      </span>
                    )}
                  </div>
                  {actionError ? (
                    <p className="mt-0.5 truncate text-xs text-red-700">
                      {actionError}
                    </p>
                  ) : !captainId && selected.size > 0 ? (
                    <p className="mt-0.5 text-xs text-amber-700">
                      Choisis un captain pour valider
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={onSubmit}
                  disabled={
                    locked ||
                    submitting ||
                    selected.size !== REQUIRED_STARTERS ||
                    !captainId
                  }
                  className="shrink-0 rounded-md bg-nuffle-gold px-4 py-2.5 text-sm font-semibold text-nuffle-anthracite shadow-sm hover:bg-nuffle-gold/90 disabled:cursor-not-allowed disabled:bg-nuffle-bronze/20 disabled:text-nuffle-anthracite/40"
                  data-testid="lineup-submit"
                >
                  {submitting ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface PositionChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function PositionChip({ label, active, onClick }: PositionChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-nuffle-gold bg-nuffle-gold text-nuffle-anthracite"
          : "border-nuffle-bronze/30 bg-white text-nuffle-anthracite/70 hover:border-nuffle-gold/50"
      }`}
    >
      {label}
    </button>
  );
}

