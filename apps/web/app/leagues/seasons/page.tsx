"use client";
/**
 * S26.6c — Calendrier des thèmes saisonniers `/leagues/seasons`.
 *
 * Page publique : chaque thème (Skaven Cup, Nordic Challenge, Underworld
 * Open) est présenté avec sa couleur, sa description, son mois canonique
 * et la liste des éditions existantes. Données alimentées par les
 * endpoints publics ajoutés en S26.6b :
 *  - GET /league/themes
 *  - GET /league/seasons/themed?theme=...
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

interface LeagueTheme {
  slug: string;
  title: string;
  month: number;
  badgeColor: string;
  description: string;
}

interface ThemedSeason {
  id: string;
  leagueId: string;
  name: string;
  seasonNumber: number;
  status: string;
  theme: string;
  themeYear: number;
  league?: { id: string; name: string };
}

const MONTH_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function monthLabel(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) return String(month);
  return MONTH_LABELS_FR[month - 1];
}

export default function LeagueSeasonsPage() {
  const { t } = useLanguage();
  const [themes, setThemes] = useState<LeagueTheme[]>([]);
  const [seasonsByTheme, setSeasonsByTheme] = useState<
    Record<string, ThemedSeason[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const cat = await apiRequest<{ themes: LeagueTheme[] }>(
          "/league/themes",
        );
        const list = (cat.themes ?? [])
          .slice()
          .sort((a, b) => a.month - b.month);
        if (cancelled) return;
        setThemes(list);

        // Charge les editions de chaque theme en parallele. Echec partiel =
        // on garde une liste vide pour le theme concerne plutot que de
        // bloquer le calendrier entier.
        const entries = await Promise.all(
          list.map(async (th) => {
            try {
              const r = await apiRequest<{ seasons: ThemedSeason[] }>(
                `/league/seasons/themed?theme=${encodeURIComponent(th.slug)}`,
              );
              return [th.slug, r.seasons ?? []] as const;
            } catch {
              return [th.slug, [] as ThemedSeason[]] as const;
            }
          }),
        );
        if (cancelled) return;
        setSeasonsByTheme(Object.fromEntries(entries));
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : t.leagues.themesCalendarError,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t.leagues.themesCalendarError]);

  if (loading) {
    return (
      <div
        data-testid="themes-calendar-loading"
        className="w-full p-6"
      >
        <p>{t.leagues.themesCalendarLoading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="themes-calendar-error"
        className="w-full p-6"
      >
        <p className="text-red-600">
          {t.common.error} : {error}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="themes-calendar"
      className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6"
    >
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">
          {t.leagues.themesCalendarTitle}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          {t.leagues.themesCalendarDescription}
        </p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {themes.map((th) => {
          const seasons = seasonsByTheme[th.slug] ?? [];
          return (
            <li
              key={th.slug}
              data-testid={`theme-card-${th.slug}`}
              className="border border-gray-200 rounded-lg bg-white p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <span
                  data-testid={`theme-badge-${th.slug}`}
                  data-color={th.badgeColor}
                  aria-hidden="true"
                  className="inline-block w-4 h-4 rounded-sm mt-1 flex-shrink-0"
                  style={{ backgroundColor: th.badgeColor }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-nuffle-anthracite">
                    {th.title}
                  </h2>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    {t.leagues.themeMonthLabel} : {monthLabel(th.month)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">{th.description}</p>

              <section className="pt-2 border-t border-gray-100">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {t.leagues.themeSeasonsTitle}
                </h3>
                {seasons.length === 0 ? (
                  <p
                    data-testid={`theme-seasons-empty-${th.slug}`}
                    className="text-sm text-gray-500 italic"
                  >
                    {t.leagues.themeNoSeasonsYet}
                  </p>
                ) : (
                  <ul
                    data-testid={`theme-seasons-${th.slug}`}
                    className="space-y-1"
                  >
                    {seasons.map((s) => (
                      <li key={s.id} className="text-sm">
                        <Link
                          href={`/leagues/${s.leagueId}`}
                          className="text-nuffle-bronze hover:underline"
                        >
                          {s.name}
                        </Link>{" "}
                        <span className="text-xs text-gray-500">
                          ({s.themeYear})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
