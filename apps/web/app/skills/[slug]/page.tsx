import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { fetchServerJson, safeServerJson, getServerApiBase } from "../../lib/serverApi";
import { getSkillCategoryIcon } from "../../lib/skill-category-icons";
import StructuredData from "../../components/StructuredData";
import { buildSkillDetailSchema } from "../skill-detail-structured-data";
import type { Skill } from "../SkillsClient";
import {
  groupPositionsByRoster,
  type ApiPositionLite,
  type SkillRosterGroup,
} from "../positions-with-skill";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

// ISR — les definitions de competences ne changent qu'avec une edition
// de regles. On ne declare pas generateStaticParams pour ne pas dependre
// du backend au build : les pages sont rendues a la demande puis cachees.
export const revalidate = 3600;

interface SkillPageProps {
  params: { slug: string };
}

const CATEGORY_LABELS: Record<string, { fr: string; related: string }> = {
  General: { fr: "Compétence générale", related: "Autres compétences générales" },
  Agility: { fr: "Compétence d'agilité", related: "Autres compétences d'agilité" },
  Strength: { fr: "Compétence de force", related: "Autres compétences de force" },
  Passing: { fr: "Compétence de passe", related: "Autres compétences de passe" },
  Mutation: { fr: "Mutation", related: "Autres mutations" },
  Trait: { fr: "Trait", related: "Autres traits" },
  "Scélérates": { fr: "Compétence scélérate", related: "Autres compétences scélérates" },
};

const RULESET_LABELS: Record<string, string> = {
  season_2: "Saison 2 (2020)",
  season_3: "Saison 3 (2025)",
};

interface SkillBundle {
  skill: Skill;
  related: Skill[];
  /** Ruleset dans lequel la compétence a été trouvée (pour fetcher les positions). */
  ruleset: string;
}

async function fetchSkillList(ruleset: string, throwing: boolean): Promise<Skill[]> {
  const base = getServerApiBase();
  const url = `${base}/api/skills?ruleset=${encodeURIComponent(ruleset)}`;
  const fetcher = throwing ? fetchServerJson : safeServerJson;
  const data = await fetcher<{ skills?: Skill[] }>(url, { next: { revalidate: 3600 } });
  return data?.skills ?? [];
}

async function getSkillBundle(slug: string, throwing: boolean): Promise<SkillBundle | null> {
  // On privilégie la Saison 3 (édition courante), repli sur la Saison 2.
  for (const ruleset of ["season_3", "season_2"] as const) {
    const list = await fetchSkillList(ruleset, throwing);
    const skill = list.find((s) => s.slug === slug);
    if (skill) {
      const related = list
        .filter((s) => s.category === skill.category && s.slug !== skill.slug)
        .sort((a, b) => a.nameFr.localeCompare(b.nameFr))
        .slice(0, 8);
      return { skill, related, ruleset };
    }
  }
  return null;
}

/**
 * Positions qui DÉMARRENT avec cette compétence, groupées par roster. Le fetch
 * de la liste des positions est best-effort (jamais bloquant pour l'affichage
 * de la compétence) : en cas d'erreur réseau on rend simplement la page sans
 * ce bloc de maillage interne.
 */
