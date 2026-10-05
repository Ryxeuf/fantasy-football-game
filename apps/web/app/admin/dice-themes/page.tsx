"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListDiceThemes,
  adminResetDiceTheme,
  adminUpdateDiceTheme,
  type AdminDiceTheme,
  type DiceThemePatch,
} from "../../lib/admin-dice-themes";
import { DiceThemePreview } from "../../components/dice/DiceThemePreview";
import { formatCrowns } from "../../lib/crowns";
import DiceThemeEditModal from "./_components/DiceThemeEditModal";
import { summarizeDiceThemes, filterAdminDiceThemes, type AdminDiceThemeFilter } from "./summary";

const FILTERS: ReadonlyArray<{ id: AdminDiceThemeFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "classic", label: "Classiques" },
  { id: "team", label: "Équipes" },
  { id: "on-sale", label: "En vente" },
  { id: "off-sale", label: "Retirés" },
];

/**
 * Admin — catalogue des thèmes de dés : aperçu complet de chaque thème
 * (faces PNG + dés numériques), prix, mise en vente, ordre, libellés, et
 * statistiques (possesseurs, achats, cadeaux, coachs qui l'ont choisi,
 * recette). Les visuels sont un contrat de code (PNG + skin `@bb/ui`).
 */
export default function AdminDiceThemesPage() {
  const [themes, setThemes] = useState<AdminDiceTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AdminDiceThemeFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminDiceTheme | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setThemes(await adminListDiceThemes());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeDiceThemes(themes), [themes]);
  const visible = useMemo(() => filterAdminDiceThemes(themes, filter, search), [themes, filter, search]);

  function replace(updated: AdminDiceTheme) {
    setThemes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function save(patch: DiceThemePatch) {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      replace(await adminUpdateDiceTheme(editing.id, patch));
      setEditing(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSale(t: AdminDiceTheme) {
    setError(null);
    try {
      replace(await adminUpdateDiceTheme(t.id, { enabled: !t.enabled }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function reset(t: AdminDiceTheme) {
    if (!window.confirm(`Réinitialiser « ${t.name.fr} » depuis le catalogue du code ?`)) return;
    setError(null);
    try {
      replace(await adminResetDiceTheme(t.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6" data-testid="admin-dice-themes">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">🎲 Thèmes de dés</h1>
        <p className="mt-1 text-sm text-gray-600">
          Catalogue de la boutique : le dé original (gratuit, par défaut), ses déclinaisons et les thèmes
          d&apos;équipe. Les achats se font en Crowns (flag <code>crowns</code>), la boutique est gatée par{" "}
          <code>dice_themes</code>.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="admin-dice-themes-summary">
        {[
          ["Thèmes", summary.total],
          ["En vente", summary.onSale],
          ["Acquisitions", summary.owners],
          ["Choisis", summary.selectedBy],
          ["Recette (Crowns)", formatCrowns(summary.revenueCrowns)],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className="text-xl font-bold text-nuffle-anthracite">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.id ? "bg-nuffle-bronze text-white" : "bg-white ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
            data-testid={`admin-dice-filter-${f.id}`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          placeholder="Rechercher (nom, id)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded border px-3 py-1 text-sm"
          data-testid="admin-dice-search"
        />
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-nuffle-gold" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5 text-left">
              <tr>
                <th className="px-3 py-2">Thème</th>
                <th className="px-3 py-2">Aperçu</th>
                <th className="px-3 py-2">Prix</th>
                <th className="px-3 py-2">Vente</th>
                <th className="px-3 py-2">Statistiques</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((t) => (
                <tr key={t.id} data-testid={`admin-dice-theme-${t.id}`} className={t.enabled ? "" : "bg-gray-50 opacity-80"}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-semibold">{t.name.fr}</div>
                    <div className="text-xs text-gray-500">{t.name.en}</div>
                    <div className="mt-1 font-mono text-xs text-gray-400">{t.id}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded bg-gray-100 px-1.5">{t.collection === "classic" ? "Classique" : "Équipe"}</span>
                      {t.isDefault && <span className="rounded bg-amber-100 px-1.5 text-amber-800">Défaut</span>}
                      {!t.inDatabase && <span className="rounded bg-blue-50 px-1.5 text-blue-700" title="Pas encore de ligne en base : le catalogue du code est servi">Compilé</span>}
                      <span className="rounded bg-gray-100 px-1.5">ordre {t.sortOrder}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <DiceThemePreview themeId={t.id} withNumberDie />
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {t.priceCrowns === null ? "Gratuit" : `👑 ${formatCrowns(t.priceCrowns)}`}
                    {t.priceCrowns !== t.compiled.priceCrowns && (
                      <div className="text-[11px] text-gray-400">
                        code : {t.compiled.priceCrowns === null ? "gratuit" : formatCrowns(t.compiled.priceCrowns)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => void toggleSale(t)}
                      disabled={t.isDefault}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.enabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
                      } disabled:cursor-not-allowed`}
                      data-testid={`admin-dice-toggle-${t.id}`}
                      title={t.isDefault ? "Le thème par défaut reste en service" : "Mettre en vente / retirer"}
                    >
                      {t.enabled ? "En vente" : "Retiré"}
                    </button>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-700">
                    <div>{t.stats.owners} acquis ({t.stats.purchases} achats, {t.stats.gifts} cadeaux)</div>
                    <div>{t.stats.selectedBy} coach(s) l&apos;ont choisi</div>
                    <div>Recette : {formatCrowns(t.stats.revenueCrowns)} Crowns</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => setEditing(t)} className="rounded bg-nuffle-bronze px-2 py-1 text-xs text-white" data-testid={`admin-dice-edit-${t.id}`}>
                        Modifier
                      </button>
                      <button type="button" onClick={() => void reset(t)} className="rounded bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200">
                        Réinitialiser
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Aucun thème.</p>}
        </div>
      )}

      <DiceThemeEditModal theme={editing} saving={saving} onClose={() => setEditing(null)} onSave={save} />
    </div>
  );
}
