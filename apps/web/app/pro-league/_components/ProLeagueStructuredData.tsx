import Script from "next/script";

import { buildProLeagueSchema } from "./pro-league-schema";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://nufflearena.fr";

/**
 * JSON-LD structured data pour la Pro League (sprint 1.F.3).
 * Wrapper React autour de `buildProLeagueSchema` (pure).
 */
export default function ProLeagueStructuredData(): JSX.Element {
  const data = buildProLeagueSchema({ baseUrl: BASE_URL });
  return (
    <Script
      id="pro-league-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