async function fetchPositionsWithSkill(
  slug: string,
  ruleset: string,
): Promise<SkillRosterGroup[]> {
  const base = getServerApiBase();
  const url = `${base}/api/positions?lang=fr&ruleset=${encodeURIComponent(ruleset)}`;
  const data = await safeServerJson<{ positions?: ApiPositionLite[] }>(url, {
    next: { revalidate: 3600 },
  });
  return groupPositionsByRoster(data?.positions ?? [], slug);
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const bundle = await getSkillBundle(params.slug, false);
  const url = `${BASE_URL}/skills/${params.slug}`;
  if (!bundle) {
    return { title: "Compétence introuvable", robots: { index: false, follow: true } };
  }
  const { skill } = bundle;
  const title = `${skill.nameFr} (${skill.nameEn}) — Compétence Blood Bowl`;
  const rawDesc = skill.description || skill.descriptionEn || "";
  const description = `${skill.nameFr} : ${rawDesc}`.slice(0, 300);
  return {
    title,
    description,
    keywords: [
      `${skill.nameFr} Blood Bowl`,
      `${skill.nameEn} Blood Bowl`,
      skill.nameFr,
      skill.nameEn,
      "Blood Bowl",
      "compétence",
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
      images: [{ url: `${BASE_URL}/images/logo.png`, width: 1200, height: 630, alt: skill.nameFr }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SkillDetailPage({ params }: SkillPageProps) {
  const bundle = await getSkillBundle(params.slug, true);
  if (!bundle) {
    notFound();
  }
  const { skill, related, ruleset } = bundle;
  const positionGroups = await fetchPositionsWithSkill(skill.slug, ruleset);
  const positionCount = positionGroups.reduce(
    (sum, group) => sum + group.positions.length,
    0,
  );
  const icon = getSkillCategoryIcon(skill.category);
  const categoryLabel = CATEGORY_LABELS[skill.category]?.fr ?? skill.category;
  const relatedHeading = CATEGORY_LABELS[skill.category]?.related ?? "Autres compétences";
  const rulesetLabel = RULESET_LABELS[skill.ruleset] ?? skill.ruleset;
  const hasEnglish = Boolean(skill.descriptionEn && skill.descriptionEn !== skill.description);

  return (
    <>
      <StructuredData data={buildSkillDetailSchema({ skill, baseUrl: BASE_URL })} />

      <div className="max-w-3xl mx-auto w-full">
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="text-sm font-subtitle text-nuffle-bronze/80 mb-6">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><a href="/" className="hover:text-nuffle-gold transition-colors">Accueil</a></li>
            <li aria-hidden="true">/</li>
            <li><a href="/skills" className="hover:text-nuffle-gold transition-colors">Compétences</a></li>
            <li aria-hidden="true">/</li>
            <li className="text-nuffle-anthracite font-semibold" aria-current="page">{skill.nameFr}</li>
          </ol>
        </nav>

        {/* En-tête */}
        <header className="rounded-2xl bg-[#FBF7EC] border border-nuffle-bronze/20 p-6 sm:p-8 shadow-[0_2px_10px_rgba(107,78,46,0.06)]">
          <div className="flex items-start gap-4 sm:gap-5">
            <span className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-[#1B1610] ring-1 ring-nuffle-gold/40 shadow-[inset_0_1px_0_rgba(232,201,106,0.25)]">
              {icon ? (
                <Image src={icon} alt="" width={36} height={36} className="object-contain" />
              ) : (
                <span className="text-nuffle-gold text-2xl" aria-hidden="true">✦</span>
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-nuffle-bronze/30 bg-white/50 px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze">
                  {categoryLabel}
                </span>
                <span className="inline-flex items-center rounded-full border border-nuffle-gold/40 bg-nuffle-gold/10 px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze">
                  {rulesetLabel}
                </span>
                {/* E8 — Actif / Passif */}
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-subtitle font-semibold uppercase tracking-wide ${
                    skill.isPassive
                      ? "border-violet-300 bg-violet-50 text-violet-800"
                      : "border-emerald-300 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  {skill.isPassive ? "Passif" : "Actif"}
                </span>
              </div>
              <h1 className="mt-2 font-heading font-bold text-3xl sm:text-4xl text-nuffle-anthracite leading-tight">
                {skill.nameFr}
              </h1>
              <p className="mt-1 font-subtitle text-nuffle-bronze/80">{skill.nameEn}</p>
            </div>
          </div>

          <span className="mt-6 block h-px w-full bg-nuffle-bronze/15" aria-hidden="true" />

          <div className="mt-6">
            <h2 className="font-heading font-bold text-lg text-nuffle-anthracite">Effet en jeu</h2>
            <p className="mt-2 text-nuffle-anthracite/80 font-body leading-relaxed">
              {skill.description}
            </p>
            {hasEnglish && (
              <div className="mt-4 rounded-xl border border-nuffle-bronze/15 bg-white/40 p-4">
                <p className="text-xs font-subtitle font-semibold uppercase tracking-wide text-nuffle-bronze/70">
                  In English — {skill.nameEn}
                </p>
                <p className="mt-1.5 text-nuffle-anthracite/75 font-body text-sm leading-relaxed">
                  {skill.descriptionEn}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Compétences liées (même catégorie) */}
        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="font-heading font-bold text-xl text-nuffle-anthracite">
              {relatedHeading}
            </h2>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <a
                    href={`/skills/${r.slug}`}
                    className="group flex items-center gap-3 rounded-xl bg-[#FBF7EC] border border-nuffle-bronze/20 px-4 py-3 hover:border-nuffle-gold/60 hover:-translate-y-0.5 transition-all"
                  >
                    <span className="font-subtitle font-semibold text-nuffle-anthracite group-hover:text-nuffle-gold transition-colors">
                      {r.nameFr}
                    </span>
                    <span className="ml-auto text-nuffle-bronze/60 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Positions qui démarrent avec cette compétence (maillage interne) */}
        {positionGroups.length > 0 && (
          <section className="mt-8" data-testid="skill-positions">
            <h2 className="font-heading font-bold text-xl text-nuffle-anthracite">
              Positions avec cette compétence
            </h2>
            <p className="mt-1 text-sm font-body text-nuffle-bronze/80">
              {positionCount === 1
                ? "1 poste démarre"
                : `${positionCount} postes démarrent`}{" "}
              avec {skill.nameFr} dès le recrutement.
            </p>
            <div className="mt-4 space-y-5">
              {positionGroups.map((group) => (
                <div key={group.rosterSlug}>
                  <h3 className="font-subtitle text-sm font-semibold uppercase tracking-wide text-nuffle-bronze/70">
                    <a
                      href={`/teams/${group.rosterSlug}`}
                      className="hover:text-nuffle-gold transition-colors"
                    >
                      {group.rosterName}
                    </a>
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {group.positions.map((position) => (
                      <li key={`${group.rosterSlug}-${position.segment}`}>
                        <a
                          href={`/teams/${group.rosterSlug}/${position.segment}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF7EC] border border-nuffle-bronze/20 px-3 py-1.5 text-sm font-subtitle font-semibold text-nuffle-anthracite hover:border-nuffle-gold/60 hover:text-nuffle-gold transition-all"
                        >
                          {position.displayName}
                          <span aria-hidden="true" className="text-nuffle-bronze/50">
                            →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Retour */}
        <div className="mt-8">
          <a
            href="/skills"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-nuffle-bronze/40 text-nuffle-bronze hover:border-nuffle-gold hover:text-nuffle-anthracite hover:bg-nuffle-gold/10 font-subtitle font-bold uppercase tracking-wide text-sm transition-all"
          >
            <span aria-hidden="true">←</span> Toutes les compétences
          </a>
        </div>
      </div>
    </>
  );
}
