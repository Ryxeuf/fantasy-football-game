import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  fetchServerJson,
  safeServerJson,
  getServerApiBase,
} from "../../../lib/serverApi";
import StructuredData from "../../../components/StructuredData";
import TeamLogo from "../../../components/TeamLogo";
import { parseMatchup, canonicalMatchup } from "../../matchup";
import {
  getRosterMeta,
  DIFFICULTY_LABELS,
  DIFFICULTY_RANK,
  PLAYSTYLE_LABELS,
} from "../../roster-meta";
import { buildComparisonSchema } from "../../comparison-structured-data";
import { buildComparisonSummary } from "../../comparison-summary";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

// ISR — données de référence. Pas de generateStaticParams pour ne pas
// dépendre du backend au build : rendu à la demande puis caché (cf.
// teams/[slug]).
export const revalidate = 3600;

interface MatchupRoster {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  positionCount: number;
}

interface MatchupPageProps {
  params: { matchup: string };
}

async function fetchRoster(
  slug: string,
  throwing: boolean,
): Promise<MatchupRoster | null> {
  const base = getServerApiBase();
  const url = `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=season_3`;
  const fetcher = throwing ? fetchServerJson : safeServerJson;
  const data = await fetcher<{ roster?: any }>(url, {
    next: { revalidate: 3600 },
  });
  if (!data?.roster) return null;
  const r = data.roster;
  return {
    slug: r.slug,
    name: r.name,
    budget: r.budget,
    tier: r.tier,
    naf: r.naf,
    positionCount: Array.isArray(r.positions) ? r.positions.length : 0,
  };
}

export async function generateMetadata({
  params,
}: MatchupPageProps): Promise<Metadata> {
  const parsed = parseMatchup(params.matchup);
  if (!parsed) {
    return { title: "Comparaison introuvable", robots: { index: false, follow: true } };
  }
  const canonical = canonicalMatchup(parsed.a, parsed.b);
  const canonicalUrl = `${BASE_URL}/teams/comparer/${canonical}`;
  const [a, b] = await Promise.all([
    fetchRoster(parsed.a, false),
    fetchRoster(parsed.b, false),
  ]);
  if (!a || !b) {
    return { title: "Comparaison introuvable", robots: { index: false, follow: true } };
  }

  const title = `${a.name} vs ${b.name} — Comparatif Blood Bowl`;
  const description = `Comparez ${a.name} (Tier ${a.tier}) et ${b.name} (Tier ${b.tier}) sur Blood Bowl : budget, positions, difficulté, style de jeu et Star Players. Quel roster choisir ?`;
  return {
    title,
    description,
    keywords: [
      `${a.name} vs ${b.name}`,
      `comparatif ${a.name}`,
      `comparatif ${b.name}`,
      "Blood Bowl",
      "comparateur rosters",
      "Nuffle Arena",
    ],
    alternates: {
      canonical: canonicalUrl,
      languages: { "fr-FR": canonicalUrl, en: canonicalUrl, "x-default": canonicalUrl },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Nuffle Arena",
      images: [
        {
          url: `${BASE_URL}/images/logo.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const TIER_BADGE: Record<string, string> = {
  I: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  II: "bg-sky-100 text-sky-800 ring-sky-300",
  III: "bg-amber-100 text-amber-800 ring-amber-300",
  IV: "bg-orange-100 text-orange-800 ring-orange-300",
};

function DifficultyScale({ rank }: { rank: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${
            i <= rank ? "bg-nuffle-gold" : "bg-nuffle-bronze/20"
          }`}
        />
      ))}
    </span>
  );
}

