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
import { RaceIcon } from "../../../RaceIcon";
import { WeekPicker, type WeekPickerOption } from "../WeekPicker";
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
        <div>
          <p className="text-sm text-nuffle-anthracite/80">Semaine</p>
          <div className="mt-1">
            <WeekPicker
              weeks={weeks}
              value={weekId}
              onChange={setWeekId}
            />
          </div>
        </div>
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

      <OpponentBanner
        matchup={matchup}
        myEntryId={myEntry.id}
        entries={league.entries}
      />

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
          <div className="overflow-x-auto rounded-lg border border-nuffle-bronze/20 bg-white">
            <table className="w-full text-sm" data-testid="nfl-fantasy-lineup-table">
              <thead className="bg-white text-left text-xs uppercase tracking-wide text-nuffle-anthracite/70">
                <tr>
                  <th className="px-3 py-2">Starter</th>
                  <th className="px-3 py-2">Joueur</th>
                  <th className="px-3 py-2">BB pos</th>
                  <th className="px-3 py-2">NFL pos</th>
                  <th className="px-3 py-2">Équipe</th>
                  <th className="px-3 py-2 text-right">Cote</th>
                  <th className="px-3 py-2 text-right">Dernier match</th>
                  <th className="px-3 py-2 text-center">Rôle</th>
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
                        <StarterToggle
                          active={isSelected}
                          disabled={locked}
                          onClick={() => toggleStarter(playerId)}
                          testId={`lineup-select-${playerId}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-nuffle-anthracite">
                        <div className="flex items-center gap-2">
                          <RaceIcon
                            race={player?.bbRace ?? null}
                            label={player?.raceLabel ?? null}
                            className="text-base leading-none"
                          />
                          <Link
                            href={`/nfl-fantasy/players/${playerId}`}
                            className="font-medium hover:text-nuffle-bronze hover:underline"
                          >
                            {displayName(player)}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-nuffle-anthracite/80">{player?.bbPosition ?? "—"}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite/70">{player?.nflPosition ?? "—"}</td>
                      <td className="px-3 py-2 text-nuffle-anthracite/70">{player?.teamCode ?? "FA"}</td>
                      <td className="px-3 py-2 text-right font-mono text-nuffle-anthracite">
                        {player?.currentValue != null
                          ? `${player.currentValue} TV`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-nuffle-anthracite/80">
                        {player?.lastSpp != null ? (
                          <span
                            className="font-mono"
                            title={
                              player.lastWeekId
                                ? `Semaine ${player.lastWeekId}`
                                : undefined
                            }
                          >
                            {player.lastSpp} SPP
                          </span>
                        ) : (
                          <span className="text-xs text-nuffle-anthracite/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <RoleChip
                            label="C"
                            tooltip="Captain (×1.5)"
                            active={captainId === playerId}
                            disabled={locked || !isSelected}
                            tone="captain"
                            onClick={() =>
                              setCaptain(
                                captainId === playerId ? null : playerId,
                              )
                            }
                            testId={`lineup-captain-${playerId}`}
                          />
                          <RoleChip
                            label="V"
                            tooltip="Vice-captain (×1.2)"
                            active={viceCaptainId === playerId}
                            disabled={locked || !isSelected}
                            tone="vice"
                            onClick={() =>
                              setVice(
                                viceCaptainId === playerId ? null : playerId,
                              )
                            }
                            testId={`lineup-vice-${playerId}`}
                          />
                        </div>
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

// ────────── Toggles UI (checkbox + radio modernises) ──────────

interface StarterToggleProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}

/**
 * Toggle starter : remplace la checkbox native par un bouton rond
 * qui affiche ✓ quand actif (gold) et un cercle vide sinon. Plus
 * tactile (mobile) et plus visible.
 */
function StarterToggle({ active, disabled, onClick, testId }: StarterToggleProps) {
  const base =
    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-nuffle-gold/40";
  const activeClass = "border-nuffle-gold bg-nuffle-gold text-nuffle-anthracite shadow-sm";
  const inactiveClass = "border-nuffle-bronze/30 bg-white text-transparent hover:border-nuffle-gold hover:text-nuffle-gold/40";
  const disabledClass = "cursor-not-allowed opacity-50";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Retirer du lineup" : "Mettre dans le lineup"}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`${base} ${active ? activeClass : inactiveClass} ${disabled ? disabledClass : ""}`}
    >
      ✓
    </button>
  );
}

interface RoleChipProps {
  label: string;
  tooltip: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: "captain" | "vice";
  testId: string;
}

/**
 * Chip toggle Captain / Vice. Remplace les radio natifs par des
 * pastilles colorees, plus tactiles et plus lisibles. Captain :
 * gold gradient + couronne 👑 quand actif. Vice : silver gradient
 * + medaille 🥈. Clic sur le chip actif = deselection (toggle).
 */
function RoleChip({
  label,
  tooltip,
  active,
  disabled,
  onClick,
  tone,
  testId,
}: RoleChipProps) {
  const base =
    "inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-xs font-bold transition-all focus:outline-none focus:ring-2";
  const activeCaptain =
    "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-md ring-amber-200 focus:ring-amber-400";
  const activeVice =
    "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-50 shadow-md ring-slate-200 focus:ring-slate-400";
  const inactive =
    "bg-nuffle-bronze/10 text-nuffle-anthracite/60 hover:bg-nuffle-bronze/20 focus:ring-nuffle-gold/30";
  const disabledClass = "cursor-not-allowed opacity-30";

  const cls = active
    ? tone === "captain"
      ? activeCaptain
      : activeVice
    : inactive;
  const emoji = active ? (tone === "captain" ? "👑" : "🥈") : null;

  return (
    <button
      type="button"
      aria-pressed={active}
      title={tooltip}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`${base} ${cls} ${disabled ? disabledClass : ""}`}
    >
      {emoji ? <span className="mr-0.5">{emoji}</span> : null}
      {label}
    </button>
  );
}

interface OpponentBannerProps {
  matchup: NflFantasyMatchup | null;
  myEntryId: string;
  entries: ReadonlyArray<NflFantasyEntry>;
}

/**
 * Banniere "Tu joues contre X cette semaine". S'affiche entre le
 * picker semaine et la table du lineup. Si pas de matchup encore
 * genere pour cette semaine (cycle sans cycleId, ou settle pas
 * encore passe sur la 1ere semaine), n'affiche rien.
 */
function OpponentBanner({ matchup, myEntryId, entries }: OpponentBannerProps) {
  if (!matchup) return null;
  const opponentId =
    matchup.homeEntryId === myEntryId
      ? matchup.awayEntryId
      : matchup.homeEntryId;
  const opponent = entries.find((e) => e.id === opponentId);
  const opponentName = opponent?.teamName ?? "Adversaire inconnu";
  const isHome = matchup.homeEntryId === myEntryId;
  const settled = matchup.settledAt != null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-nuffle-bronze/30 bg-nuffle-ivory/40 px-4 py-3"
      data-testid="lineup-opponent-banner"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
          Tu joues {isHome ? "à domicile" : "à l'extérieur"} contre
        </p>
        <p className="text-base font-semibold text-nuffle-anthracite">
          🏈 {opponentName}
        </p>
      </div>
      {settled && (
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-nuffle-anthracite/60">
            Résultat
          </p>
          <p className="font-mono text-sm">
            {matchup.homeScore} - {matchup.awayScore}
            {matchup.winnerId === myEntryId && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Victoire
              </span>
            )}
            {matchup.winnerId !== null &&
              matchup.winnerId !== myEntryId && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Défaite
                </span>
              )}
            {matchup.winnerId === null && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Égalité
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
