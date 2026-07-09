"use client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../contexts/LanguageContext";
import { apiRequest } from "../../lib/api-client";
import { CommissionerTeamEditor } from "./CommissionerTeamEditor";
import type { LeagueParticipantDetail } from "./types";
import RosterBadge from "../../components/RosterBadge";

interface SeasonParticipantsProps {
  participants: LeagueParticipantDetail[];
  /** Affiche l'indicateur ELO. Masque par defaut (ELO neutralise en ligue). */
  showSeasonElo?: boolean;
  /** FR2 — nom de poule par id, pour afficher l'affectation de chaque équipe. */
  poolNamesById?: Record<string, string>;
  /** id de la ligue — requis pour consulter les rosters des participants. */
  leagueId?: string;
  /** Vrai si le coach courant est inscrit (ou commissaire) : il peut voir
   * les rosters de tous les participants de la ligue. */
  canViewRosters?: boolean;
  /** FR12 — leagueId si l'utilisateur est commissaire (active l'édition). */
  commissionerLeagueId?: string;
  /** Saison courante — requis pour la suppression d'équipe par le commissaire. */
  seasonId?: string;
  /** Statut de la saison — la suppression n'est offerte qu'avant le démarrage. */
  seasonStatus?: string;
  /** Rappelé après une édition / suppression commissaire. */
  onChanged?: () => void;
}

