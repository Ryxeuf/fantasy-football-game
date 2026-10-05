"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminListCoachCosmetics, type CoachCosmeticsPage } from "../../lib/admin-dice-themes";
import { BlockDieIcon } from "../../components/dice/BlockDieIcon";
import { getDiceThemeRenderer } from "../../components/dice/themes/registry";
import { formatCrowns } from "../../lib/crowns";
import { dynamicRoute } from "../../lib/typed-route";

const PAGE_SIZE = 25;

/**
 * Admin — Couronnes & thèmes de dés des coachs : solde, thèmes acquis et
 * thème choisi de chaque compte, recherche par e-mail ou nom de coach.
 */
export default function AdminCoachCosmeticsPage() {
  const [data, setData] = useState<CoachCosmeticsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminListCoachCosmetics({ search: query || undefined, page, limit: PAGE_SIZE }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6" data-testid="admin-coach-cosmetics">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">👑 Couronnes &amp; thèmes des coachs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Solde de Crowns, thèmes de dés acquis (achats, cadeaux) et thème choisi par chaque coach.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(search.trim());
        }}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="E-mail ou nom de coach…"
          className="min-w-[16rem] flex-1 rounded border px-3 py-2 text-sm"
          data-testid="coach-cosmetics-search"
        />
        <button type="submit" className="rounded bg-nuffle-bronze px-4 py-2 text-sm font-medium text-white">
          Rechercher
        </button>
      </form>

      {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-nuffle-gold" />
        </div>
      ) : data ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5 text-left">
              <tr>
                <th className="px-3 py-2">Coach</th>
                <th className="px-3 py-2">Crowns</th>
                <th className="px-3 py-2">Thèmes acquis</th>
                <th className="px-3 py-2">Thème choisi</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((u) => (
                <tr key={u.id} data-testid={`coach-cosmetics-row-${u.id}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{u.coachName}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2 font-mono">👑 {formatCrowns(u.crowns)}</td>
                  <td className="px-3 py-2">{u.acquiredThemes}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <BlockDieIcon face="pow" theme={getDiceThemeRenderer(u.diceTheme)} px={24} loading="lazy" className="h-6 w-6" />
                      <span className="font-mono text-xs">{u.diceTheme ?? "— (défaut)"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={dynamicRoute(`/admin/coach-cosmetics/${u.id}`)}
                      className="rounded bg-nuffle-bronze px-3 py-1 text-xs font-medium text-white"
                      data-testid={`coach-cosmetics-open-${u.id}`}
                    >
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Aucun coach.</p>}
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <span className="text-gray-500">
              {data.total} coach{data.total > 1 ? "s" : ""} — page {data.page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                ←
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                →
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
