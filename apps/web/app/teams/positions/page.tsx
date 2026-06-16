import type { Metadata } from "next";
import Link from "next/link";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import StructuredData from "../../components/StructuredData";
import {
  LEADERBOARDS,
  rankPositions,
  type ListedPosition,
} from "../position-rankings";
import { stripRosterPrefix, cleanDisplayName } from "../position-slug";
import PositionKeywordBrowser from "./PositionKeywordBrowser";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";
const TOP_N = 8;

// Rendu dynamique (au request) : la page lit l'API positions au rendu. En
// statique elle serait pre-rendue au build sans backend (ECONNREFUSED) ; le
// backend a deja son propre cache (memoize 5 min).
export const dynamic = "force-dynamic";

async function fetchListedPositions(): Promise<ListedPosition[]> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ positions?: ListedPosition[] }>(
    `${base}/api/positions?lang=fr&ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  return data?.positions ?? [];
}

export function generateMetadata(): Metadata {
  const url = `${BASE_URL}/teams/positions`;
  const title = "Études des positions Blood Bowl — classements par stats";
  const description =
    "Classements des positions Blood Bowl (Saison 3) : les plus rapides, les plus fortes, les plus blindées, les plus agiles, les meilleures passeuses et les moins chères. Comparez tous les postes de tous les rosters.";
  return {
    title,
    description,
    keywords: [
      "Blood Bowl",
      "positions",
      "classement",
      "meilleures positions",
      "stats",
      "Nuffle Arena",
    ],
    alternates: {
      canonical: url,
      languages: { "fr-FR": url, en: url, "x-default": url },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "Nuffle Arena",
      images: [
        { url: `${BASE_URL}/images/logo.png`, width: 1200, height: 630 },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function buildSchema(): Record<string, unknown> {
  const url = `${BASE_URL}/teams/positions`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        name: "Études des positions Blood Bowl",
        url,
        isPartOf: { "@id": `${BASE_URL}#organization` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: BASE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Équipes",
            item: `${BASE_URL}/teams`,
          },
          { "@type": "ListItem", position: 3, name: "Positions", item: url },
        ],
      },
    ],
  };
}

export default async function PositionsStudiesPage() {
  const positions = await fetchListedPositions();

  return (
    <>
      <StructuredData data={buildSchema()} />

      <div className="max-w-5xl mx-auto w-full p-4 sm:p-6">
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 mb-6">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-emerald-700">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/teams" className="hover:text-emerald-700">
                Équipes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-semibold" aria-current="page">
              Positions
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            Études des positions
          </h1>
          <p className="mt-2 text-gray-600 max-w-3xl">
            Classements de toutes les positions Blood Bowl (Saison 3), dérivés
            de leurs caractéristiques. Un point de départ pour repérer les
            meilleurs profils de chaque roster.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/teams/positions/comparer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              ⚔️ Comparer des positions
            </Link>
            <Link
              href="/teams"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
            >
              Tous les rosters
            </Link>
          </div>
        </header>

        {positions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-gray-500">
            Données de positions indisponibles pour le moment.
          </p>
        ) : (
          <>
          <div className="mb-6">
            <PositionKeywordBrowser positions={positions} />
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
            data-testid="positions-leaderboards"
          >
            {LEADERBOARDS.map((board) => {
              const top = rankPositions(positions, board, TOP_N);
              return (
                <section
                  key={board.id}
                  data-testid={`leaderboard-${board.id}`}
                  className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-gray-900">
                    {board.title}
                  </h2>
                  <p className="text-xs text-gray-500 mb-3">{board.subtitle}</p>
                  <ol className="space-y-1.5">
                    {top.map((p, i) => {
                      const segment = stripRosterPrefix(p.slug, p.rosterSlug);
                      const { name } = cleanDisplayName(p.displayName);
                      return (
                        <li key={p.slug}>
                          <Link
                            href={`/teams/${p.rosterSlug}/${segment}`}
                            className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-emerald-50 transition-colors"
                          >
                            <span className="w-5 text-right font-mono text-xs text-gray-400">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-gray-900 group-hover:text-emerald-700">
                                {name}
                              </span>
                              <span className="block truncate text-xs text-gray-500">
                                {p.rosterName}
                              </span>
                            </span>
                            <span className="font-mono text-sm font-semibold text-emerald-700 whitespace-nowrap">
                              {board.format(p[board.key])}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              );
            })}
          </div>
          </>
        )}
      </div>
    </>
  );
}
