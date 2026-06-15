import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import {
  fetchServerJson,
  safeServerJson,
  getServerApiBase,
} from "../../../lib/serverApi";
import StructuredData from "../../../components/StructuredData";
import { buildPositionDetailSchema } from "../../position-detail-structured-data";
import {
  resolvePosition,
  stripRosterPrefix,
  cleanDisplayName,
  parseSkillCsv,
  parseAccessCodes,
  prettifySlug,
} from "../../position-slug";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

// ISR — les positions sont des donnees de reference qui changent rarement.
// Pas de generateStaticParams : rendu a la demande puis cache (comme /skills).
export const revalidate = 3600;

interface PositionPageProps {
  params: { slug: string; position: string };
  searchParams: { ruleset?: string };
}

interface ApiPosition {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
  primarySkills: string | null;
  secondarySkills: string | null;
}

interface ApiRoster {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  positions: ApiPosition[];
}

interface PositionBundle {
  roster: ApiRoster;
  position: ApiPosition;
  ruleset: Ruleset;
  /** slug de competence -> nom FR (pour des liens lisibles vers /skills). */
  skillNameBySlug: Map<string, string>;
}

const ACCESS_FR: Record<string, { letter: string; label: string }> = {
  G: { letter: "G", label: "Général" },
  A: { letter: "A", label: "Agilité" },
  S: { letter: "F", label: "Force" },
  P: { letter: "P", label: "Passe" },
  M: { letter: "M", label: "Mutation" },
};

const STAT_BOXES: ReadonlyArray<{
  key: keyof Pick<ApiPosition, "ma" | "st" | "ag" | "pa" | "av">;
  label: string;
  classes: string;
}> = [
  { key: "ma", label: "MA", classes: "bg-blue-50 text-blue-900" },
  { key: "st", label: "ST", classes: "bg-red-50 text-red-900" },
  { key: "ag", label: "AG", classes: "bg-green-50 text-green-900" },
  { key: "pa", label: "PA", classes: "bg-purple-50 text-purple-900" },
  { key: "av", label: "AV", classes: "bg-orange-50 text-orange-900" },
];

function resolveRuleset(raw: string | undefined): Ruleset {
  if (raw === "season_2") return "season_2";
  if (raw === "season_3") return "season_3";
  return DEFAULT_RULESET;
}

async function fetchSkillNames(
  base: string,
  ruleset: Ruleset,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const data = await safeServerJson<{
    skills?: Array<{ slug?: string; nameFr?: string }>;
  }>(`${base}/api/skills?ruleset=${encodeURIComponent(ruleset)}`, {
    next: { revalidate: 3600 },
  });
  for (const s of data?.skills ?? []) {
    if (s.slug && s.nameFr) map.set(s.slug, s.nameFr);
  }
  return map;
}

async function loadBundle(
  slug: string,
  segment: string,
  ruleset: Ruleset,
  throwing: boolean,
): Promise<PositionBundle | null> {
  const base = getServerApiBase();
  const fetcher = throwing ? fetchServerJson : safeServerJson;
  const data = await fetcher<{ roster?: ApiRoster; ruleset?: Ruleset }>(
    `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=${ruleset}`,
    { next: { revalidate: 3600 } },
  );
  const roster = data?.roster;
  if (!roster) return null;
  const position = resolvePosition(roster, segment);
  if (!position) return null;
  const actualRuleset = (data?.ruleset as Ruleset) || ruleset;
  const skillNameBySlug = await fetchSkillNames(base, actualRuleset);
  return { roster, position, ruleset: actualRuleset, skillNameBySlug };
}

