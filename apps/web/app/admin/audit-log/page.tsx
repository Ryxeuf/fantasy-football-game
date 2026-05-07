"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAuditLog,
  type AuditLogEntry,
  type AuditLogPage,
} from "../../lib/auditLog";

const PAGE_SIZE = 50;

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Pretty-print un snapshot JSON serialise. Tolerant : si la chaine
 * n'est pas du JSON valide on l'affiche brute (defensif vs anciens
 * logs eventuels).
 */
function formatSnapshot(raw: string | null): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export default function AdminAuditLogPage() {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [page, setPage] = useState<number>(1);
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<string>("");
  const [pendingEntity, setPendingEntity] = useState<string>("");
  const [pendingUserId, setPendingUserId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLog({
        page,
        limit: PAGE_SIZE,
        action: filterAction || undefined,
        entity: filterEntity || undefined,
        userId: filterUserId || undefined,
      });
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity, filterUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setFilterAction(pendingAction.trim());
    setFilterEntity(pendingEntity.trim());
    setFilterUserId(pendingUserId.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setPendingAction("");
    setPendingEntity("");
    setPendingUserId("");
    setFilterAction("");
    setFilterEntity("");
    setFilterUserId("");
    setPage(1);
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-nuffle-anthracite flex items-center gap-2">
          <span>📜</span> Journal d&apos;audit admin
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Trace immuable des mutations admin (compliance, forensic). Lecture
          seule. Tri par date decroissante.
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white rounded-lg shadow-sm p-4 border border-gray-200"
      >
        <label className="flex flex-col text-sm">
          <span className="text-gray-700 font-medium mb-1">Action</span>
          <input
            type="text"
            value={pendingAction}
            onChange={(e) => setPendingAction(e.target.value)}
            placeholder="user.role.update"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-700 font-medium mb-1">Entite</span>
          <input
            type="text"
            value={pendingEntity}
            onChange={(e) => setPendingEntity(e.target.value)}
            placeholder="User / Match / Team"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-gray-700 font-medium mb-1">User ID admin</span>
          <input
            type="text"
            value={pendingUserId}
            onChange={(e) => setPendingUserId(e.target.value)}
            placeholder="cuid"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:bg-nuffle-bronze transition"
          >
            Filtrer
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
          >
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div className="py-12 text-center text-gray-500">Chargement...</div>
      )}

      {error && !loading && (
        <div className="py-4 px-4 mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
          Erreur : {error}
        </div>
      )}

      {!loading && data && data.entries.length === 0 && (
        <div className="py-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
          Aucune entree pour ces filtres.
        </div>
      )}

      {!loading && data && data.entries.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            {data.total} entree{data.total > 1 ? "s" : ""} (page {data.page} /{" "}
            {totalPages})
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entite</th>
                <th className="px-3 py-2">Cible</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <AuditLogRow
                  key={e.id}
                  entry={e}
                  expanded={expandedId === e.id}
                  onToggle={() =>
                    setExpandedId(expandedId === e.id ? null : e.id)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Precedent
          </button>
          <div className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </div>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function AuditLogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const oldStr = formatSnapshot(entry.oldValue);
  const newStr = formatSnapshot(entry.newValue);
  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">
          {formatTimestamp(entry.createdAt)}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-gray-700">
          {entry.userId ?? <span className="text-gray-400">systeme</span>}
        </td>
        <td className="px-3 py-2">
          <code className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">
            {entry.action}
          </code>
        </td>
        <td className="px-3 py-2 text-gray-700">{entry.entity}</td>
        <td className="px-3 py-2 font-mono text-xs text-gray-600">
          {entry.entityId ?? <span className="text-gray-400">-</span>}
        </td>
        <td className="px-3 py-2 font-mono text-xs text-gray-500">
          {entry.ipAddress ?? "-"}
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={onToggle}
            className="text-xs text-blue-600 hover:underline"
          >
            {expanded ? "Replier" : "Details"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-3 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold text-gray-700 mb-1">
                  Avant (oldValue)
                </div>
                <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-700">
                  {oldStr ?? "(null)"}
                </pre>
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-1">
                  Apres (newValue)
                </div>
                <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-700">
                  {newStr ?? "(null)"}
                </pre>
              </div>
              {entry.userAgent && (
                <div className="md:col-span-2">
                  <div className="font-semibold text-gray-700 mb-1">
                    User-Agent
                  </div>
                  <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap text-gray-500 text-[10px]">
                    {entry.userAgent}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
