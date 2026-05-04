"use client";
/**
 * S27.1h — Banniere "Match du moment" sur `/cups/monthly`.
 *
 * Consomme `GET /cup/match-of-the-week` (S27.1f) et affiche le match
 * pick par un admin (`POST /cup/match-of-the-week/:matchId`, S27.1g).
 *
 * Degradation gracieuse : rend null en silence si :
 *  - le fetch n'a pas resolu (no flash apparent),
 *  - aucun match n'est featured,
 *  - l'API echoue (sans afficher d'erreur a l'utilisateur).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";

interface FeaturedMatch {
  id: string;
  name: string | null;
  featuredAt: string;
  featuredNote: string | null;
  cupId: string | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
}

export default function MatchOfTheWeekBanner(): JSX.Element | null {
  const { t } = useLanguage();
  const [match, setMatch] = useState<FeaturedMatch | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const body = await apiRequest<{ match: FeaturedMatch | null }>(
          "/cup/match-of-the-week",
        );
        if (!cancelled) setMatch(body.match ?? null);
      } catch {
        // Degradation gracieuse : pas de banner = pas d'erreur visible.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !match) return null;

  const scoreText =
    match.scoreTeamA !== null && match.scoreTeamB !== null
      ? `${match.scoreTeamA} – ${match.scoreTeamB}`
      : null;

  return (
    <section
      data-testid="match-of-the-week-banner"
      className="bg-nuffle-gold/5 border border-nuffle-gold/40 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden className="text-2xl leading-none">
          ⭐
        </span>
        <h2 className="text-lg font-bold text-nuffle-anthracite">
          {t.cups.matchOfTheWeekTitle}
        </h2>
      </div>
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-4">
        <p className="text-base font-semibold text-nuffle-anthracite">
          <span data-testid="match-of-the-week-team-a">
            {match.teamA?.name ?? "—"}
          </span>{" "}
          <span className="text-gray-400 text-sm">vs</span>{" "}
          <span data-testid="match-of-the-week-team-b">
            {match.teamB?.name ?? "—"}
          </span>
        </p>
        {scoreText !== null ? (
          <p
            data-testid="match-of-the-week-score"
            className="text-sm text-gray-600"
          >
            {t.cups.matchOfTheWeekScore} : {scoreText}
          </p>
        ) : null}
      </div>
      {match.featuredNote ? (
        <p className="text-sm text-gray-600 italic mt-2">
          {match.featuredNote}
        </p>
      ) : null}
      {match.cupId ? (
        <Link
          href={`/cups/${match.cupId}`}
          className="inline-block text-sm font-medium text-nuffle-bronze hover:underline mt-2"
        >
          {t.cups.matchOfTheWeekViewMatch} →
        </Link>
      ) : null}
    </section>
  );
}
