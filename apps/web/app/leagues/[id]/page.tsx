"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import {
  LEAGUE_FLAG,
  LEAGUE_INVITATIONS_FLAG,
} from "../../lib/featureFlagKeys";
import { SeasonCalendar } from "./SeasonCalendar";
import { InviteCoachModal } from "./InviteCoachModal";
import { SentInvitationsPanel } from "./SentInvitationsPanel";
import { TestParticipantButton } from "./TestParticipantButton";
import { SeasonStandings } from "./SeasonStandings";
import { PlayoffBracketView } from "./PlayoffBracketView";
import { SeasonParticipants } from "./SeasonParticipants";
import { NewSeasonModal } from "./NewSeasonModal";
import { SeasonAdminPanel } from "./SeasonAdminPanel";
import { JoinSeasonModal } from "./JoinSeasonModal";
import { MeceneButton } from "./MeceneButton";
import type {
  LeagueDetail,
  LeagueSeasonDetail,
  StandingRow,
} from "./types";

// S25.5d — `apiRequest<T>` (lib/api-client) prend en charge `API_BASE`,
// l'`Authorization: Bearer ...`, et l'unwrap de l'enveloppe
// `ApiResponse<T>` quand le serveur l'expose. Tolere encore le format
// legacy le temps que les success paths de `routes/league.ts` soient
// migres (cf. roadmap S25.5).

interface MeResponse {
  user: { id: string } | null;
}

