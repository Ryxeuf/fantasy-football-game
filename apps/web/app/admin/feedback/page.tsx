"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminListFeedback,
  adminUpdateFeedbackStatus,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from "../../lib/feedback";

const STATUS_OPTIONS: Array<{ value: FeedbackStatus; label: string; color: string }> = [
  { value: "new", label: "Nouveau", color: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "read", label: "Lu", color: "bg-blue-100 text-blue-900 border-blue-300" },
  { value: "resolved", label: "Traité", color: "bg-green-100 text-green-900 border-green-300" },
];

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "remark", label: "Remarque" },
  { value: "comment", label: "Commentaire" },
];

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status);
  if (!opt) return null;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-subtitle font-semibold border ${opt.color}`}
    >
      {opt.label}
    </span>
  );
}

function TypeBadge({ type }: { type: FeedbackType }) {
  const opt = TYPE_OPTIONS.find((o) => o.value === type);
  if (!opt) return null;
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-subtitle font-semibold bg-gray-100 text-gray-800 border border-gray-300">
      {opt.label}
    </span>
  );
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminListFeedback({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setFeedbacks(result.feedbacks);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const onChangeStatus = async (id: string, status: FeedbackStatus) => {
    // Optimistic update : on bascule l'UI puis on confirme avec l'API.
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f)),
    );
    try {
      const updated = await adminUpdateFeedbackStatus(id, status);
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? updated : f)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      // Recharger pour resynchroniser en cas d'echec.
      void load();
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-nuffle-anthracite mb-1">
          Feedback
        </h1>
        <p className="text-sm text-gray-600">
          Retours envoyes via la page publique <code>/feedback</code>. Total :{" "}
          <strong>{total}</strong>
        </p>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="filter-status"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Statut
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as FeedbackStatus | "");
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-300"
            >
              <option value="">Tous</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-type"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
            >
              Type
            </label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as FeedbackType | "");
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-300"
            >
              <option value="">Tous</option>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={onSearchSubmit} className="flex items-end gap-2 flex-1 min-w-[200px]">
            <div className="flex-1">
              <label
                htmlFor="filter-search"
                className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1"
              >
                Recherche
              </label>
              <input
                id="filter-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Sujet, message, nom, email..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-nuffle-gold text-nuffle-anthracite font-semibold hover:bg-nuffle-gold/90 transition-colors"
            >
              Rechercher
            </button>
          </form>
        </div>
      </section>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Chargement...</p>
      ) : feedbacks.length === 0 ? (
        <p className="text-gray-500 italic">Aucun feedback trouve avec ces filtres.</p>
      ) : (
        <ul className="space-y-3">
          {feedbacks.map((fb) => (
            <li
              key={fb.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={fb.status} />
                  <TypeBadge type={fb.type} />
                  <span className="text-xs text-gray-500">
                    {formatDate(fb.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = fb.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={active}
                        onClick={() => onChangeStatus(fb.id, opt.value)}
                        aria-label={`Marquer ${fb.subject} comme ${opt.label}`}
                        className={`px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
                          active
                            ? `${opt.color} cursor-not-allowed opacity-70`
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <h3 className="font-subtitle font-semibold text-nuffle-anthracite text-base mb-1">
                {fb.subject}
              </h3>
              <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
                {fb.message}
              </p>
              <dl className="text-xs text-gray-500 grid grid-cols-1 sm:grid-cols-3 gap-1">
                {fb.name && (
                  <div>
                    <dt className="inline font-semibold">Nom : </dt>
                    <dd className="inline">{fb.name}</dd>
                  </div>
                )}
                {fb.email && (
                  <div>
                    <dt className="inline font-semibold">Email : </dt>
                    <dd className="inline">
                      <a
                        href={`mailto:${encodeURIComponent(fb.email)}`}
                        className="text-nuffle-bronze hover:underline"
                      >
                        {fb.email}
                      </a>
                    </dd>
                  </div>
                )}
                {fb.pageUrl && (
                  <div className="sm:col-span-3 truncate">
                    <dt className="inline font-semibold">URL : </dt>
                    <dd className="inline">{fb.pageUrl}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2" aria-label="Pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50"
          >
            Precedent
          </button>
          <span className="text-sm text-gray-700">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-50"
          >
            Suivant
          </button>
        </nav>
      )}
    </div>
  );
}