export function SeasonParticipants({
  participants,
  showSeasonElo = false,
  poolNamesById = {},
  leagueId,
  canViewRosters = false,
  commissionerLeagueId,
  seasonId,
  seasonStatus,
  onChanged,
}: SeasonParticipantsProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<{
    teamId: string;
    name: string;
  } | null>(null);
  // Un coach inscrit peut voir les rosters dès qu'on connaît la ligue.
  const showRosterButton = canViewRosters && !!leagueId;
  // Suppression d'équipe : id en attente de confirmation + erreur éventuelle.
  const [confirmingTeamId, setConfirmingTeamId] = useState<string | null>(null);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);
  // Retrait de coach : id du coach en attente de confirmation / en cours.
  const [confirmingCoachId, setConfirmingCoachId] = useState<string | null>(
    null,
  );
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // La suppression d'équipe / le retrait de coach ne sont proposés qu'avant le
  // démarrage de la saison (draft / scheduled). Une fois la saison lancée, on
  // passe par le forfait.
  const canRemoveTeams =
    !!commissionerLeagueId &&
    !!seasonId &&
    (seasonStatus === "draft" || seasonStatus === "scheduled");

  async function handleRemoveTeam(teamId: string) {
    if (!commissionerLeagueId || !seasonId) return;
    setRemovingTeamId(teamId);
    setRemoveError(null);
    try {
      await apiRequest(
        `/leagues/${commissionerLeagueId}/seasons/${seasonId}/teams/${teamId}`,
        { method: "DELETE" },
      );
      setConfirmingTeamId(null);
      onChanged?.();
    } catch (e: unknown) {
      setRemoveError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRemovingTeamId(null);
    }
  }

  // Retire un coach de la saison : supprime son/ses équipe(s) inscrites et
  // annule ses invitations en attente (côté serveur).
  async function handleRemoveCoach(coachUserId: string) {
    if (!commissionerLeagueId || !seasonId) return;
    setRemovingCoachId(coachUserId);
    setRemoveError(null);
    try {
      await apiRequest(
        `/leagues/${commissionerLeagueId}/seasons/${seasonId}/coaches/${coachUserId}`,
        { method: "DELETE" },
      );
      setConfirmingCoachId(null);
      onChanged?.();
    } catch (e: unknown) {
      setRemoveError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRemovingCoachId(null);
    }
  }

  if (participants.length === 0) {
    return (
      <div
        data-testid="league-participants-empty"
        className="text-sm text-gray-500 py-4"
      >
        {t.leagues.participantsEmpty}
      </div>
    );
  }

  return (
    <>
      {removeError ? (
        <p
          data-testid="participant-remove-error"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2"
        >
          {removeError}
        </p>
      ) : null}
      <ul
        data-testid="league-participants"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
      >
        {participants.map((p) => {
          const isWithdrawn = p.status === "withdrawn";
          return (
            <li
              key={p.id}
              data-testid={`participant-${p.id}`}
              className={`border border-gray-200 rounded-md px-3 py-2 text-sm ${
                isWithdrawn ? "bg-gray-50 text-gray-500" : "bg-white"
              }`}
            >
              <div className="font-medium text-nuffle-anthracite">
                {p.team.name}
              </div>
              <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                <RosterBadge slug={p.team.roster} />
                {p.team.owner.coachName ? <span>{p.team.owner.coachName}</span> : null}
              </div>
              {p.poolId && poolNamesById[p.poolId] ? (
                <span className="inline-block mt-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  {poolNamesById[p.poolId]}
                </span>
              ) : null}
              {(showSeasonElo || isWithdrawn) && (
                <div className="flex items-center justify-between mt-1 text-xs">
                  {showSeasonElo ? (
                    <span className="text-gray-500">ELO {p.seasonElo}</span>
                  ) : (
                    <span />
                  )}
                  {isWithdrawn ? (
                    <span className="uppercase tracking-wide bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      {t.leagues.participantStatusWithdrawn}
                    </span>
                  ) : null}
                </div>
              )}
              {/* Consultation du roster — ouverte à tout coach inscrit. */}
              {showRosterButton ? (
                <div className="mt-2">
                  <Link
                    href={`/leagues/${leagueId}/teams/${p.teamId}`}
                    data-testid={`view-roster-${p.teamId}`}
                    className="inline-block text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    👥 Voir le roster
                  </Link>
                </div>
              ) : null}
              {/* FR12 — édition de l'équipe par le commissaire. */}
              {commissionerLeagueId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid={`edit-team-${p.teamId}`}
                    onClick={() =>
                      setEditing({ teamId: p.teamId, name: p.team.name })
                    }
                    className="text-xs px-2 py-1 rounded border border-nuffle-gold text-nuffle-bronze hover:bg-nuffle-gold/10"
                  >
                    🛠 Éditer l'équipe
                  </button>
                  {/* Suppression d'équipe (pré-saison, aucun match joué). */}
                  {canRemoveTeams && !isWithdrawn ? (
                    confirmingTeamId === p.teamId ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`confirm-remove-team-${p.teamId}`}
                          disabled={removingTeamId === p.teamId}
                          onClick={() => handleRemoveTeam(p.teamId)}
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {removingTeamId === p.teamId
                            ? "Suppression…"
                            : "Confirmer la suppression"}
                        </button>
                        <button
                          type="button"
                          disabled={removingTeamId === p.teamId}
                          onClick={() => setConfirmingTeamId(null)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`remove-team-${p.teamId}`}
                        onClick={() => {
                          setRemoveError(null);
                          setConfirmingTeamId(p.teamId);
                        }}
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        🗑 Supprimer
                      </button>
                    )
                  ) : null}
                  {/* Retrait du coach (son équipe + ses invitations en attente). */}
                  {canRemoveTeams && !isWithdrawn ? (
                    confirmingCoachId === p.team.owner.id ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`confirm-remove-coach-${p.team.owner.id}`}
                          disabled={removingCoachId === p.team.owner.id}
                          onClick={() => handleRemoveCoach(p.team.owner.id)}
                          className="text-xs px-2 py-1 rounded bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                        >
                          {removingCoachId === p.team.owner.id
                            ? "Retrait…"
                            : "Confirmer le retrait du coach"}
                        </button>
                        <button
                          type="button"
                          disabled={removingCoachId === p.team.owner.id}
                          onClick={() => setConfirmingCoachId(null)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`remove-coach-${p.team.owner.id}`}
                        onClick={() => {
                          setRemoveError(null);
                          setConfirmingCoachId(p.team.owner.id);
                        }}
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        🚫 Retirer le coach
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {commissionerLeagueId && editing ? (
        <CommissionerTeamEditor
          leagueId={commissionerLeagueId}
          teamId={editing.teamId}
          teamName={editing.name}
          open={true}
          canRemovePlayers={canRemoveTeams}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
