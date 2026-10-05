"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDiceTheme, type DiceThemeOption } from "../../contexts/DiceThemeContext";
import { useCrowns } from "../../contexts/CrownsContext";
import { CrownsBalance } from "../../components/crowns/CrownsBalance";
import { DiceThemePreview } from "../../components/dice/DiceThemePreview";
import { formatCrowns } from "../../lib/crowns";
import { DICE_SHOP_FILTERS, filterShopThemes, shopAction, type DiceShopFilter } from "./shop";

/**
 * Boutique des thèmes de dés : aperçu des 11 faces de chaque thème, choix
 * d'un thème possédé, achat en Crowns d'un thème en vente.
 *
 * Masquée quand le flag `dice_themes` est OFF. Les Crowns (solde, bouton
 * d'achat) n'apparaissent qu'avec le flag `crowns` ; sans lui, un thème
 * payant reste verrouillé avec son prix.
 */
export default function DiceThemeShop() {
  const { enabled, loading, themeId, themes, selectTheme, purchaseTheme } = useDiceTheme();
  const crowns = useCrowns();
  const [filter, setFilter] = useState<DiceShopFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => filterShopThemes(themes, filter), [themes, filter]);

  if (!enabled) {
    return (
      <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600" data-testid="dice-shop-disabled">
        Les thèmes de dés ne sont pas encore disponibles.
      </p>
    );
  }

  async function run(id: string, action: () => Promise<void>): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusyId(null);
    }
  }

  function choose(t: DiceThemeOption): Promise<void> {
    return run(t.id, async () => {
      await selectTheme(t.id);
      toast.success(`Thème « ${t.name.fr} » équipé`);
    });
  }

  function buy(t: DiceThemeOption): Promise<void> {
    const price = t.priceCrowns ?? 0;
    if (!window.confirm(`Acheter le thème « ${t.name.fr} » pour ${formatCrowns(price)} Crowns ?`)) {
      return Promise.resolve();
    }
    return run(t.id, async () => {
      const balance = await purchaseTheme(t.id);
      crowns.applyBalance(balance);
      void crowns.refresh();
      toast.success(`Thème « ${t.name.fr} » acheté et équipé`);
    });
  }

  return (
    <div className="space-y-4" data-testid="dice-theme-shop">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les thèmes">
          {DICE_SHOP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-nuffle-bronze text-white"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
              data-testid={`dice-shop-filter-${f.id}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <CrownsBalance className="text-sm" />
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {loading && themes.length === 0 ? (
        <p className="text-sm text-gray-500">Chargement des thèmes…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="dice-shop-empty">
          Aucun thème dans cette sélection.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const action = shopAction(t, {
              activeThemeId: themeId,
              crownsEnabled: crowns.enabled,
              balance: crowns.balance,
            });
            const busy = busyId === t.id;
            return (
              <li
                key={t.id}
                data-testid={`dice-theme-${t.id}`}
                data-selected={action === "active" ? "true" : "false"}
                className={`flex flex-col rounded-lg border bg-white p-3 ${
                  action === "active" ? "border-nuffle-bronze ring-2 ring-nuffle-bronze/40" : "border-gray-200"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{t.name.fr}</span>
                  {t.owned ? (
                    <span className="text-xs font-medium text-emerald-700">Possédé</span>
                  ) : t.priceCrowns !== null ? (
                    <span className="text-xs font-semibold text-nuffle-bronze">👑 {formatCrowns(t.priceCrowns)}</span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">{t.description.fr}</p>

                <div className="mt-2" aria-label={`Aperçu du thème ${t.name.fr}`}>
                  <DiceThemePreview themeId={t.id} />
                </div>

                <div className="mt-auto pt-3">
                  {action === "active" && (
                    <span className="text-sm font-medium text-nuffle-bronze">✓ Thème actif</span>
                  )}
                  {action === "select" && (
                    <button
                      type="button"
                      onClick={() => void choose(t)}
                      disabled={busyId !== null}
                      className="rounded bg-nuffle-bronze px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Enregistrement…" : "Choisir"}
                    </button>
                  )}
                  {action === "buy" && (
                    <button
                      type="button"
                      onClick={() => void buy(t)}
                      disabled={busyId !== null}
                      data-testid={`dice-theme-buy-${t.id}`}
                      className="rounded bg-[#1B1610] px-3 py-1 text-sm font-semibold text-nuffle-gold ring-1 ring-nuffle-gold/50 disabled:opacity-50"
                    >
                      {busy ? "Achat…" : `Acheter · 👑 ${formatCrowns(t.priceCrowns ?? 0)}`}
                    </button>
                  )}
                  {action === "insufficient" && (
                    <button type="button" disabled className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-500">
                      Solde insuffisant
                    </button>
                  )}
                  {action === "locked" && (
                    <button
                      type="button"
                      disabled
                      className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-500"
                      title="L'achat de thèmes avec des Crowns arrive bientôt"
                    >
                      🔒 Bientôt disponible
                    </button>
                  )}
                  {action === "unavailable" && (
                    <span className="text-sm text-gray-500">Plus en vente</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