export async function generateMetadata({
  params,
  searchParams,
}: PositionPageProps): Promise<Metadata> {
  const ruleset = resolveRuleset(searchParams.ruleset);
  const bundle = await loadBundle(params.slug, params.position, ruleset, false);
  if (!bundle) {
    return {
      title: "Position introuvable",
      robots: { index: false, follow: true },
    };
  }
  const { roster, position } = bundle;
  const { name } = cleanDisplayName(position.displayName);
  const segment = stripRosterPrefix(position.slug, roster.slug);
  const url = `${BASE_URL}/teams/${roster.slug}/${segment}`;
  const title = `${name} — ${roster.name} | Position Blood Bowl`;
  const description = `${name} du roster ${roster.name} (Blood Bowl) : MA ${position.ma}, ST ${position.st}, AG ${position.ag}+, PA ${position.pa}+, AV ${position.av}+, cout ${position.cost}k po. Competences de depart, acces et positions liees.`;
  return {
    title,
    description,
    keywords: [
      name,
      `${name} ${roster.name}`,
      `${name} Blood Bowl`,
      roster.name,
      "Blood Bowl",
      "position",
      "roster",
      "Nuffle Arena",
    ],
    alternates: {
      canonical: url,
      languages: { "fr-FR": url, en: url, "x-default": url },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: "Nuffle Arena",
      images: [
        {
          url: `${BASE_URL}/images/logo.png`,
          width: 1200,
          height: 630,
          alt: `${name} — ${roster.name}`,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PositionDetailPage({
  params,
  searchParams,
}: PositionPageProps) {
  const ruleset = resolveRuleset(searchParams.ruleset);
  const bundle = await loadBundle(params.slug, params.position, ruleset, true);
  if (!bundle) {
    notFound();
  }
  const { roster, position, skillNameBySlug } = bundle;
  const { name, isBigGuy } = cleanDisplayName(position.displayName);
  const segment = stripRosterPrefix(position.slug, roster.slug);
  const rulesetQuery = ruleset === DEFAULT_RULESET ? "" : `?ruleset=${ruleset}`;

  const baseSkills = parseSkillCsv(position.skills);
  const primaryAccess = parseAccessCodes(position.primarySkills);
  const secondaryAccess = parseAccessCodes(position.secondarySkills);
  const related = [...roster.positions]
    .filter((p) => p.slug !== position.slug)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const schema = buildPositionDetailSchema({
    position: {
      rosterSlug: roster.slug,
      rosterName: roster.name,
      segment,
      name,
      cost: position.cost,
      ma: position.ma,
      st: position.st,
      ag: position.ag,
      pa: position.pa,
      av: position.av,
    },
    baseUrl: BASE_URL,
  });

  return (
    <>
      <StructuredData data={schema} />

      <div
        className="max-w-3xl mx-auto w-full p-4 sm:p-6"
        data-testid="position-detail"
      >
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 mb-6">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="hover:text-emerald-700 transition-colors"
              >
                Accueil
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/teams"
                className="hover:text-emerald-700 transition-colors"
              >
                Équipes
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href={`/teams/${roster.slug}${rulesetQuery}`}
                className="hover:text-emerald-700 transition-colors"
              >
                {roster.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-semibold" aria-current="page">
              {name}
            </li>
          </ol>
        </nav>

        {/* En-tete */}
        <header className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/teams/${roster.slug}${rulesetQuery}`}
              className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              {roster.name}
            </Link>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
              Tier {roster.tier}
            </span>
            {isBigGuy && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                Big Guy
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            {name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono text-sm font-semibold">
              {position.cost}k po
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
              {position.min}-{position.max} joueurs
            </span>
          </div>

          {/* Stats */}
          <div className="mt-6">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Caractéristiques
            </div>
            <div className="grid grid-cols-5 gap-2">
              {STAT_BOXES.map((box) => (
                <div
                  key={box.key}
                  className={`rounded-lg p-2 text-center ${box.classes}`}
                  data-testid={`position-stat-${box.key}`}
                >
                  <div className="text-xs font-medium mb-0.5 opacity-80">
                    {box.label}
                  </div>
                  <div className="text-base sm:text-lg font-bold font-mono">
                    {position[box.key]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Competences de depart -> liens vers /skills */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            Compétences de départ
          </h2>
          {baseSkills.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {baseSkills.map((sk) => {
                const label = skillNameBySlug.get(sk);
                return label ? (
                  <li key={sk}>
                    <Link
                      href={`/skills/${sk}`}
                      data-testid="position-base-skill"
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium hover:border-emerald-400 hover:bg-emerald-100 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ) : (
                  <li
                    key={sk}
                    data-testid="position-base-skill"
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium"
                  >
                    {prettifySlug(sk)}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Aucune compétence de départ.
            </p>
          )}
        </section>

        {/* Acces aux competences (montee de niveau) */}
        {(primaryAccess.length > 0 || secondaryAccess.length > 0) && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900">
              Accès aux compétences
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {primaryAccess.length > 0 && (
                <span className="text-gray-500">Primaire :</span>
              )}
              {primaryAccess.map((c) => (
                <Link
                  key={`p-${c}`}
                  href={`/skills?category=${ACCESS_FR[c].label}`}
                  title={`Primaire — ${ACCESS_FR[c].label}`}
                  className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200 transition-colors"
                >
                  {ACCESS_FR[c].letter}
                </Link>
              ))}
              {secondaryAccess.length > 0 && (
                <span className="ml-2 text-gray-500">Secondaire :</span>
              )}
              {secondaryAccess.map((c) => (
                <Link
                  key={`s-${c}`}
                  href={`/skills?category=${ACCESS_FR[c].label}`}
                  title={`Secondaire — ${ACCESS_FR[c].label}`}
                  className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {ACCESS_FR[c].letter}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Positions liees du meme roster */}
        {related.length > 0 && (
          <section className="mt-8" data-testid="position-related">
            <h2 className="text-lg font-semibold text-gray-900">
              Autres positions des {roster.name}
            </h2>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((p) => {
                const seg = stripRosterPrefix(p.slug, roster.slug);
                const cleaned = cleanDisplayName(p.displayName);
                return (
                  <li key={p.slug}>
                    <Link
                      href={`/teams/${roster.slug}/${seg}${rulesetQuery}`}
                      className="group flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3 hover:border-emerald-400 hover:-translate-y-0.5 transition-all shadow-sm"
                    >
                      <span className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                        {cleaned.name}
                      </span>
                      <span className="ml-auto font-mono text-sm text-emerald-700">
                        {p.cost}k
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Retour */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/teams/${roster.slug}${rulesetQuery}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:border-emerald-500 hover:bg-emerald-50 font-medium text-sm transition-all"
          >
            <span aria-hidden="true">←</span> Roster {roster.name}
          </Link>
          <Link
            href={`/me/teams/new?roster=${roster.slug}&ruleset=${ruleset}`}
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm transition-colors"
          >
            Créer une équipe {roster.name}
          </Link>
        </div>
      </div>
    </>
  );
}
