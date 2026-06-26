"use client";
import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { CommissionerTeamEditor } from "./CommissionerTeamEditor";
import type { LeagueParticipantDetail } from "./types";

interface SeasonParticipantsProps {
  participants: LeagueParticipantDetail[];
  /** Affiche l'indicateur ELO. Masque par defaut (ELO neutralise en ligue). */
  showSeasonElo?: boolean;
  /** FR2 — nom de poule par id, pour afficher l'affectation de chaque équipe. */
  poolNamesById?: Record<string, string>;
  /** FR12 — leagueId si l'utilisateur est commissaire (active l'édition). */
  commissionerLeagueId?: string;
  /** Rappelé après une édition commissaire. */
  onChanged?: () => void;
}

export function SeasonParticipants({
  participants,
  showSeasonElo = false,
  poolNamesById = {},
  commissionerLeagueId,
  onChanged,
}: SeasonParticipantsProps) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState<{ teamId: string; name: string } | null>(
    null,
  );

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
              <div className="text-xs text-gray-600 mt-0.5">
                {p.team.roster}
                {p.team.owner.coachName
                  ? ` • ${p.team.owner.coachName}`
                  : ""}
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
              {/* FR12 — édition de l'équipe par le commissaire. */}
              {commissionerLeagueId ? (
                <button
                  type="button"
                  data-testid={`edit-team-${p.teamId}`}
                  onClick={() =>
                    setEditing({ teamId: p.teamId, name: p.team.name })
                  }
                  className="mt-2 text-xs px-2 py-1 rounded border border-nuffle-gold text-nuffle-bronze hover:bg-nuffle-gold/10"
                >
                  🛠 Éditer l'équipe
                </button>
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
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}
