"use client";
/**
 * Console admin — liste des coupes.
 *
 * Lit `GET /admin/cups` (filtres serveur, pagination, compteurs globaux,
 * email du créateur) au lieu de `GET /cup?publicOnly=false`, qui chargeait
 * tous les participants de toutes les coupes pour filtrer côté client.
 *
 * Actions par coupe : gérer (fiche complète), voir, valider, bascule de
 * visibilité (`PATCH /cup/:id { isPublic }`, ouvert aux admins) et
 * suppression définitive (`DELETE /cup/:id`).
 *
 * Responsive : cartes sous `md`, tableau au-delà ; filtres empilés sur
 * mobile.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import {
  CUP_STATUS_META,
  StatusBadge,
  VisibilityToggle,
  errorMessage,
  useAdminGate,
} from "../_components/competition-admin";

interface AdminCup {
  id: string;
  name: string;
  description: string | null;
  ruleset: string;
  format: string;
  status: string;
  validated: boolean;
  isPublic: boolean;
  creatorId: string;
  creator: { id: string; coachName: string | null; email: string };
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminCupsResponse {
  cups: AdminCup[];
  counts: {
    total: number;
    status: Record<string, number>;
    public: number;
    private: number;
  };
}

type VisibilityFilter = "" | "public" | "private";

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Tous les statuts" },
  { value: "ouverte", label: "Ouvertes" },
  { value: "en_cours", label: "En cours" },
  { value: "terminee", label: "Terminées" },
  { value: "archivee", label: "Archivées" },
];

const ACTION_BTN =
  "inline-flex items-center justify-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminCupsPage() {
  const isAdmin = useAdminGate();
  const [cups, setCups] = useState<AdminCup[]>([]);
  const [counts, setCounts] = useState<AdminCupsResponse["counts"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Recherche côté serveur : on attend une courte pause de frappe.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (visibilityFilter) params.set("visibility", visibilityFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "100");
      const data = await apiRequest<AdminCupsResponse>(
        `/admin/cups?${params.toString()}`,
      );
      setCups(data.cups ?? []);
      setCounts(data.counts ?? null);
    } catch (e: unknown) {
      setError(errorMessage(e, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, visibilityFilter, debouncedSearch]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const act = useCallback(
    async (cupId: string, action: () => Promise<unknown>, failure: string) => {
      setBusyId(cupId);
      setError(null);
      try {
        await action();
        await load();
      } catch (e: unknown) {
        setError(errorMessage(e, failure));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleToggleVisibility = (cup: AdminCup) =>
    act(
      cup.id,
      () =>
        apiRequest(`/cup/${cup.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isPublic: !cup.isPublic }),
        }),
      "Échec du changement de visibilité",
    );

  const handleValidate = (cup: AdminCup) => {
    if (!confirm(`Valider « ${cup.name} » ? Cela fermera les inscriptions.`)) {
      return;
    }
    act(
      cup.id,
      () =>
        apiRequest(`/cup/${cup.id}/validate`, { method: "POST", body: "{}" }),
      "Échec de la validation",
    );
  };

  const handleDelete = (cup: AdminCup) => {
    if (
      !confirm(
        `Supprimer définitivement « ${cup.name} » ? Inscriptions, rondes et résultats seront perdus. Préférez l'archivage pour garder l'historique.`,
      )
    ) {
      return;
    }
    act(
      cup.id,
      () => apiRequest(`/cup/${cup.id}`, { method: "DELETE" }),
      "Échec de la suppression",
    );
  };

  const hasFilters = !!(statusFilter || visibilityFilter || search);

  const renderActions = (cup: AdminCup) => (
    <>
      <Link
        href={`/admin/cups/${cup.id}`}
        data-testid={`admin-cup-manage-${cup.id}`}
        className={`${ACTION_BTN} bg-blue-50 text-blue-700 hover:bg-blue-100`}
      >
        ⚙️ Gérer
      </Link>
      <Link
        href={`/cups/${cup.id}`}
        className={`${ACTION_BTN} bg-gray-50 text-gray-700 hover:bg-gray-100`}
      >
        👁️ Voir
      </Link>
      {!cup.validated ? (
        <button
          type="button"
          onClick={() => handleValidate(cup)}
          disabled={busyId === cup.id}
          className={`${ACTION_BTN} bg-nuffle-gold/10 text-nuffle-bronze hover:bg-nuffle-gold/20`}
        >
          ✓ Valider
        </button>
      ) : null}
      <button
        type="button"
        data-testid={`admin-cup-delete-${cup.id}`}
        onClick={() => handleDelete(cup)}
        disabled={busyId === cup.id}
        aria-label={`Supprimer ${cup.name}`}
        className={`${ACTION_BTN} bg-red-50 text-red-700 hover:bg-red-100`}
      >
        🗑️<span className="md:hidden xl:inline">Supprimer</span>
      </button>
    </>
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  return (
    <div data-testid="admin-cups-page" className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🏆 Coupes
          </h1>
          <p className="text-sm text-gray-600">
            Toutes les coupes, publiques comme privées : statut, visibilité,
            édition et suppression.
          </p>
        </div>
        <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200 self-start sm:self-auto">
          {cups.length} coupe{cups.length !== 1 ? "s" : ""}
          {counts && cups.length !== counts.total ? ` / ${counts.total}` : ""}
        </div>
      </div>

      {/* Compteurs */}
      {counts ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total",
              value: counts.total,
              tone: "text-nuffle-anthracite",
            },
            {
              label: "Ouvertes",
              value: counts.status.ouverte ?? 0,
              tone: "text-green-600",
            },
            { label: "Publiques", value: counts.public, tone: "text-blue-600" },
            { label: "Privées", value: counts.private, tone: "text-gray-700" },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4"
            >
              <div className="text-xs sm:text-sm text-gray-600">{c.label}</div>
              <div className={`text-2xl sm:text-3xl font-bold ${c.tone}`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          ⚠️ {error}
        </div>
      ) : null}

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_1fr] gap-3">
          <select
            data-testid="admin-cups-status-filter"
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
                {s.value && counts?.status[s.value] !== undefined
                  ? ` (${counts.status[s.value]})`
                  : ""}
              </option>
            ))}
          </select>
          <select
            data-testid="admin-cups-visibility-filter"
            aria-label="Filtrer par visibilité"
            value={visibilityFilter}
            onChange={(e) =>
              setVisibilityFilter(e.target.value as VisibilityFilter)
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
          >
            <option value="">Toutes visibilités</option>
            <option value="public">🌍 Publiques</option>
            <option value="private">🔒 Privées</option>
          </select>
          <input
            data-testid="admin-cups-search"
            type="search"
            placeholder="Rechercher (nom, créateur, email)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
          />
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setVisibilityFilter("");
              setSearch("");
            }}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : cups.length === 0 ? (
        <p
          data-testid="admin-cups-empty"
          className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500"
        >
          Aucune coupe trouvée
        </p>
      ) : (
        <>
          {/* Mobile : cartes */}
          <ul className="md:hidden space-y-3" data-testid="admin-cups-cards">
            {cups.map((cup) => (
              <li
                key={cup.id}
                data-testid={`admin-cup-card-${cup.id}`}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/cups/${cup.id}`}
                      className="font-semibold text-gray-900 hover:underline break-words"
                    >
                      {cup.name}
                    </Link>
                    <div className="text-xs text-gray-500 break-all">
                      {cup.creator.coachName ?? "—"} · {cup.creator.email}
                    </div>
                  </div>
                  <StatusBadge status={cup.status} meta={CUP_STATUS_META} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span>
                    {cup.participantCount} équipe
                    {cup.participantCount > 1 ? "s" : ""}
                  </span>
                  <span>Créée le {formatDate(cup.createdAt)}</span>
                </div>
                <VisibilityToggle
                  isPublic={cup.isPublic}
                  onToggle={() => handleToggleVisibility(cup)}
                  disabled={busyId === cup.id}
                  testId={`admin-cup-visibility-mobile-${cup.id}`}
                />
                <div className="grid grid-cols-2 gap-2">
                  {renderActions(cup)}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop : tableau */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full" data-testid="admin-cups-table">
                <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
                  <tr>
                    {[
                      "Nom",
                      "Créateur",
                      "Statut",
                      "Visibilité",
                      "Équipes",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cups.map((cup) => (
                    <tr
                      key={cup.id}
                      data-testid={`admin-cup-row-${cup.id}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[16rem]">
                        <Link
                          href={`/admin/cups/${cup.id}`}
                          className="font-medium text-gray-900 hover:underline break-words"
                        >
                          {cup.name}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDate(cup.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[14rem]">
                        <div className="font-medium text-gray-900 truncate">
                          {cup.creator.coachName ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {cup.creator.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={cup.status}
                          meta={CUP_STATUS_META}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <VisibilityToggle
                          isPublic={cup.isPublic}
                          onToggle={() => handleToggleVisibility(cup)}
                          disabled={busyId === cup.id}
                          testId={`admin-cup-visibility-${cup.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {cup.participantCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderActions(cup)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
