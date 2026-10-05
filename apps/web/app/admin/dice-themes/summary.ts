import type { AdminDiceTheme } from "../../lib/admin-dice-themes";

export type AdminDiceThemeFilter = "all" | "classic" | "team" | "on-sale" | "off-sale";

export interface DiceThemesSummary {
  readonly total: number;
  readonly onSale: number;
  readonly owners: number;
  readonly selectedBy: number;
  readonly revenueCrowns: number;
}

/** Totaux affichés en tête de la page admin (pur). */
export function summarizeDiceThemes(themes: readonly AdminDiceTheme[]): DiceThemesSummary {
  return themes.reduce<DiceThemesSummary>(
    (acc, t) => ({
      total: acc.total + 1,
      onSale: acc.onSale + (t.enabled && t.priceCrowns !== null ? 1 : 0),
      owners: acc.owners + t.stats.owners,
      selectedBy: acc.selectedBy + t.stats.selectedBy,
      revenueCrowns: acc.revenueCrowns + t.stats.revenueCrowns,
    }),
    { total: 0, onSale: 0, owners: 0, selectedBy: 0, revenueCrowns: 0 },
  );
}

/** Filtre + recherche (nom FR/EN ou id, sans casse ni accents) — pur. */
export function filterAdminDiceThemes(
  themes: readonly AdminDiceTheme[],
  filter: AdminDiceThemeFilter,
  search: string,
): AdminDiceTheme[] {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = fold(search.trim());
  return themes.filter((t) => {
    if (filter === "classic" || filter === "team") {
      if (t.collection !== filter) return false;
    }
    if (filter === "on-sale" && !(t.enabled && t.priceCrowns !== null)) return false;
    if (filter === "off-sale" && t.enabled) return false;
    if (!q) return true;
    return [t.id, t.name.fr, t.name.en].some((v) => fold(v).includes(q));
  });
}
