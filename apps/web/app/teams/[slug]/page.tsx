import { notFound } from "next/navigation";
import { DEFAULT_RULESET, type Ruleset } from "@bb/game-engine";
import { getServerApiBase, safeServerJson } from "../../lib/serverApi";
import TeamDetailClient from "./TeamDetailClient";

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
  const data = await safeServerJson<{ roster?: any; ruleset?: Ruleset }>(
    `${base}/api/rosters/${encodeURIComponent(slug)}?lang=fr&ruleset=${ruleset}`,
    { next: { revalidate: 3600 } },
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

  return (
    <TeamDetailClient
      slug={params.slug}
      selectedRuleset={selectedRuleset}
      actualRuleset={payload.ruleset}
      initialTeam={payload.roster}
    />
  );
}
