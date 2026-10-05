"use client";
/**
 * Fiche admin d'une équipe — compétitions auxquelles elle est inscrite
 * (`competitions` de `GET /admin/teams/:id`), chacune liée à sa fiche admin.
 * Une entrée par saison de ligue : une équipe peut en enchaîner plusieurs.
 */

import Link from "next/link";
import {
  CUP_STATUS_META,
  LEAGUE_STATUS_META,
  StatusBadge,
} from "../../_components/competition-admin";

export interface AdminTeamCompetitions {
  leagues: Array<{
    leagueId: string;
    leagueName: string;
    leagueStatus: string;
    isPublic: boolean;
    seasonId: string;
    seasonName: string;
    seasonNumber: number;
    seasonStatus: string;
    participantStatus: string;
  }>;
  cups: Array<{
    cupId: string;
    cupName: string;
    cupStatus: string;
    isPublic: boolean;
  }>;
}

const ROW =
  "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 py-2.5";

export default function TeamCompetitionsPanel({
  competitions,
}: {
  competitions: AdminTeamCompetitions;
}) {
  const { leagues, cups } = competitions;
  const empty = leagues.length === 0 && cups.length === 0;
  return (
    <div
      data-testid="admin-team-competitions"
      className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
    >
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
        <h2 className="text-base sm:text-lg font-semibold">
          Compétitions{" "}
          <span className="text-sm font-normal text-gray-500">
            ({leagues.length + cups.length})
          </span>
        </h2>
      </div>
      <div className="px-4 sm:px-6 py-2">
        {empty ? (
          <p
            data-testid="admin-team-competitions-empty"
            className="py-2 text-sm text-gray-500"
          >
            Cette équipe ne participe à aucune ligue ni coupe.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {leagues.map((l) => (
              <li
                key={l.seasonId}
                data-testid={`admin-team-league-${l.seasonId}`}
                className={ROW}
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/leagues/${l.leagueId}`}
                    data-testid={`admin-team-league-link-${l.leagueId}`}
                    className="font-medium text-blue-700 hover:underline break-words"
                  >
                    🏅 {l.leagueName}
                  </Link>
                  <div className="text-xs text-gray-500">
                    Saison {l.seasonNumber} · {l.seasonName}
                    {l.participantStatus !== "active"
                      ? ` · inscription ${l.participantStatus}`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <StatusBadge status={l.leagueStatus} meta={LEAGUE_STATUS_META} />
                  {l.isPublic ? null : (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      🔒 Privée
                    </span>
                  )}
                </div>
              </li>
            ))}
            {cups.map((c) => (
              <li
                key={c.cupId}
                data-testid={`admin-team-cup-${c.cupId}`}
                className={ROW}
              >
                <Link
                  href={`/admin/cups/${c.cupId}`}
                  data-testid={`admin-team-cup-link-${c.cupId}`}
                  className="min-w-0 font-medium text-blue-700 hover:underline break-words"
                >
                  🏆 {c.cupName}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <StatusBadge status={c.cupStatus} meta={CUP_STATUS_META} />
                  {c.isPublic ? null : (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      🔒 Privée
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
