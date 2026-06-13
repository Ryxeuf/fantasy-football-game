import { fetchServerJson, getServerApiBase } from "../lib/serverApi";
import StructuredData from "../components/StructuredData";
import { buildTeamsListSchema } from "./teams-list-structured-data";
import TeamsListClient, {
  type RosterSummary,
  type Season,
} from "./TeamsListClient";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

// ISR: regenerate at most once per hour. Rosters are essentially static
// reference data; stale-while-revalidate is handled by Next.js.
export const revalidate = 3600;

async function fetchRosters(season: Season): Promise<RosterSummary[]> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ rosters?: any[] }>(
    `${base}/api/rosters?lang=fr&ruleset=${season}`,
    { next: { revalidate: 3600 } },
  );
  return (data?.rosters ?? []).map((roster: any) => ({
    slug: roster.slug,
    name: roster.name,
    budget: roster.budget,
    tier: roster.tier,
    naf: roster.naf,
    positionCount: roster._count?.positions ?? 0,
  }));
}

interface TeamsListPageProps {
  searchParams: { ruleset?: string };
}

export default async function TeamsListPage({
  searchParams,
}: TeamsListPageProps) {
  const season: Season =
    searchParams.ruleset === "season_2" ? "season_2" : "season_3";
  const initialRosters = await fetchRosters(season);

  return (
    <>
      <StructuredData
        data={buildTeamsListSchema({
          items: initialRosters.map((r) => ({ slug: r.slug, name: r.name })),
          baseUrl: SITE_URL,
        })}
      />
      <TeamsListClient
        initialRosters={initialRosters}
        initialSeason={season}
      />
    </>
  );
}
