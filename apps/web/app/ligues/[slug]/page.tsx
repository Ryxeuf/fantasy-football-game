import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getRegionalLeagueBySlug,
  getRostersForRegionalLeague,
} from "@bb/game-engine";
import StructuredData from "../../components/StructuredData";
import { buildLeagueDetailSchema } from "../ligues-structured-data";
import { fetchRosterMap, resolveRosters } from "../data";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

// ISR — référence (Ligues + rosters). Pas de generateStaticParams : rendu à
// la demande puis caché, comme /skills et /teams.
export const revalidate = 3600;

interface LeaguePageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: LeaguePageProps): Promise<Metadata> {
  const league = getRegionalLeagueBySlug(params.slug);
  const url = `${BASE_URL}/ligues/${params.slug}`;
  if (!league) {
    return { title: "Ligue introuvable", robots: { index: false, follow: true } };
  }
  const title = `${league.nameFr} (${league.nameEn}) — Ligue régionale Blood Bowl`;
  const description = league.description.slice(0, 300);
  return {
    title,
    description,
    keywords: [
      `${league.nameFr} Blood Bowl`,
      `${league.nameEn} Blood Bowl`,
      "Ligue régionale Blood Bowl",
      "équipes éligibles",
      "Nuffle Arena",
    ],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: "Nuffle Arena",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LeagueDetailPage({ params }: LeaguePageProps) {
  const league = getRegionalLeagueBySlug(params.slug);
  if (!league) {
    notFound();
  }

  const rosterSlugs = getRostersForRegionalLeague(league.slug, "season_3");
  const rosterMap = await fetchRosterMap("season_3");
  const rosters = resolveRosters(rosterSlugs, rosterMap).sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  return (
    <>
      <StructuredData
        data={buildLeagueDetailSchema({
          league: {
            slug: league.slug,
            name: league.nameFr,
            description: league.description,
          },
          rosters: rosters.map((r) => ({ slug: r.slug, name: r.name })),
          baseUrl: BASE_URL,
        })}
      />

      <div className="max-w-3xl mx-auto w-full">
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
            <li>
              <a
                href="/ligues"
                className="hover:text-nuffle-gold transition-colors"
              >
                Ligues
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li
              className="text-nuffle-anthracite font-semibold"
              aria-current="page"
            >
              {league.nameFr}
            </li>
          </ol>
        </nav>

        {/* En-tête */}
        <header className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
          <span className="inline-flex items-center rounded-full border border-nuffle-gold/40 bg-nuffle-gold/10 px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze">
            Ligue régionale
          </span>
          <h1 className="mt-3 font-heading font-bold text-3xl sm:text-4xl text-nuffle-anthracite leading-tight">
            {league.nameFr}
          </h1>
          <p className="mt-1 font-subtitle text-nuffle-bronze/80">
            {league.nameEn}
          </p>
          <span
            className="mt-6 block h-px w-full bg-nuffle-bronze/15"
            aria-hidden="true"
          />
          <p className="mt-6 font-body text-nuffle-anthracite/80 leading-relaxed">
            {league.description}
          </p>
        </header>

        {/* Équipes éligibles */}
        <section className="mt-8" data-testid="league-rosters">
          <h2 className="font-heading font-bold text-xl text-nuffle-anthracite">
            Équipes pouvant participer
          </h2>
          <p className="mt-1 text-sm font-body text-nuffle-bronze/80">
            {rosters.length} équipe{rosters.length > 1 ? "s" : ""} se
            rattache{rosters.length > 1 ? "nt" : ""} à la {league.nameFr}.
          </p>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rosters.map((roster) => (
              <li key={roster.slug}>
                <a
                  href={`/teams/${roster.slug}`}
                  data-testid={`league-roster-${roster.slug}`}
                  className="group flex items-center gap-3 rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 px-4 py-3 hover:border-nuffle-gold/60 hover:-translate-y-0.5 transition-all"
                >
                  <span className="font-subtitle font-semibold text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                    {roster.name}
                  </span>
                  {roster.tier && (
                    <span className="text-xs font-subtitle text-nuffle-bronze/60">
                      Tier {roster.tier}
                    </span>
                  )}
                  <span
                    className="ml-auto text-nuffle-bronze/60 group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Retour */}
        <div className="mt-8">
          <a
            href="/ligues"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-nuffle-bronze/40 text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 font-subtitle font-bold uppercase tracking-wide text-sm transition-all"
          >
            <span aria-hidden="true">←</span> Toutes les Ligues
          </a>
        </div>
      </div>
    </>
  );
}
