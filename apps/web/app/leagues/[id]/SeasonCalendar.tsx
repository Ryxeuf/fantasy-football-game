"use client";
import { useLanguage } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

interface SeasonCalendarProps {
  rounds: LeagueRoundDetail[];
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function SeasonCalendar({ rounds }: SeasonCalendarProps) {
  const { t, language } = useLanguage();

  const statusLabels: Record<string, string> = {
    pending: t.leagues.roundStatusPending,
    in_progress: t.leagues.roundStatusInProgress,
    completed: t.leagues.roundStatusCompleted,
  };

  if (rounds.length === 0) {
    return (
      <div
        data-testid="league-rounds-empty"
        className="text-sm text-gray-500 py-4"
      >
        {t.leagues.calendarEmpty}
      </div>
    );
  }

  return (
    <ul
      data-testid="league-rounds"
      className="grid grid-cols-1 md:grid-cols-2 gap-2"
    >
      {rounds.map((round) => {
        const start = formatDate(round.startDate, language);
        const end = formatDate(round.endDate, language);
        const label =
          round.name ??
          `${t.leagues.roundLabel} ${round.roundNumber}`;
        const statusLabel = statusLabels[round.status] ?? round.status;
        return (
          <li
            key={round.id}
            data-testid={`league-round-${round.id}`}
            className="flex items-center justify-between border border-gray-200 rounded-md bg-white px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium text-nuffle-anthracite">
                J{round.roundNumber} — {label}
              </div>
              {start || end ? (
                <div className="text-xs text-gray-500">
                  {start ?? "?"}
                  {end ? ` → ${end}` : ""}
                </div>
              ) : null}
            </div>
            <span className="text-xs uppercase tracking-wide bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
              {statusLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
