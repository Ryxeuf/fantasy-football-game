import { NextResponse } from "next/server";
import { getServerApiBase } from "../../lib/serverApi";

/**
 * Proxy ISR taggé du catalogue de rosters pour le builder d'équipe.
 *
 * Le builder (`/me/teams/new`) est un composant client : un `fetch` direct
 * vers l'API publique était mis en cache par le navigateur (Cache-Control
 * `max-age=3600`), si bien qu'une édition admin (config staff…) ne se
 * reflétait pas avant 1 h. Ici, le fetch amont est rangé dans le **Data
 * Cache** de Next, taggé `rosters` : il est invalidé **à la demande** par
 * `revalidateRosterPages` (POST /api/revalidate → `revalidateTag('rosters')`)
 * après toute écriture roster. La réponse renvoyée au navigateur est
 * `no-store` : pas de cache navigateur, fraîcheur pilotée par le tag.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ruleset =
    url.searchParams.get("ruleset") === "season_2" ? "season_2" : "season_3";
  const lang = url.searchParams.get("lang") === "en" ? "en" : "fr";
  const base = getServerApiBase();

  const fallback = NextResponse.json(
    { rosters: [], ruleset },
    { headers: { "Cache-Control": "no-store" } },
  );

  try {
    const res = await fetch(
      `${base}/api/rosters?lang=${lang}&ruleset=${ruleset}`,
      // Data Cache partagé + taggé : revalidation à la demande sur `rosters`,
      // filet de sécurité temporel d'1 h.
      { next: { tags: ["rosters"], revalidate: 3600 } },
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return fallback;
  }
}
