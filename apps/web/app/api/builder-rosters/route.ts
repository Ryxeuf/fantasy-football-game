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

  const upstream = `${base}/api/rosters?lang=${lang}&ruleset=${ruleset}`;
  const rosterCount = (data: unknown): number =>
    Array.isArray((data as { rosters?: unknown[] } | null)?.rosters)
      ? (data as { rosters: unknown[] }).rosters.length
      : 0;

  try {
    // Data Cache partagé + taggé : revalidation à la demande sur `rosters`,
    // filet de sécurité temporel d'1 h.
    const res = await fetch(upstream, {
      next: { tags: ["rosters"], revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      // Ne jamais SERVIR (ni laisser le Data Cache empoisonné par) un catalogue
      // vide : un blip de l'API ou une DB en cours de (re)seed renverrait `[]`,
      // et `revalidate: 3600` figerait ce vide pendant 1 h (builder sans roster).
      // Dans ce cas on refait un fetch LIVE (non caché) pour servir l'état réel.
      if (rosterCount(data) > 0) {
        return NextResponse.json(data, {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    const fresh = await fetch(upstream, { cache: "no-store" });
    if (!fresh.ok) return fallback;
    const freshData = await fresh.json();
    return NextResponse.json(freshData, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return fallback;
  }
}
