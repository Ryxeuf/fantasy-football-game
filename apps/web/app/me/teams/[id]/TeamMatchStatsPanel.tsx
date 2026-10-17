"use client";

/**
 * Bloc « Statistiques de l'équipe » de la fiche : matchs joués (ligue,
 * coupe et amicaux confondus), bilan et touchdowns. La vue est résolue par
 * `resolveTeamMatchStats` ; ce composant ne fait que l'afficher.
 */

import { useLanguage } from "../../../contexts/LanguageContext";
import {
  formatTouchdownDiff,
  type TeamMatchStatsView,
} from "./team-match-stats";

interface TeamMatchStatsPanelProps {
  readonly stats: TeamMatchStatsView;
}

export default function TeamMatchStatsPanel({ stats }: TeamMatchStatsPanelProps) {
  const { t } = useLanguage();
  const breakdown = stats.breakdown
    ? [
        { key: "league", label: t.teams.teamStatsLeague, count: stats.breakdown.league },
        { key: "cup", label: t.teams.teamStatsCup, count: stats.breakdown.cup },
        { key: "friendly", label: t.teams.teamStatsFriendly, count: stats.breakdown.friendly },
      ].filter((entry) => entry.count > 0)
    : [];

  return (
    <div className="bg-white rounded-lg border overflow-hidden" data-testid="team-stats">
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b">
        <h2 className="text-base sm:text-lg font-semibold">
          {t.teams.teamStatsTitle}
        </h2>
        <p className="text-xs text-gray-500 mt-1">{t.teams.teamStatsScope}</p>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs sm:text-sm text-blue-600 font-medium">
              {t.teams.teamStatsPlayed}
            </div>
            <div
              className="text-xl sm:text-2xl font-bold text-blue-900"
              data-testid="team-stats-played"
            >
              {stats.played}
            </div>
            {breakdown.length > 0 && (
              <div
                className="text-[11px] text-blue-700 mt-1"
                data-testid="team-stats-breakdown"
              >
                {breakdown
                  .map((entry) => `${entry.label} ${entry.count}`)
                  .join(" · ")}
              </div>
            )}
          </div>
          <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs sm:text-sm text-purple-600 font-medium">
              {t.teams.teamStatsRecord}
            </div>
            <div
              className="text-xl sm:text-2xl font-bold text-purple-900 font-mono"
              data-testid="team-stats-record"
            >
              {stats.wins} / {stats.draws} / {stats.losses}
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-xs sm:text-sm text-orange-600 font-medium">
              {t.teams.teamStatsTouchdowns}
            </div>
            <div
              className="text-xl sm:text-2xl font-bold text-orange-900 font-mono"
              data-testid="team-stats-touchdowns"
            >
              {stats.touchdownsFor} / {stats.touchdownsAgainst}{" "}
              <span className="text-sm">
                ({formatTouchdownDiff(stats.touchdownDiff)})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
