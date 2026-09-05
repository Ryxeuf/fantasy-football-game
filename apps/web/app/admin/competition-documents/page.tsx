"use client";
/**
 * Console admin des DOCUMENTS OFFICIELS de competition
 * (`/admin/competition-documents`).
 *
 * Les documents sont deposes par les commissaires depuis leur ligue ou leur
 * coupe. Cette page donne la vue transverse : toutes les competitions
 * confondues, filtrable par famille, par competition et par recherche, avec
 * correction du libelle et purge — la contrepartie du droit accorde aux
 * commissaires, un fichier publie sous la banniere du site devant rester
 * moderable.
 *
 * Gate cote UI via `/auth/me` (redirect si non-admin) ; la verite reste le
 * middleware `adminOnly` cote serveur.
 */

import { useCallback, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";
import {
  formatDocumentSize,
  type CompetitionDocument,
} from "../../lib/competition-documents";

type KindFilter = "all" | "league" | "cup";

interface ListResponse {
  data: { documents: CompetitionDocument[] };
  meta?: { total: number; limit: number; page: number };
}

const PAGE_SIZE = 25;

const KIND_OPTIONS: ReadonlyArray<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "league", label: "Ligues" },
  { value: "cup", label: "Coupes" },
];

async function fetchJSON<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = (await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Lien vers la competition d'origine, selon sa famille. Le cast `Route` est la
 * convention du repo pour les hrefs construits a l'execution (typedRoutes ne
 * peut pas les verifier statiquement).
 */
function competitionHref(doc: CompetitionDocument): Route {
  return (
    doc.competitionKind === "league"
      ? `/leagues/${doc.competitionId}`
      : `/cups/${doc.competitionId}`
  ) as Route;
}

export default function AdminCompetitionDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<CompetitionDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      try {
        const me = (await fetchJSON<{
          user: { id: string; role?: string; roles?: string[] } | null;
        }>("/auth/me")) ?? { user: null };
        const roles = me.user?.roles ?? (me.user?.role ? [me.user.role] : []);
        if (cancelled) return;
        if (!roles.includes("admin")) router.replace("/");
      } catch {
        if (!cancelled) router.replace("/");
      }
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (kind !== "all") params.set("kind", kind);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const json = await fetchJSON<ListResponse>(
        `/admin/competition-documents?${params.toString()}`,
      );
      setDocuments(json.data.documents ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [kind, search, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRename = useCallback(
    async (doc: CompetitionDocument) => {
      const next = window.prompt("Nouveau libellé du document", doc.title);
      if (next === null) return;
      if (!next.trim()) return;
      try {
        setBusyId(doc.id);
        await fetchJSON(`/admin/competition-documents/${doc.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: next.trim() }),
        });
        await reload();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Echec du renommage");
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (doc: CompetitionDocument) => {
      if (
        !confirm(
          `Supprimer définitivement « ${doc.title} » ? Le fichier sera retiré du disque.`,
        )
      ) {
        return;
      }
      try {
        setBusyId(doc.id);
        await fetchJSON(`/admin/competition-documents/${doc.id}`, {
          method: "DELETE",
        });
        await reload();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Echec de la suppression");
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4" data-testid="admin-competition-documents-page">
      <div>
        <h1 className="text-2xl font-bold text-nuffle-anthracite">
          📎 Documents officiels
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Règlements, calendriers et affiches déposés par les commissaires sur
          leurs ligues et leurs coupes. 10 Mo maximum par fichier.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600">
            Compétition
          </span>
          <select
            value={kind}
            data-testid="admin-documents-kind"
            onChange={(e) => {
              setKind(e.target.value as KindFilter);
              setPage(1);
            }}
            className="mt-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block flex-1 min-w-[12rem]">
          <span className="block text-xs font-medium text-gray-600">
            Recherche
          </span>
          <input
            value={search}
            data-testid="admin-documents-search"
            placeholder="Titre, fichier ou nom de compétition"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void reload()}
          className="px-3 py-1.5 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" data-testid="admin-documents-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : documents.length === 0 ? (
        <p
          className="text-sm text-gray-500"
          data-testid="admin-documents-empty"
        >
          Aucun document.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="py-2 pr-3">Document</th>
                <th className="py-2 pr-3">Compétition</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Poids</th>
                <th className="py-2 pr-3">Déposé par</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <tr key={doc.id} data-testid={`admin-document-${doc.id}`}>
                  <td className="py-2 pr-3">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-nuffle-bronze hover:underline"
                    >
                      {doc.title}
                    </a>
                    <div className="text-xs text-gray-500">
                      {doc.originalName}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      href={competitionHref(doc)}
                      className="hover:underline"
                    >
                      {doc.competitionName ?? doc.competitionId}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {doc.competitionKind === "league" ? "Ligue" : "Coupe"}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {doc.mimeType}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {formatDocumentSize(doc.bytes)}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {doc.uploadedBy?.coachName ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">
                    {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === doc.id}
                        onClick={() => void handleRename(doc)}
                        data-testid={`admin-document-rename-${doc.id}`}
                        className="px-2 py-1 rounded border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Renommer
                      </button>
                      <button
                        type="button"
                        disabled={busyId === doc.id}
                        onClick={() => void handleDelete(doc)}
                        data-testid={`admin-document-delete-${doc.id}`}
                        className="px-2 py-1 rounded border border-red-300 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-gray-600">
            Page {page} / {pageCount} · {total} document
            {total > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="px-2 py-1 rounded border border-gray-300 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      ) : null}
    </div>
  );
}
