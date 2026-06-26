import { Suspense } from "react";
import type { Metadata } from "next";
import { getServerApiBase, safeServerJson } from "../lib/serverApi";
import {
  compendiumRecords,
  skillRecords,
  positionRecords,
  rosterRecords,
  starRecords,
  type ApiSkill,
  type ApiPosition,
  type ApiRoster,
  type ApiStar,
} from "./build-records";
import type { SearchRecord } from "./search";
import SearchClient from "./SearchClient";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

// ISR — corpus de référence (règles, compétences, rosters) peu mouvant.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Recherche — Nuffle Arena",
  description:
    "Recherchez dans tout le contenu public de Nuffle Arena : règles (compendium), compétences, positions, équipes et star players de Blood Bowl.",
  alternates: { canonical: `${BASE_URL}/recherche` },
  robots: { index: true, follow: true },
};

/** Charge tous les corpus publics (tolérant : un échec n'ôte que sa source). */
async function loadRecords(): Promise<SearchRecord[]> {
  const base = getServerApiBase();
  const ruleset = "season_3";
  const opts = { next: { revalidate: 3600 } } as const;

  const [skills, rosters, positions, stars] = await Promise.all([
    safeServerJson<{ skills?: ApiSkill[] }>(
      `${base}/api/skills?ruleset=${ruleset}`,
      opts,
    ),
    safeServerJson<{ rosters?: ApiRoster[] }>(
      `${base}/api/rosters?lang=fr&ruleset=${ruleset}`,
      opts,
    ),
    safeServerJson<{ positions?: ApiPosition[] }>(
      `${base}/api/positions?lang=fr&ruleset=${ruleset}`,
      opts,
    ),
    safeServerJson<{ data?: ApiStar[] }>(`${base}/star-players`, opts),
  ]);

  const rosterList = rosters?.rosters ?? [];
  const rosterNameBySlug = new Map(rosterList.map((r) => [r.slug, r.name]));

  return [
    ...compendiumRecords(),
    ...skillRecords(skills?.skills ?? []),
    ...positionRecords(positions?.positions ?? [], rosterNameBySlug),
    ...rosterRecords(rosterList),
    ...starRecords(stars?.data ?? []),
  ];
}

export default async function SearchPage(): Promise<JSX.Element> {
  const records = await loadRecords();
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <Suspense fallback={<div className="h-12" />}>
        <SearchClient records={records} />
      </Suspense>
    </main>
  );
}