export default async function MatchupPage({ params }: MatchupPageProps) {
  const parsed = parseMatchup(params.matchup);
  if (!parsed) {
    notFound();
  }

  // Canonicalisation : redirige toute variante non triée vers la version
  // canonique pour éviter le contenu dupliqué (a-vs-b == b-vs-a).
  const canonical = canonicalMatchup(parsed.a, parsed.b);
  if (params.matchup !== canonical) {
    redirect(`/teams/comparer/${canonical}`);
  }

  const [a, b] = await Promise.all([
    fetchRoster(parsed.a, true),
    fetchRoster(parsed.b, true),
  ]);
  if (!a || !b) {
    notFound();
  }

  const teams: [MatchupRoster, MatchupRoster] = [a, b];
  const metaA = getRosterMeta(a.slug);
  const metaB = getRosterMeta(b.slug);
  const summary = buildComparisonSummary(
    { name: a.name, tier: a.tier, difficulty: metaA.difficulty, playStyle: metaA.playStyle },
    { name: b.name, tier: b.tier, difficulty: metaB.difficulty, playStyle: metaB.playStyle },
    "fr",
  );

  const rows: Array<{ label: string; render: (t: MatchupRoster) => React.ReactNode }> = [
    {
      label: "Tier",
      render: (t) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${TIER_BADGE[t.tier] ?? "bg-gray-100 text-gray-700 ring-gray-300"}`}
        >
          Tier {t.tier}
        </span>
      ),
    },
    {
      label: "Budget",
      render: (t) => (
        <span className="font-score text-lg text-nuffle-anthracite">{t.budget}k</span>
      ),
    },
    {
      label: "Positions",
      render: (t) => (
        <span className="font-semibold text-nuffle-anthracite">{t.positionCount}</span>
      ),
    },
    {
      label: "Difficulté",
      render: (t) => {
        const meta = getRosterMeta(t.slug);
        return (
          <span className="flex flex-col items-center gap-1.5">
            <DifficultyScale rank={DIFFICULTY_RANK[meta.difficulty]} />
            <span className="text-xs font-subtitle text-nuffle-bronze">
              {DIFFICULTY_LABELS.fr[meta.difficulty]}
            </span>
          </span>
        );
      },
    },
    {
      label: "Style de jeu",
      render: (t) => {
        const meta = getRosterMeta(t.slug);
        return (
          <span className="inline-flex items-center rounded-full border border-nuffle-bronze/30 bg-white/60 px-3 py-0.5 text-xs font-subtitle font-semibold text-nuffle-bronze">
            {PLAYSTYLE_LABELS.fr[meta.playStyle]}
          </span>
        );
      },
    },
    {
      label: "Statut NAF",
      render: (t) =>
        t.naf ? (
          <span className="text-nuffle-gold font-bold">NAF</span>
        ) : (
          <span className="text-nuffle-bronze/70">Officielle</span>
        ),
    },
    {
      label: "Star Players emblématiques",
      render: (t) => {
        const meta = getRosterMeta(t.slug);
        return meta.starPlayers.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-nuffle-anthracite/80">
            {meta.starPlayers.map((sp) => (
              <li key={sp}>{sp}</li>
            ))}
          </ul>
        ) : (
          <span className="text-nuffle-bronze/50">—</span>
        );
      },
    },
    {
      label: "En bref",
      render: (t) => {
        const meta = getRosterMeta(t.slug);
        return (
          <span className="text-xs text-nuffle-anthracite/80 leading-relaxed">
            {meta.shortFr}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <StructuredData
        data={buildComparisonSchema({
          teams: [
            { slug: a.slug, name: a.name },
            { slug: b.slug, name: b.name },
          ],
          baseUrl: BASE_URL,
          lang: "fr",
        })}
      />

      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-body">
        {/* Fil d'Ariane */}
        <nav
          aria-label="Fil d'Ariane"
          className="text-sm font-subtitle text-nuffle-bronze/80"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-nuffle-gold transition-colors">
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/teams" className="hover:text-nuffle-gold transition-colors">
                Équipes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/teams/comparer"
                className="hover:text-nuffle-gold transition-colors"
              >
                Comparer
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-nuffle-anthracite font-semibold" aria-current="page">
              {a.name} vs {b.name}
            </li>
          </ol>
        </nav>

        <header className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
          <h1 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-nuffle-anthracite leading-tight">
            {a.name} <span className="text-nuffle-gold">vs</span> {b.name}
          </h1>
          <p className="mt-1 font-subtitle text-nuffle-bronze/80 uppercase tracking-wide text-sm">
            Comparatif de rosters Blood Bowl — Saison 3
          </p>

          <div className="mt-5 flex items-center justify-center gap-4 sm:gap-8">
            <Link
              href={`/teams/${a.slug}`}
              className="group flex flex-col items-center gap-2"
            >
              <TeamLogo slug={a.slug} size={72} title={a.name} />
              <span className="font-heading font-bold text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                {a.name}
              </span>
            </Link>
            <span
              className="font-score text-3xl sm:text-4xl text-nuffle-bronze/50"
              aria-hidden="true"
            >
              VS
            </span>
            <Link
              href={`/teams/${b.slug}`}
              className="group flex flex-col items-center gap-2"
            >
              <TeamLogo slug={b.slug} size={72} title={b.name} />
              <span className="font-heading font-bold text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                {b.name}
              </span>
            </Link>
          </div>

          <p className="mt-6 text-nuffle-anthracite/85 leading-relaxed">{summary}</p>
        </header>

        {/* Tableau comparatif */}
        <div className="overflow-x-auto rounded-2xl border border-nuffle-bronze/20 bg-[#FBF7EC] shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-[#1B1610] px-4 py-3 text-left font-subtitle text-xs uppercase tracking-wide text-nuffle-gold" />
                {teams.map((t) => (
                  <th
                    key={t.slug}
                    className="bg-[#1B1610] px-4 py-3 text-center min-w-[140px]"
                  >
                    <span className="font-heading font-bold text-nuffle-ivory">
                      {t.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nuffle-bronze/15">
              {rows.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="bg-[#FBF7EC] px-4 py-3 text-left font-subtitle text-xs uppercase tracking-wide text-nuffle-bronze/70 whitespace-nowrap align-top"
                  >
                    {row.label}
                  </th>
                  {teams.map((t) => (
                    <td
                      key={t.slug}
                      className={`px-4 py-3 align-top ${row.label === "En bref" ? "text-left" : "text-center"}`}
                    >
                      {row.render(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Maillage interne + CTA */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/teams/${a.slug}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-nuffle-gold/15 px-4 py-2.5 text-sm font-subtitle font-bold text-nuffle-bronze hover:bg-nuffle-gold/30 transition-colors"
          >
            Roster complet {a.name} →
          </Link>
          <Link
            href={`/teams/${b.slug}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-nuffle-gold/15 px-4 py-2.5 text-sm font-subtitle font-bold text-nuffle-bronze hover:bg-nuffle-gold/30 transition-colors"
          >
            Roster complet {b.name} →
          </Link>
          <Link
            href={`/teams/comparer?teams=${a.slug},${b.slug}`}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-nuffle-bronze/40 px-4 py-2.5 text-sm font-subtitle font-bold text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite transition-colors"
          >
            Comparer d'autres équipes
          </Link>
          <Link
            href="/teams/tier-list"
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-nuffle-bronze/40 px-4 py-2.5 text-sm font-subtitle font-bold text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite transition-colors"
          >
            🏆 Tier list
          </Link>
        </div>
      </div>
    </>
  );
}
