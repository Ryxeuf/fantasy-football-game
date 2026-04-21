"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import type { LeagueParticipantDetail } from "./types";

interface SeasonParticipantsProps {
  participants: LeagueParticipantDetail[];
}

export function SeasonParticipants({ participants }: SeasonParticipantsProps) {
  const { t } = useLanguage();

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
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-gray-500">ELO {p.seasonElo}</span>
              {isWithdrawn ? (
                <span className="uppercase tracking-wide bg-red-100 text-red-700 px-2 py-0.5 rounded">
                  {t.leagues.participantStatusWithdrawn}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
