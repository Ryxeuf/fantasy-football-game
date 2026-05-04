/**
 * L2.C.2 — Sprint Ligues v2 PR7 : banniere des saisons de ligue
 * remportees sur `/coach/[slug]`.
 *
 * Affiche un badge par titre de saison de ligue. Source : champ
 * `leagueChampionships` du DTO `/coach/:slug` livre en L2.C.2a.
 *
 * Pattern aligne sur `CoachCupChampionshipsBanner` (S27.1e). La
 * couleur du badge est emerald pour distinguer les saisons de ligue
 * des cups esport (gold/bronze) et des saisons thematiques.
 */
import Link from "next/link";
import type { CoachLeagueChampionship } from "./types";

interface CoachLeagueChampionshipsBannerProps {
  leagueChampionships?: CoachLeagueChampionship[];
}

export default function CoachLeagueChampionshipsBanner({
  leagueChampionships,
}: CoachLeagueChampionshipsBannerProps): JSX.Element | null {
  if (!leagueChampionships || leagueChampionships.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="coach-league-championships-banner"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Saisons de ligue remportees
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Saisons de ligue terminees premier au classement.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {leagueChampionships.map((c) => (
          <li
            key={c.seasonId}
            data-testid={`league-championship-badge-${c.seasonId}`}
            className="border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              🥇
            </span>
            <div className="min-w-0">
              <Link
                href={`/leagues/${c.leagueId}/seasons/${c.seasonId}/recap`}
                className="text-sm font-semibold text-nuffle-anthracite hover:underline block"
              >
                {c.label}
              </Link>
              <p className="text-xs text-gray-500">
                S{c.seasonNumber} — {c.leagueName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
