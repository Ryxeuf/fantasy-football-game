import type { Metadata } from "next";
import { getRegionalLeaguesWithRosters } from "@bb/game-engine";
import StructuredData from "../components/StructuredData";
import { buildLeaguesListSchema } from "./ligues-structured-data";
import { fetchRosterMap, resolveRosters } from "./data";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

// ISR — données de référence (Ligues + mapping rosters), changent rarement.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ligues régionales Blood Bowl — équipes éligibles | Nuffle Arena",
  description:
    "Les Ligues régionales de Blood Bowl (Saison 3) : Bagarre des Terres Arides, Clash du Chaos, Ligue des Royaumes Elfiques, Coupe Dé à Coudre Halfling… Chaque Ligue décrite avec la liste des équipes qui peuvent y participer.",
  keywords: [
    "Ligues régionales Blood Bowl",
    "Badlands Brawl",
    "Elven Kingdoms League",
    "équipes Blood Bowl par ligue",
    "Nuffle Arena",
  ],
  alternates: { canonical: `${BASE_URL}/ligues` },
  openGraph: {
    title: "Ligues régionales Blood Bowl — Nuffle Arena",
    description:
      "Toutes les Ligues régionales de Blood Bowl et les équipes qui peuvent y participer.",
    type: "website",
    url: `${BASE_URL}/ligues`,
    siteName: "Nuffle Arena",
  },
};

export default async function LiguesIndexPage() {
  const leagues = getRegionalLeaguesWithRosters();
  const rosterMap = await fetchRosterMap("season_3");

  return (
    <>
      <StructuredData
        data={buildLeaguesListSchema({
          items: leagues.map((l) => ({ slug: l.slug, name: l.nameFr })),
          baseUrl: BASE_URL,
        })}
      />

      <div className="max-w-5xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <nav
          aria-label="Fil d'Ariane"
          className="text-sm font-subtitle text-nuffle-bronze/80 mb-6"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <a href="/" className="hover:text-nuffle-gold transition-colors">
                Accueil
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li
              className="text-nuffle-anthracite font-semibold"
              aria-current="page"
            >
              Ligues
            </li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="rounded-2xl bg-[#1B1610] ring-1 ring-nuffle-gold/30 p-6 sm:p-10 text-center shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <p className="font-subtitle text-xs font-semibold uppercase tracking-[0.2em] text-nuffle-gold/80">
            Blood Bowl — Saison 3
          </p>
          <h1 className="mt-3 font-heading font-bold text-3xl sm:text-5xl text-[#FBF7EC] leading-tight">
            Ligues régionales
          </h1>
          <p className="mt-4 max-w-2xl mx-auto font-body text-[#FBF7EC]/75 leading-relaxed">
            Chaque équipe du monde connu se rattache à une ou plusieurs Ligues
            régionales. Elles déterminent les Star Players recrutables et les
            Coups de Pouce accessibles. Découvre chaque Ligue et les équipes qui
            peuvent y disputer le jeu divin de Nuffle.
          </p>
        </header>

        {/* Grille de Ligues */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {leagues.map((league) => {
            const rosters = resolveRosters(league.rosterSlugs, rosterMap);
            return (
              <a
                key={league.slug}
                href={`/ligues/${league.slug}`}
                data-testid={`league-card-${league.slug}`}
                className="group flex flex-col rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 hover:border-nuffle-gold/60 hover:-translate-y-0.5 transition-all shadow-[0_2px_10px_rgba(107,78,46,0.06)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-heading font-bold text-xl text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                    {league.nameFr}
                  </h2>
                  <span className="flex-shrink-0 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze/70">
                    {rosters.length} équipe{rosters.length > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-1 font-subtitle text-sm text-nuffle-bronze/70">
                  {league.nameEn}
                </p>
                <p className="mt-3 font-body text-sm text-nuffle-anthracite/75 leading-relaxed line-clamp-3">
                  {league.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {rosters.slice(0, 5).map((roster) => (
                    <span
                      key={roster.slug}
                      className="inline-flex items-center rounded-full bg-white/60 border border-nuffle-bronze/15 px-2.5 py-0.5 text-xs font-subtitle text-nuffle-bronze"
                    >
                      {roster.name}
                    </span>
                  ))}
                  {rosters.length > 5 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-subtitle text-nuffle-bronze/60">
                      +{rosters.length - 5}
                    </span>
                  )}
                </div>
                <span className="mt-4 inline-flex items-center gap-1.5 font-subtitle font-bold uppercase tracking-wide text-xs text-nuffle-bronze group-hover:text-nuffle-gold transition-colors">
                  Voir la Ligue
                  <span
                    aria-hidden="true"
                    className="group-hover:translate-x-1 transition-transform"
                  >
                    →
                  </span>
                </span>
              </a>
            );
          })}
        </section>
      </div>
    </>
  );
}
