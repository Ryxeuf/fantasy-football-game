"use client";
/**
 * Recherche transversale du journal d'équipe (admin).
 *
 * `/me/teams/[id]/journal` répond « qu'est-il arrivé à CETTE équipe ». Cette
 * page-ci répond à l'inverse : « qui a fait ça, où, et combien de fois »,
 * quand on ne sait pas encore quelle équipe est en cause.
 *
 * Trois vues sur le MÊME périmètre filtré :
 *  - le tableau, parcourable ligne à ligne ;
 *  - les agrégats, pour repérer une anomalie sans tout dérouler ;
 *  - l'export CSV / NDJSON, pour analyser ailleurs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  downloadTeamJournalExport,
  fetchTeamJournal,
  fetchTeamJournalFacets,
  fetchTeamJournalStats,
  type AuditSortOrder,
  type JournalEvent,
  type JournalFacets,
  type JournalFilters,
  type JournalPage,
  type JournalStats,
} from "../../lib/teamJournal";

const PAGE_SIZE = 50;

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-blue-100 text-blue-800",
  admin: "bg-purple-100 text-purple-800",
  commissioner: "bg-amber-100 text-amber-800",
  system: "bg-gray-200 text-gray-700",
  anonymous: "bg-gray-200 text-gray-700",
};

const SORT_LABELS: ReadonlyArray<{ value: AuditSortOrder; label: string }> = [
  { value: "recent", label: "Plus récent" },
  { value: "oldest", label: "Plus ancien" },
  { value: "treasury-impact", label: "Impact trésorerie" },
  { value: "team-value-impact", label: "Impact VE" },
];

function kpo(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `${Math.round(amount / 1000).toLocaleString("fr-FR")}k`;
}

function deltaCell(delta: number | null | undefined): {
  text: string;
  className: string;
} {
  if (!delta) return { text: "—", className: "text-gray-400" };
  const sign = delta > 0 ? "+" : "-";
  return {
    text: `${sign}${Math.round(Math.abs(delta) / 1000).toLocaleString("fr-FR")}k`,
    className: delta > 0 ? "text-green-700" : "text-red-700",
  };
}

function timestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const EMPTY_FILTERS: JournalFilters = {};

export default function AdminTeamJournalPage() {
  // `draft` = ce que l'admin saisit ; `applied` = ce qui est réellement
  // interrogé. Sans cette séparation, chaque frappe déclencherait une
  // requête sur une table qui peut être volumineuse.
  const [draft, setDraft] = useState<JournalFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<JournalFilters>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [order, setOrder] = useState<AuditSortOrder>("recent");

  const [page, setPage] = useState<JournalPage | null>(null);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [facets, setFacets] = useState<JournalFacets | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Évite qu'une réponse lente d'une recherche abandonnée écrase le résultat
  // d'une recherche plus récente.
  const requestSeq = useRef(0);

  const query = useMemo<JournalFilters>(
    () => ({ ...applied, offset, order, limit: PAGE_SIZE }),
    [applied, offset, order],
  );

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTeamJournal(query);
      if (seq === requestSeq.current) setPage(result);
    } catch (e: unknown) {
      if (seq === requestSeq.current) {
        setError(e instanceof Error ? e.message : "Recherche impossible");
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchTeamJournalFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  // Les agrégats ne sont chargés que si le panneau est ouvert : trois
  // `groupBy` ne se paient pas quand personne ne les regarde.
  useEffect(() => {
    if (!showStats) return;
    let cancelled = false;
    fetchTeamJournalStats(applied)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showStats, applied]);

  const applyFilters = () => {
    setOffset(0);
    setApplied(draft);
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setOffset(0);
  };

  const patch = (change: Partial<JournalFilters>) =>
    setDraft((prev) => ({ ...prev, ...change }));

  const runExport = async (format: "csv" | "ndjson") => {
    setExporting(true);
    setNotice(null);
    setError(null);
    try {
      const { filename, returned, total } = await downloadTeamJournalExport(
        { ...applied, order },
        format,
      );
      setNotice(
        returned < total
          ? `${filename} — ${returned.toLocaleString("fr-FR")} étapes exportées sur ${total.toLocaleString("fr-FR")} : resserrez les filtres pour tout obtenir.`
          : `${filename} — ${returned.toLocaleString("fr-FR")} étapes exportées.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  };

  const total = page?.total ?? 0;

  return (
    <div data-testid="admin-team-journal-page" className="space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          📜 Journal des équipes
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Recherche transversale sur toutes les équipes : qui a modifié quoi,
          avec quel impact sur la trésorerie et la VE. Les filtres s&apos;appliquent
          à l&apos;identique au tableau, aux agrégats et à l&apos;export.
        </p>
      </header>

      <section
        data-testid="journal-search-form"
        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Recherche libre">
            <input
              data-testid="filter-q"
              type="text"
              value={draft.q ?? ""}
              onChange={(e) => patch({ q: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="action, coach, note, route…"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Équipe (nom)">
            <input
              data-testid="filter-team"
              type="text"
              value={draft.teamSearch ?? ""}
              onChange={(e) => patch({ teamSearch: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Action">
            <select
              data-testid="filter-action"
              value={draft.action ?? ""}
              onChange={(e) => patch({ action: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Toutes</option>
              {(facets?.actions ?? []).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.value} ({a.count})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rôle de l'auteur">
            <select
              data-testid="filter-role"
              value={draft.actorRole ?? ""}
              onChange={(e) => patch({ actorRole: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Tous</option>
              {(facets?.actorRoles ?? []).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value} ({r.count})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Du">
            <input
              data-testid="filter-since"
              type="date"
              value={draft.since ?? ""}
              onChange={(e) => patch({ since: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Au">
            <input
              data-testid="filter-until"
              type="date"
              value={draft.until ?? ""}
              onChange={(e) => patch({ until: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Δ trésorerie ≥ (kpo)">
            <input
              data-testid="filter-treasury-threshold"
              type="number"
              min={0}
              value={draft.minTreasuryDeltaK ?? ""}
              onChange={(e) =>
                patch({
                  minTreasuryDeltaK: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Opération (correlationId)">
            <input
              data-testid="filter-correlation"
              type="text"
              value={draft.correlationId ?? ""}
              onChange={(e) => patch({ correlationId: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
          <Check
            testId="filter-economic"
            checked={draft.onlyEconomic ?? false}
            onChange={(v) => patch({ onlyEconomic: v })}
            label="Or / VE uniquement"
          />
          <Check
            testId="filter-failed"
            checked={draft.onlyFailed ?? false}
            onChange={(v) => patch({ onlyFailed: v })}
            label="Échecs uniquement"
          />
          <Check
            testId="filter-impersonated"
            checked={draft.onlyImpersonated ?? false}
            onChange={(v) => patch({ onlyImpersonated: v })}
            label="En impersonation"
          />
          <Check
            testId="filter-deep"
            checked={draft.deep ?? false}
            onChange={(v) => patch({ deep: v })}
            label="Chercher aussi dans les charges utiles"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="journal-apply"
            onClick={applyFilters}
            className="rounded bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Rechercher
          </button>
          <button
            type="button"
            data-testid="journal-reset"
            onClick={resetFilters}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Réinitialiser
          </button>
          <label className="ml-2 flex items-center gap-2 text-sm text-gray-700">
            Tri
            <select
              data-testid="journal-order"
              value={order}
              onChange={(e) => {
                setOffset(0);
                setOrder(e.target.value as AuditSortOrder);
              }}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              {SORT_LABELS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="journal-toggle-stats"
              onClick={() => setShowStats((v) => !v)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              {showStats ? "Masquer" : "Voir"} les agrégats
            </button>
            <button
              type="button"
              data-testid="journal-export-csv"
              disabled={exporting}
              onClick={() => runExport("csv")}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              data-testid="journal-export-ndjson"
              disabled={exporting}
              onClick={() => runExport("ndjson")}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Export NDJSON
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div
          data-testid="journal-notice"
          className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {showStats ? <StatsPanel stats={stats} /> : null}

      <div className="text-sm text-gray-600">
        {loading
          ? "Recherche…"
          : `${total.toLocaleString("fr-FR")} étape${total > 1 ? "s" : ""} correspondante${total > 1 ? "s" : ""}`}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Auteur</th>
              <th className="px-3 py-2 text-right">Δ or</th>
              <th className="px-3 py-2 text-right">Or après</th>
              <th className="px-3 py-2 text-right">Δ VE</th>
              <th className="px-3 py-2 text-right">VE après</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {(page?.entries ?? []).map((entry) => (
              <EventRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
                onDrillCorrelation={() => {
                  setDraft({ correlationId: entry.correlationId });
                  setApplied({ correlationId: entry.correlationId });
                  setOffset(0);
                }}
              />
            ))}
            {!loading && (page?.entries.length ?? 0) === 0 ? (
              <tr>
                <td
                  data-testid="journal-empty"
                  colSpan={8}
                  className="px-3 py-8 text-center text-gray-500"
                >
                  Aucune étape ne correspond à ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            data-testid="journal-prev"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} sur{" "}
            {total.toLocaleString("fr-FR")}
          </span>
          <button
            type="button"
            data-testid="journal-next"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Check({
  testId,
  checked,
  onChange,
  label,
}: {
  testId: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input
        data-testid={testId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function StatsPanel({ stats }: { stats: JournalStats | null }) {
  if (!stats) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Chargement des agrégats…
      </div>
    );
  }
  const treasury = deltaCell(stats.netTreasuryDelta);
  const teamValue = deltaCell(stats.netTeamValueDelta);
  return (
    <div
      data-testid="journal-stats"
      className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 lg:grid-cols-3"
    >
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Totaux</h2>
        <dl className="space-y-1 text-sm">
          <Row label="Étapes" value={stats.totalEvents.toLocaleString("fr-FR")} />
          <Row
            label="Or net"
            value={treasury.text}
            valueClassName={treasury.className}
          />
          <Row
            label="VE nette"
            value={teamValue.text}
            valueClassName={teamValue.className}
          />
        </dl>
      </div>
      <BucketList title="Par action" buckets={stats.byAction} />
      <BucketList title="Par rôle" buckets={stats.byActorRole} />
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${valueClassName ?? "text-gray-900"}`}>
        {value}
      </dd>
    </div>
  );
}

function BucketList({
  title,
  buckets,
}: {
  title: string;
  buckets: Array<{ key: string; count: number; treasuryDelta: number }>;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
      <ul className="space-y-1 text-sm">
        {buckets.length === 0 ? (
          <li className="text-gray-400">—</li>
        ) : (
          buckets.map((b) => {
            const delta = deltaCell(b.treasuryDelta);
            return (
              <li key={b.key} className="flex justify-between gap-3">
                <span className="truncate font-mono text-xs text-gray-600">
                  {b.key}
                </span>
                <span className="shrink-0 text-gray-900">
                  {b.count}
                  <span className={`ml-2 ${delta.className}`}>{delta.text}</span>
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function EventRow({
  entry,
  expanded,
  onToggle,
  onDrillCorrelation,
}: {
  entry: JournalEvent;
  expanded: boolean;
  onToggle: () => void;
  onDrillCorrelation: () => void;
}) {
  const treasury = deltaCell(entry.treasuryDelta);
  const teamValue = deltaCell(entry.teamValueDelta);
  const failed = entry.action.endsWith(".failed");

  return (
    <>
      <tr
        data-testid="journal-row"
        onClick={onToggle}
        className={`cursor-pointer hover:bg-gray-50 ${failed ? "bg-red-50" : ""}`}
      >
        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">
          {timestamp(entry.createdAt)}
        </td>
        <td className="px-3 py-2">
          {entry.team ? (
            <a
              href={`/me/teams/${entry.teamId}/journal`}
              onClick={(e) => e.stopPropagation()}
              className="text-blue-700 hover:underline"
            >
              {entry.team.teamName ?? entry.teamId}
            </a>
          ) : (
            <span className="text-gray-400" title="Équipe supprimée">
              {entry.teamId}
            </span>
          )}
          {entry.team?.teamDeleted ? (
            <span className="ml-1 text-xs text-gray-400">(supprimée)</span>
          ) : null}
          <div className="text-xs text-gray-500">
            {entry.team?.ownerLabel ?? "—"}
          </div>
        </td>
        <td className="px-3 py-2">
          <code className="text-xs text-gray-800">{entry.action}</code>
          <div className="text-xs text-gray-500">{entry.summary}</div>
        </td>
        <td className="px-3 py-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              ROLE_STYLES[entry.actorRole] ?? ROLE_STYLES.anonymous
            }`}
          >
            {entry.actorRole}
          </span>
          <div className="text-xs text-gray-600">{entry.actorLabel ?? "—"}</div>
          {entry.impersonatorId ? (
            <div className="text-[11px] text-purple-700">
              via impersonation
            </div>
          ) : null}
        </td>
        <td className={`px-3 py-2 text-right font-medium ${treasury.className}`}>
          {treasury.text}
        </td>
        <td className="px-3 py-2 text-right text-gray-700">
          {kpo(entry.treasury)}
        </td>
        <td className={`px-3 py-2 text-right font-medium ${teamValue.className}`}>
          {teamValue.text}
        </td>
        <td className="px-3 py-2 text-right text-gray-700">
          {kpo(entry.teamValue)}
        </td>
      </tr>
      {expanded ? (
        <tr data-testid="journal-row-detail">
          <td colSpan={8} className="bg-gray-50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <span>
                Opération{" "}
                <code className="font-mono">{entry.correlationId}</code> · étape{" "}
                {entry.step}
              </span>
              <button
                type="button"
                data-testid="journal-drill-correlation"
                onClick={onDrillCorrelation}
                className="rounded border border-gray-300 bg-white px-2 py-0.5 hover:bg-gray-100"
              >
                Voir toute l&apos;opération
              </button>
              {entry.route ? <span>{entry.route}</span> : null}
              {entry.ipAddress ? <span>IP {entry.ipAddress}</span> : null}
              <span>source {entry.source}</span>
            </div>
            {entry.note ? (
              <p className="mb-2 text-xs italic text-gray-700">{entry.note}</p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <JsonBlock title="Changements" value={entry.changes} />
              <JsonBlock title="Charge utile" value={entry.details} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-gray-600">{title}</h3>
      <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-[11px] text-gray-800">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
