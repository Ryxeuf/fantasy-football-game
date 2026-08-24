"use client";
/**
 * Admin — liste des règlements de tournoi (« rules packs »).
 * Archivés inclus (badge), entrées du registre statique non seedées
 * affichées avec le bouton « Matérialiser en base » (POST /seed,
 * create-only) pour devenir éditables. Archiver/désarchiver inline.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getJSON,
  sendJSON,
  type TournamentRulesetSummary,
} from "./api";

export default function AdminTournamentRulesetsPage() {
  const [items, setItems] = useState<TournamentRulesetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getJSON<{
        tournamentRulesets: TournamentRulesetSummary[];
      }>("/admin/tournament-rulesets");
      setItems(data.tournamentRulesets ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Garde client canonique des pages admin (le middleware edge 404 déjà).
      const me = await getJSON<{
        user?: { roles?: string[]; role?: string };
      }>("/auth/me").catch(() => null);
      const roles = Array.isArray(me?.user?.roles)
        ? me.user.roles
        : me?.user?.role
          ? [me.user.role]
          : undefined;
      if (!roles || !roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      await load();
    })();
  }, [load]);

  const toggleArchive = async (item: TournamentRulesetSummary) => {
    if (!item.id) return;
    setBusyId(item.id);
    setNotice(null);
    try {
      await sendJSON(
        "POST",
        `/admin/tournament-rulesets/${item.id}/${item.archived ? "unarchive" : "archive"}`,
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const seed = async () => {
    setSeeding(true);
    setNotice(null);
    try {
      const res = await sendJSON<{ created: number; skipped: number }>(
        "POST",
        "/admin/tournament-rulesets/seed",
      );
      setNotice(
        `Seed : ${res.created} créé(s), ${res.skipped} déjà en base (jamais réécrits).`,
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  const hasStaticOnly = items.some((i) => i.source === "static");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🏆 Règlements de tournoi
          </h1>
          <p className="text-sm text-gray-600">
            Packs de règles imposés à la création d&apos;équipe (budgets,
            SPP, Star Players). Archiver retire un règlement des nouvelles
            sélections sans toucher aux équipes existantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasStaticOnly ? (
            <button
              onClick={seed}
              disabled={seeding}
              data-testid="pack-seed-button"
              className="px-4 py-2.5 border border-nuffle-gold text-nuffle-bronze rounded-lg font-medium hover:bg-nuffle-gold/10 transition-all disabled:opacity-50"
            >
              {seeding ? "Seed…" : "Matérialiser les packs du code"}
            </button>
          ) : null}
          <Link
            href="/admin/data/tournament-rulesets/new"
            data-testid="pack-create-link"
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200"
          >
            + Nouveau règlement
          </Link>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="text-green-700 text-sm p-3 bg-green-50 border border-green-200 rounded">
          {notice}
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full" data-testid="pack-list-table">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                {["Nom", "Slug", "Version", "Édition", "Format", "État", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun règlement de tournoi trouvé
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.slug}
                    className="hover:bg-gray-50 transition-colors duration-150"
                    data-testid={`pack-row-${item.slug}`}
                  >
                    <td className="px-6 py-4 font-medium text-nuffle-anthracite">
                      {item.nameFr}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {item.slug}
                    </td>
                    <td className="px-6 py-4 text-sm">{item.version}</td>
                    <td className="px-6 py-4 text-sm">
                      {item.edition === "season_2" ? "Saison 2" : "Saison 3"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.format === "sevens" ? "Sevens" : "BB11"}
                    </td>
                    <td className="px-6 py-4">
                      {item.source === "static" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Code (non seedé)
                        </span>
                      ) : item.archived ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Archivé
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-3 whitespace-nowrap">
                      {item.id ? (
                        <>
                          <Link
                            href={`/admin/data/tournament-rulesets/${item.id}/edit`}
                            className="text-nuffle-bronze hover:underline"
                            data-testid={`pack-edit-${item.slug}`}
                          >
                            Modifier
                          </Link>
                          <button
                            onClick={() => toggleArchive(item)}
                            disabled={busyId === item.id}
                            className="text-gray-600 hover:underline disabled:opacity-50"
                            data-testid={`pack-archive-toggle-${item.slug}`}
                          >
                            {item.archived ? "Désarchiver" : "Archiver"}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Matérialiser pour éditer
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
