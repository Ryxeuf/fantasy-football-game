"use client";
/**
 * Console admin — feuilles de match (ligues ET coupes).
 *
 * Liste `GET /admin/match-sheets` (filtres serveur : statut, famille,
 * recherche équipe/compétition). Pour chaque feuille :
 *   - ouvrir l'éditeur standard, où l'admin a les droits du commissaire
 *     (saisie, corrections, après-match) — sauf sur un match qu'il joue ;
 *   - valider / invalider directement (mêmes routes que le commissaire) ;
 *   - supprimer une feuille non validée (remise à zéro de la rencontre) ;
 *   - liens vers les fiches admin des deux équipes et de la compétition.
 *
 * Responsive : cartes sous `lg`, tableau au-delà.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "../../lib/api-client";
import {
  StatusBadge,
  errorMessage,
  useAdminGate,
} from "../_components/competition-admin";
import {
  SHEET_STATUS_META,
  competitionAdminPath,
  roundLabel,
  sheetActions,
  sheetApiPath,
  sheetEditorPath,
  type AdminMatchSheet,
  type AdminMatchSheetTeam,
} from "./sheet-links";

interface ListResponse {
  sheets: AdminMatchSheet[];
  counts: { total: number; status: Record<string, number> };
}

const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "Tous les statuts" },
  { value: "both_submitted", label: "À valider" },
  { value: "draft", label: "Brouillons" },
  { value: "submitted_home", label: "Soumises (domicile)" },
  { value: "submitted_away", label: "Soumises (extérieur)" },
  { value: "validated", label: "Validées" },
  { value: "invalidated", label: "Invalidées" },
];

const BTN =
  "inline-flex items-center justify-center gap-1 min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamLink({
  team,
  align = "left",
}: {
  team: AdminMatchSheetTeam | null;
  align?: "left" | "right";
}) {
  if (!team) {
    return <span className="text-sm italic text-gray-400">Exempt</span>;
  }
  return (
    <Link
      href={`/admin/teams/${team.teamId}`}
      data-testid={`admin-sheet-team-${team.teamId}`}
      className={`block min-w-0 hover:underline ${align === "right" ? "text-right" : ""}`}
    >
      <span className="block text-sm font-medium text-blue-700 break-words">
        {team.teamName}
      </span>
      {team.coachName ? (
        <span className="block text-xs text-gray-500 truncate">
          {team.coachName}
        </span>
      ) : null}
    </Link>
  );
}

export default function AdminMatchSheetsPage() {
  const isAdmin = useAdminGate();
  const [sheets, setSheets] = useState<AdminMatchSheet[]>([]);
  const [counts, setCounts] = useState<ListResponse["counts"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
      if (kindFilter) params.set("kind", kindFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "100");
      const data = await apiRequest<ListResponse>(
        `/admin/match-sheets?${params.toString()}`,
      );
      setSheets(data.sheets ?? []);
      setCounts(data.counts ?? null);
    } catch (e: unknown) {
      setError(errorMessage(e, "Erreur de chargement"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, kindFilter, debouncedSearch]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const act = useCallback(
    async (sheet: AdminMatchSheet, action: () => Promise<unknown>, ok: string) => {
      setBusyId(sheet.id);
      setError(null);
      setNotice(null);
      try {
        await action();
        setNotice(ok);
        await load();
      } catch (e: unknown) {
        setError(errorMessage(e, "Action impossible"));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleValidate = (sheet: AdminMatchSheet) => {
    const warning =
      sheet.status === "both_submitted"
        ? ""
        : "\n\n⚠️ Les deux coachs n'ont pas soumis la feuille.";
    if (
      !confirm(
        `Valider la feuille ${sheet.home?.teamName ?? "?"} – ${sheet.away?.teamName ?? "?"} (${sheet.scoreHome}-${sheet.scoreAway}) ? Score, classement et effets d'après-match seront appliqués.${warning}`,
      )
    ) {
      return;
    }
    act(
      sheet,
      () => apiRequest(`${sheetApiPath(sheet)}/validate`, { method: "POST" }),
      "Feuille validée",
    );
  };

  const handleInvalidate = (sheet: AdminMatchSheet) => {
    const reason = prompt(
      "Invalider la feuille : ses effets (score, classement, PSP, blessures, trésorerie) seront reversés.\nMotif (optionnel) :",
    );
    if (reason === null) return;
    act(
      sheet,
      () =>
        apiRequest(`${sheetApiPath(sheet)}/invalidate`, {
          method: "POST",
          body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      "Feuille invalidée",
    );
  };

  const handleDelete = (sheet: AdminMatchSheet) => {
    if (
      !confirm(
        "Supprimer cette feuille et tous ses évènements ? La rencontre repartira sans feuille.",
      )
    ) {
      return;
    }
    act(
      sheet,
      () => apiRequest(`/admin/match-sheets/${sheet.id}`, { method: "DELETE" }),
      "Feuille supprimée",
    );
  };

  const renderActions = (sheet: AdminMatchSheet) => {
    const a = sheetActions(sheet.status);
    const busy = busyId === sheet.id;
    return (
      <>
        <Link
          href={sheetEditorPath(sheet)}
          data-testid={`admin-sheet-open-${sheet.id}`}
          className={`${BTN} bg-blue-50 text-blue-700 hover:bg-blue-100`}
        >
          📝 Ouvrir
        </Link>
        {a.canValidate ? (
          <button
            type="button"
            data-testid={`admin-sheet-validate-${sheet.id}`}
            onClick={() => handleValidate(sheet)}
            disabled={busy}
            className={`${BTN} bg-green-50 text-green-800 hover:bg-green-100`}
          >
            ✓ Valider
          </button>
        ) : null}
        {a.canInvalidate ? (
          <button
            type="button"
            data-testid={`admin-sheet-invalidate-${sheet.id}`}
            onClick={() => handleInvalidate(sheet)}
            disabled={busy}
            className={`${BTN} bg-amber-50 text-amber-800 hover:bg-amber-100`}
          >
            ↩ Invalider
          </button>
        ) : null}
        {a.canDelete ? (
          <button
            type="button"
            data-testid={`admin-sheet-delete-${sheet.id}`}
            onClick={() => handleDelete(sheet)}
            disabled={busy}
            aria-label="Supprimer la feuille"
            className={`${BTN} bg-red-50 text-red-700 hover:bg-red-100`}
          >
            🗑️<span className="lg:hidden 2xl:inline">Supprimer</span>
          </button>
        ) : null}
      </>
    );
  };

  const competitionLink = (sheet: AdminMatchSheet) => (
    <Link
      href={competitionAdminPath(sheet)}
      data-testid={`admin-sheet-competition-${sheet.id}`}
      className="text-sm font-medium text-gray-900 hover:underline break-words"
    >
      {sheet.kind === "cup" ? "🏆" : "🏅"} {sheet.competition.name}
    </Link>
  );

  const score = (sheet: AdminMatchSheet) => (
    <span className="font-mono text-lg font-bold text-nuffle-anthracite whitespace-nowrap">
      {sheet.scoreHome} – {sheet.scoreAway}
    </span>
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-nuffle-gold" />
      </div>
    );
  }

  const tiles = counts
    ? [
        { label: "Total", value: counts.total, tone: "text-nuffle-anthracite" },
        {
          label: "À valider",
          value: counts.status.both_submitted ?? 0,
          tone: "text-amber-600",
          filter: "both_submitted",
        },
        {
          label: "Validées",
          value: counts.status.validated ?? 0,
          tone: "text-green-600",
          filter: "validated",
        },
        {
          label: "En saisie",
          value:
            (counts.status.draft ?? 0) +
            (counts.status.submitted_home ?? 0) +
            (counts.status.submitted_away ?? 0),
          tone: "text-gray-700",
        },
      ]
    : [];

  return (
    <div data-testid="admin-match-sheets-page" className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          📋 Feuilles de match
        </h1>
        <p className="text-sm text-gray-600">
          Toutes les feuilles des ligues et des coupes. « Ouvrir » donne
          l&apos;éditeur complet avec les droits du commissaire.
        </p>
      </div>

      {tiles.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((t) => {
            const content = (
              <>
                <div className="text-xs sm:text-sm text-gray-600">{t.label}</div>
                <div className={`text-2xl sm:text-3xl font-bold ${t.tone}`}>
                  {t.value}
                </div>
              </>
            );
            return t.filter ? (
              <button
                key={t.label}
                type="button"
                onClick={() => setStatusFilter(t.filter!)}
                className="text-left bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 hover:border-nuffle-gold transition-colors"
              >
                {content}
              </button>
            ) : (
              <div
                key={t.label}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4"
              >
                {content}
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
        >
          ⚠️ {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm"
        >
          ✓ {notice}
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_1fr] gap-3">
          <select
            data-testid="admin-sheets-status-filter"
            aria-label="Filtrer par statut"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
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
            data-testid="admin-sheets-kind-filter"
            aria-label="Filtrer par compétition"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
          >
            <option value="">Ligues et coupes</option>
            <option value="league">🏅 Ligues</option>
            <option value="cup">🏆 Coupes</option>
          </select>
          <input
            data-testid="admin-sheets-search"
            type="search"
            placeholder="Rechercher (équipe, ligue, coupe)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : sheets.length === 0 ? (
        <p
          data-testid="admin-sheets-empty"
          className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500"
        >
          Aucune feuille de match trouvée
        </p>
      ) : (
        <>
          {/* Mobile / tablette : cartes */}
          <ul className="lg:hidden space-y-3">
            {sheets.map((sheet) => (
              <li
                key={sheet.id}
                data-testid={`admin-sheet-card-${sheet.id}`}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {competitionLink(sheet)}
                    <div className="text-xs text-gray-500">
                      {roundLabel(sheet)}
                    </div>
                  </div>
                  <StatusBadge status={sheet.status} meta={SHEET_STATUS_META} />
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <TeamLink team={sheet.home} />
                  {score(sheet)}
                  <TeamLink team={sheet.away} align="right" />
                </div>
                <div className="text-xs text-gray-500">
                  {sheet.eventsCount} évènement{sheet.eventsCount > 1 ? "s" : ""}{" "}
                  · maj {formatDate(sheet.updatedAt)}
                  {sheet.forfeitSide ? " · forfait" : ""}
                </div>
                <div className="grid grid-cols-2 gap-2">{renderActions(sheet)}</div>
              </li>
            ))}
          </ul>

          {/* Desktop : tableau */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full" data-testid="admin-sheets-table">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
                <tr>
                  {["Compétition", "Rencontre", "Statut", "Actions"].map((h) => (
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
                {sheets.map((sheet) => (
                  <tr
                    key={sheet.id}
                    data-testid={`admin-sheet-row-${sheet.id}`}
                    className="hover:bg-gray-50 align-middle"
                  >
                    <td className="px-4 py-3 max-w-[14rem]">
                      {competitionLink(sheet)}
                      <div className="text-xs text-gray-500">
                        {roundLabel(sheet)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 min-w-[18rem]">
                        <TeamLink team={sheet.home} align="right" />
                        {score(sheet)}
                        <TeamLink team={sheet.away} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sheet.status} meta={SHEET_STATUS_META} />
                      <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                        {sheet.eventsCount} évt · {formatDate(sheet.updatedAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">{renderActions(sheet)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