export default function LeagueDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const leagueId = typeof params.id === "string" ? params.id : "";
  const leagueEnabled = useFeatureFlag(LEAGUE_FLAG);
  const invitationsEnabled = useFeatureFlag(LEAGUE_INVITATIONS_FLAG);

  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [season, setSeason] = useState<LeagueSeasonDetail | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [showSeasonElo, setShowSeasonElo] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newSeasonOpen, setNewSeasonOpen] = useState(false);
  const [joinSeasonOpen, setJoinSeasonOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitationsRefreshKey, setInvitationsRefreshKey] = useState(0);

  // Charge l'identite courante une seule fois pour permettre au
  // calendrier de decider quels boutons "Lancer le match" afficher et
  // au panneau admin de se montrer uniquement au creator.
  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const me = await apiRequest<MeResponse>("/auth/me");
        if (!cancelled) setCurrentUserId(me.user?.id ?? null);
      } catch {
        if (!cancelled) setCurrentUserId(null);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    async function loadLeague() {
      try {
        setLoading(true);
        setError(null);
        const { league: data } = await apiRequest<{ league: LeagueDetail }>(
          `/leagues/${leagueId}`,
        );
        if (cancelled) return;
        setLeague(data);
        setSelectedSeasonId((prev) => {
          if (prev) return prev;
          return data.seasons.length > 0
            ? data.seasons[data.seasons.length - 1].id
            : null;
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t.leagues.errorLoad);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLeague();
    return () => {
      cancelled = true;
    };
  }, [leagueId, t.leagues.errorLoad]);

  const loadSeason = useCallback(
    async (seasonId: string) => {
      try {
        setSeasonLoading(true);
        setSeasonError(null);
        const [seasonRes, standingsRes] = await Promise.all([
          apiRequest<{ season: LeagueSeasonDetail }>(
            `/leagues/seasons/${seasonId}`,
          ),
          apiRequest<{
            seasonId: string;
            standings: StandingRow[];
            showSeasonElo?: boolean;
          }>(`/leagues/seasons/${seasonId}/standings`),
        ]);
        setSeason(seasonRes.season);
        setStandings(standingsRes.standings);
        setShowSeasonElo(standingsRes.showSeasonElo === true);
      } catch (e: unknown) {
        setSeason(null);
        setStandings([]);
        setShowSeasonElo(false);
        setSeasonError(
          e instanceof Error ? e.message : t.leagues.seasonError,
        );
      } finally {
        setSeasonLoading(false);
      }
    },
    [t.leagues.seasonError],
  );

  useEffect(() => {
    if (!selectedSeasonId) {
      setSeason(null);
      setStandings([]);
      return;
    }
    loadSeason(selectedSeasonId);
  }, [selectedSeasonId, loadSeason]);

  const rulesetLabels = useMemo<Record<string, string>>(
    () => ({
      season_2: t.leagues.rulesetSeason2,
      season_3: t.leagues.rulesetSeason3,
    }),
    [t.leagues.rulesetSeason2, t.leagues.rulesetSeason3],
  );

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      draft: t.leagues.statusDraft,
      open: t.leagues.statusOpen,
      in_progress: t.leagues.statusInProgress,
      completed: t.leagues.statusCompleted,
      archived: t.leagues.statusArchived,
    }),
    [
      t.leagues.statusArchived,
      t.leagues.statusCompleted,
      t.leagues.statusDraft,
      t.leagues.statusInProgress,
      t.leagues.statusOpen,
    ],
  );

  const seasonStatusLabels = useMemo<Record<string, string>>(
    () => ({
      draft: t.leagues.seasonStatusDraft,
      scheduled: t.leagues.seasonStatusScheduled,
      in_progress: t.leagues.seasonStatusInProgress,
      completed: t.leagues.seasonStatusCompleted,
    }),
    [
      t.leagues.seasonStatusCompleted,
      t.leagues.seasonStatusDraft,
      t.leagues.seasonStatusInProgress,
      t.leagues.seasonStatusScheduled,
    ],
  );

  const isCreator = useMemo(() => {
    if (!league || !currentUserId) return false;
    return league.creatorId === currentUserId;
  }, [league, currentUserId]);

  const registeredTeamIds = useMemo<string[]>(() => {
    if (!season) return [];
    return season.participants.map((p) => p.teamId);
  }, [season]);

  const canJoinSeason = useMemo(() => {
    if (!leagueEnabled || !season || !currentUserId) return false;
    if (isCreator) return false;
    // Inscriptions ouvertes uniquement avant le demarrage de la saison.
    return season.status === "draft" || season.status === "scheduled";
  }, [leagueEnabled, season, currentUserId, isCreator]);

  // L2.B.5 — participant actif du coach courant (si inscrit). Sert au
  // bouton "Coup de mecene" et au lien "Gerer mon equipe".
  const myParticipant = useMemo(() => {
    if (!season || !currentUserId) return null;
    return (
      season.participants.find(
        (p) => p.team.owner.id === currentUserId && p.status === "active",
      ) ?? null
    );
  }, [season, currentUserId]);

  const canPlayMecene = useMemo(() => {
    if (!myParticipant || !season) return false;
    return season.status === "in_progress";
  }, [myParticipant, season]);

  if (loading) {
    return (
      <div className="w-full p-6">
        <p>{t.common.loading}</p>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div data-testid="league-error" className="w-full p-6 space-y-4">
        <p className="text-red-600">
          {t.common.error} : {error ?? t.leagues.errorLoad}
        </p>
        <Link
          href="/leagues"
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          ← {t.leagues.backToLeagues}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="league-detail-page"
      className="w-full p-4 sm:p-6 space-y-6"
    >
      <div>
        <Link
          href="/leagues"
          className="text-sm text-gray-600 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
        >
          ← {t.leagues.backToLeagues}
        </Link>
        <div className="flex flex-wrap items-start gap-3 mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-nuffle-anthracite">
            {league.name}
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-nuffle-gold/10 border border-nuffle-gold/30 text-nuffle-bronze">
            {statusLabels[league.status] ?? league.status}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            {rulesetLabels[league.ruleset] ?? league.ruleset}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {league.isPublic
              ? t.leagues.visibilityPublic
              : t.leagues.visibilityPrivate}
          </span>
          {/* L2.D — edition reservee au commissaire, tant que la ligue
              n'est pas verrouillee (aucun match joue). */}
          {leagueEnabled && isCreator && !league.hasScoredMatch ? (
            <Link
              href={`/leagues/${leagueId}/edit`}
              data-testid="edit-league-cta"
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
            >
              ✏️ {t.leagues.editButton}
            </Link>
          ) : null}
        </div>
        {league.description ? (
          <p className="text-sm text-gray-700 mt-2">{league.description}</p>
        ) : null}
        <p className="text-xs text-gray-500 mt-2 inline-flex flex-wrap items-center gap-1.5">
          <span>
            {t.leagues.creator} :{" "}
            {league.creator.coachName ?? league.creator.email}
          </span>
          {/* L2.D — badge Commissaire associe au createur de la ligue. */}
          <span
            data-testid="league-commissioner-badge"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-nuffle-gold/15 border border-nuffle-gold/40 text-nuffle-bronze"
          >
            👑 {t.leagues.commissionerBadge}
          </span>
          <span>
            {" • "}
            {t.leagues.maxParticipants} : {league.maxParticipants}
            {league.allowedRosters && league.allowedRosters.length > 0
              ? ` • ${t.leagues.allowedRosters} : ${league.allowedRosters.join(", ")}`
              : ""}
          </span>
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          {t.leagues.scoringConfig}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div>
            {t.leagues.scoreWin} : <strong>{league.winPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreDraw} : <strong>{league.drawPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreLoss} : <strong>{league.lossPoints}</strong>{" "}
            {t.leagues.points}
          </div>
          <div>
            {t.leagues.scoreForfeit} :{" "}
            <strong>{league.forfeitPoints}</strong> {t.leagues.points}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            {t.leagues.seasonsSection}
          </h2>
          {leagueEnabled && isCreator ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* Lot A — invitation d'un coach (commissaire), gatee par le
                  flag `league_invitations`. */}
              {invitationsEnabled ? (
                <button
                  type="button"
                  data-testid="open-invite-coach"
                  onClick={() => setInviteOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
                >
                  ✉️ {t.leagues.inviteCoachButton}
                </button>
              ) : null}
              {/* Dev only : ajoute une equipe de test inscrite a la saison
                  selectionnee (la route serveur est 404 hors dev). */}
              {season ? (
                <TestParticipantButton
                  seasonId={season.id}
                  onAdded={() => loadSeason(season.id)}
                />
              ) : null}
              <button
                type="button"
                data-testid="open-new-season-modal"
                onClick={() => setNewSeasonOpen(true)}
                className="px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
              >
                + {t.leagues.newSeasonButton}
              </button>
            </div>
          ) : null}
        </div>
        {leagueEnabled && isCreator && invitationsEnabled ? (
          <SentInvitationsPanel
            leagueId={league.id}
            refreshKey={invitationsRefreshKey}
          />
        ) : null}
        {league.seasons.length === 0 ? (
          <div
            data-testid="league-seasons-empty"
            className="text-sm text-gray-500"
          >
            {t.leagues.seasonsEmpty}
          </div>
        ) : (
          <ul
            data-testid="league-seasons"
            className="flex flex-wrap gap-2"
          >
            {league.seasons.map((s) => {
              const active = s.id === selectedSeasonId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedSeasonId(s.id)}
                    data-testid={`season-tab-${s.id}`}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      active
                        ? "bg-nuffle-gold text-white border-nuffle-gold"
                        : "bg-white text-gray-700 border-gray-300 hover:border-nuffle-gold"
                    }`}
                  >
                    S{s.seasonNumber} — {s.name}
                    <span className="ml-2 text-xs opacity-80">
                      {seasonStatusLabels[s.status] ?? s.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {league.seasons.length > 0 ? (
        <section className="space-y-6">
          {seasonLoading ? (
            <p className="text-sm text-gray-500">
              {t.leagues.seasonLoading}
            </p>
          ) : null}
          {seasonError ? (
            <p className="text-sm text-red-600">
              {t.common.error} : {seasonError}
            </p>
          ) : null}

          {season ? (
            <>
              {leagueEnabled && isCreator ? (
                <SeasonAdminPanel
                  seasonId={season.id}
                  status={season.status}
                  onActionDone={() => {
                    if (selectedSeasonId) {
                      loadSeason(selectedSeasonId);
                    }
                  }}
                />
              ) : null}

              {/* L2.C.2c — lien vers le recap quand la saison est terminee.
                  Le recap reste accessible meme si leagueEnabled est off
                  (l'endpoint awards est public). */}
              {season.status === "completed" ? (
                <Link
                  href={`/leagues/${leagueId}/seasons/${season.id}/recap`}
                  data-testid="season-recap-link"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-200"
                >
                  🏆 Voir le recap de la saison
                </Link>
              ) : null}

              {canJoinSeason ? (
                <div>
                  <button
                    type="button"
                    data-testid="open-join-season"
                    onClick={() => setJoinSeasonOpen(true)}
                    className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-gold/90"
                  >
                    + {t.leagues.joinSeasonButton}
                  </button>
                </div>
              ) : null}

              {/* L2.B.5 — actions reservees au coach inscrit pendant
                  une saison en cours. */}
              {myParticipant ? (
                <div
                  data-testid="my-team-actions"
                  className="flex flex-wrap items-center gap-2"
                >
                  <Link
                    href={`/me/teams/${myParticipant.teamId}/edit`}
                    data-testid="manage-my-team"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
                  >
                    🛠 Gerer mon equipe
                  </Link>
                  {canPlayMecene ? (
                    <MeceneButton
                      seasonId={season.id}
                      participant={myParticipant}
                      onPlayed={() => {
                        if (selectedSeasonId) {
                          loadSeason(selectedSeasonId);
                        }
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.calendarSection}
                </h3>
                <SeasonCalendar
                  rounds={season.rounds}
                  currentUserId={currentUserId}
                  canRecordResult={leagueEnabled && isCreator}
                  onResultRecorded={() => {
                    if (selectedSeasonId) loadSeason(selectedSeasonId);
                  }}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.standingsSection}
                </h3>
                <SeasonStandings rows={standings} showSeasonElo={showSeasonElo} />
              </div>

              {/* L2.C.3 — bracket de playoffs (rendu null si pas
                  encore declenche : playoffSize=0 OU saison reguliere
                  pas terminee). */}
              <PlayoffBracketView seasonId={season.id} />

              <div className="space-y-3">
                <h3 className="text-md font-semibold text-nuffle-anthracite">
                  {t.leagues.participantsSection}
                </h3>
                <SeasonParticipants
                  participants={season.participants}
                  showSeasonElo={showSeasonElo}
                />
              </div>
            </>
          ) : !seasonLoading && !seasonError ? (
            <p className="text-sm text-gray-500">
              {t.leagues.seasonNotSelected}
            </p>
          ) : null}
        </section>
      ) : null}

      {leagueEnabled && isCreator ? (
        <NewSeasonModal
          leagueId={league.id}
          open={newSeasonOpen}
          onClose={() => setNewSeasonOpen(false)}
          onCreated={(seasonId) => {
            setSelectedSeasonId(seasonId);
            // Reload the league so the new season appears in the tabs.
            apiRequest<{ league: LeagueDetail }>(`/leagues/${leagueId}`)
              .then(({ league: data }) => setLeague(data))
              .catch(() => {
                /* tolere : le tab apparaitra au prochain refresh manuel */
              });
          }}
        />
      ) : null}

      {canJoinSeason && season ? (
        <JoinSeasonModal
          open={joinSeasonOpen}
          onClose={() => setJoinSeasonOpen(false)}
          onJoined={() => {
            if (selectedSeasonId) loadSeason(selectedSeasonId);
          }}
          seasonId={season.id}
          ruleset={league.ruleset}
          allowedRosters={league.allowedRosters}
          alreadyRegisteredTeamIds={registeredTeamIds}
        />
      ) : null}

      {leagueEnabled && isCreator && invitationsEnabled ? (
        <InviteCoachModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onInvited={() => setInvitationsRefreshKey((k) => k + 1)}
          leagueId={league.id}
          seasonId={season?.id}
        />
      ) : null}
    </div>
  );
}
