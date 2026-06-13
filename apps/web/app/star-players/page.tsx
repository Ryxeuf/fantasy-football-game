import { safeServerJson, getServerApiBase } from "../lib/serverApi";
import StructuredData from "../components/StructuredData";
import { buildStarPlayersListSchema } from "./star-players-list-structured-data";
import StarPlayersClient from "./StarPlayersClient";

// ISR — les Star Players sont des données de référence (édition courante).
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr"
).replace(/\/$/, "");

interface StarRow {
  slug?: string;
  displayName?: string;
}

/**
 * Récupère la liste des Star Players (édition courante) pour le JSON-LD
 * `ItemList`. Non-bloquant : si l'API échoue, la liste interactive
 * (client) s'affiche quand même, sans schéma.
 */
async function fetchStarPlayerItems(): Promise<{ slug: string; name: string }[]> {
  const base = getServerApiBase();
  const body = await safeServerJson<{ success?: boolean; data?: StarRow[] }>(
    `${base}/star-players?ruleset=season_3`,
    { next: { revalidate: 3600 } },
  );
  const rows = body?.data ?? [];
  const seen = new Set<string>();
  const items: { slug: string; name: string }[] = [];
  for (const r of rows) {
    if (!r?.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    items.push({ slug: r.slug, name: r.displayName ?? r.slug });
  }
  return items;
}

export default async function StarPlayersListPage() {
  const items = await fetchStarPlayerItems();
  return (
    <>
      {items.length > 0 && (
        <StructuredData
          data={buildStarPlayersListSchema({ items, baseUrl: SITE_URL })}
        />
      )}
      <StarPlayersClient />
    </>
  );
}
