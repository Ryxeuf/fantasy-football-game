/**
 * S27.1e — Banniere des Nuffle Cup mensuelles remportees sur
 * `/coach/[slug]`.
 *
 * Affiche un badge par titre Nuffle Cup remporte. Source : champ
 * `cupChampionships` du DTO `/coach/:slug` livre en S27.1d.
 *
 * Pattern aligne sur `CoachChampionshipsBanner` (S26.6e) pour les
 * ligues thematiques. La couleur du badge est gold/bronze pour bien
 * distinguer les titres esport des titres de saison thematique.
 */
import Link from "next/link";
import type { CoachCupChampionship } from "./types";

interface CoachCupChampionshipsBannerProps {
  cupChampionships?: CoachCupChampionship[];
}

export default function CoachCupChampionshipsBanner({
  cupChampionships,
}: CoachCupChampionshipsBannerProps): JSX.Element | null {
  if (!cupChampionships || cupChampionships.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="coach-cup-championships-banner"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Nuffle Cups remportees
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Cups mensuelles remportees par ce coach.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {cupChampionships.map((c) => (
          <li
            key={c.cupId}
            data-testid={`cup-championship-badge-${c.cupId}`}
            className="border border-nuffle-gold/40 bg-nuffle-gold/5 rounded-lg px-3 py-2 flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="text-xl leading-none"
            >
              🏆
            </span>
            <div className="min-w-0">
              <Link
                href={`/cups/${c.cupId}`}
                className="text-sm font-semibold text-nuffle-anthracite hover:underline block"
              >
                {c.label}
              </Link>
              <p className="text-xs text-gray-500">
                {String(c.monthlyMonth).padStart(2, "0")}/{c.monthlyYear}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
