import { fetchServerJson, getServerApiBase } from "./serverApi";
import type {
  SkillCatalogEntry,
  SkillsCatalog,
} from "../me/teams/skills-catalog-context";

// Récupère le référentiel de compétences côté serveur (SSR) pour un ruleset
// donné et le projette en map indexée par slug + nameFr + nameEn (pour matcher
// la même logique de lookup que `getSkillDescription`).
//
// Taggé `skills` pour l'invalidation à la demande (cf. /api/revalidate). Échec
// toléré : on renvoie un catalogue vide → l'UI retombe sur le cache client.

export async function fetchSkillsCatalog(
  ruleset: string,
): Promise<SkillsCatalog> {
  const base = getServerApiBase();
  const data = await fetchServerJson<{ skills?: SkillCatalogEntry[] }>(
    `${base}/api/skills?ruleset=${encodeURIComponent(ruleset)}`,
    { next: { revalidate: 3600, tags: ["skills"] } },
  ).catch(() => null);

  const catalog: SkillsCatalog = {};
  for (const s of data?.skills ?? []) {
    if (!s?.slug) continue;
    catalog[s.slug] = s;
    if (s.nameFr) catalog[s.nameFr] = s;
    if (s.nameEn) catalog[s.nameEn] = s;
  }
  return catalog;
}
