import { notFound } from "next/navigation";
import { DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { fetchSkillsCatalog } from "../../lib/skills-catalog.server";
import { SkillsCatalogProvider } from "../../me/teams/skills-catalog-context";
import TeamDetailClient from "./TeamDetailClient";
import TeamStructuredData from "./TeamStructuredData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

// ISR — roster definitions are reference data that rarely changes.
export const revalidate = 3600;

interface TeamPageProps {
  params: { slug: string };
  searchParams: { ruleset?: string };
}

async function fetchRoster(
  slug: string,
  ruleset: Ruleset,
): Promise<{ roster: any; ruleset: Ruleset } | null> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ roster?: any; ruleset?: Ruleset }>(
    `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=${ruleset}`,
    // Taggé pour l'invalidation à la demande (revalidateTag) après une
    // écriture roster ; cf. apps/web/app/api/revalidate/route.ts.
    { next: { revalidate: 3600, tags: ["rosters", `roster:${slug}`] } },
  );
  if (!data?.roster) return null;
  return { roster: data.roster, ruleset: (data.ruleset as Ruleset) || ruleset };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: TeamPageProps) {
  const selectedRuleset: Ruleset =
    searchParams.ruleset === "season_2"
      ? "season_2"
      : searchParams.ruleset === "season_3"
        ? "season_3"
        : DEFAULT_RULESET;

  const payload = await fetchRoster(params.slug, selectedRuleset);
  if (!payload) {
    notFound();
  }

  // Catalogue de compétences résolu côté serveur (même ruleset que le roster)
  // → les noms/catégories des badges sont corrects dès le HTML initial, sans
  // flash ni changement au survol. Échec toléré → catalogue vide (fallback
  // cache client).
  const skillsCatalog = await fetchSkillsCatalog(payload.ruleset);

  return (
    <>
      <TeamStructuredData
        slug={params.slug}
        roster={payload.roster}
        ruleset={payload.ruleset}
        baseUrl={SITE_URL}
        lang="fr"
      />
      <SkillsCatalogProvider value={skillsCatalog}>
        <TeamDetailClient
          slug={params.slug}
          selectedRuleset={selectedRuleset}
          actualRuleset={payload.ruleset}
          initialTeam={payload.roster}
        />
      </SkillsCatalogProvider>
    </>
  );
}
