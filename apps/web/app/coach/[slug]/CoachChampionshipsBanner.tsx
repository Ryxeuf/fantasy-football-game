/**
 * S26.6e — Banniere des titres saisonniers thematiques sur `/coach/[slug]`.
 *
 * Affiche un badge par titre remporte (1er d'une saison thematique
 * completee). Source : champ `championships` du DTO `/coach/:slug`
 * livre en S26.6d (les couleurs viennent du serveur via le catalogue
 * canonique pour eviter de dupliquer les hex cote front).
 */
import Link from "next/link";
import type { CoachThemedChampionship } from "./types";

interface CoachChampionshipsBannerProps {
  championships?: CoachThemedChampionship[];
}

export default function CoachChampionshipsBanner({
  championships,
}: CoachChampionshipsBannerProps): JSX.Element | null {
  if (!championships || championships.length === 0) {
    return null;
  }

  return (
    <section
      data-testid="coach-championships-banner"
      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-nuffle-anthracite">
        Titres saisonniers
      </h2>
      <p className="text-sm text-gray-500 mt-1">
        Saisons thematiques remportees par ce coach.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {championships.map((c) => {
          const id = `${c.theme}-${c.themeYear}`;
          return (
            <li
              key={id}
              data-testid={`championship-badge-${id}`}
              className="border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <span
                data-testid={`championship-color-${id}`}
                data-color={c.badgeColor}
                aria-hidden="true"
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: c.badgeColor }}
              />
              <Link
                href={`/leagues/${c.leagueId}`}
                className="text-sm font-semibold text-nuffle-anthracite hover:underline"
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
