"use client";
/**
 * Journal d'équipe — « qui a changé quoi, et quel a été le résultat ».
 *
 * Répond au besoin de terrain : une trésorerie ou une VE qui bouge sans
 * cause visible. Chaque OPÉRATION (une requête) est une carte dépliable qui
 * montre ses ÉTAPES dans l'ordre d'exécution, avec l'état résultant de
 * l'équipe après chacune.
 *
 * Le regroupement, les libellés et le formatage vivent dans
 * `journal-format.ts` (pur, testé) ; cette page ne fait que câbler.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiRequest } from "../../../../lib/api-client";
import {
  ACTION_FILTERS,
  deltaToneClass,
  formatChanges,
  formatGold,
  formatGoldDelta,
  formatTimestamp,
  groupByOperation,
  type JournalEntry,
  type JournalOperation,
} from "./journal-format";

interface JournalResponse {
  teamId: string;
  teamName: string | null;
  total: number;
  limit: number;
  offset: number;
  entries: JournalEntry[];
}

const PAGE_SIZE = 50;

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  owner: { label: "coach", className: "bg-blue-100 text-blue-800" },
  admin: { label: "admin", className: "bg-purple-100 text-purple-800" },
  commissioner: {
    label: "commissaire",
    className: "bg-amber-100 text-amber-800",
  },
  system: { label: "système", className: "bg-gray-200 text-gray-700" },
  anonymous: { label: "inconnu", className: "bg-gray-200 text-gray-700" },
};

export default function TeamJournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionPrefix, setActionPrefix] = useState("");
  const [onlyEconomic, setOnlyEconomic] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id =
    typeof window !== "undefined" ? window.location.pathname.split("/")[3] : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (actionPrefix) params.set("action", actionPrefix);
      if (onlyEconomic) params.set("economic", "1");
      const data = await apiRequest<JournalResponse>(
        `/team/${id}/journal?${params.toString()}`,
      );
      setEntries(data.entries ?? []);
      setTeamName(data.teamName ?? null);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Impossible de charger le journal",
      );
    } finally {
      setLoading(false);
    }
  }, [id, offset, actionPrefix, onlyEconomic]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  const operations = useMemo(() => groupByOperation(entries), [entries]);

  const toggle = (correlationId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(correlationId)) next.delete(correlationId);
      else next.add(correlationId);
      return next;
    });
  };

  return (
    <div
      data-testid="team-journal-page"
      className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6"
    >
      <div>
        <Link
          href={`/me/teams/${id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour à l&apos;équipe
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-nuffle-anthracite sm:text-3xl">
          Journal {teamName ? `— ${teamName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Toutes les modifications de l&apos;équipe, par qui et avec quel
          résultat. Une carte = une opération ; dépliez-la pour voir les étapes
          et l&apos;état de l&apos;équipe après chacune.
        </p>
      </div>

      <div
        data-testid="journal-filters"
        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
      >
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Action
          <select
            data-testid="journal-action-filter"
            value={actionPrefix}
            onChange={(e) => {
              setOffset(0);
              setActionPrefix(e.target.value);
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            data-testid="journal-economic-filter"
            type="checkbox"
            checked={onlyEconomic}
            onChange={(e) => {
              setOffset(0);
              setOnlyEconomic(e.target.checked);
            }}
          />
          Uniquement l&apos;or et la VE
        </label>
        <span className="ml-auto text-sm text-gray-500">
          {total.toLocaleString("fr-FR")} étape
          {total > 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-20 rounded-lg bg-gray-200" />
          <div className="h-20 rounded-lg bg-gray-200" />
          <div className="h-20 rounded-lg bg-gray-200" />
        </div>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      ) : operations.length === 0 ? (
        <div
          data-testid="journal-empty"
          className="rounded border border-gray-200 bg-gray-50 px-4 py-6 text-center text-gray-600"
        >
          Aucune modification enregistrée pour cette sélection.
        </div>
      ) : (
        <ul className="space-y-3">
          {operations.map((op) => (
            <OperationCard
              key={op.correlationId}
              operation={op}
              open={expanded.has(op.correlationId)}
              onToggle={() => toggle(op.correlationId)}
            />
          ))}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            data-testid="journal-prev"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            ← Plus récent
          </button>
          <span className="text-sm text-gray-500">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} sur {total}
          </span>
          <button
            type="button"
            data-testid="journal-next"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Plus ancien →
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const badge = ROLE_BADGES[role] ?? ROLE_BADGES.anonymous;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

function OperationCard({
  operation,
  open,
  onToggle,
}: {
  operation: JournalOperation;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      data-testid="journal-operation"
      className={`rounded-lg border ${
        operation.failed ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 text-gray-400">{open ? "▾" : "▸"}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-nuffle-anthracite">
              {operation.headline}
            </span>
            <RoleBadge role={operation.actorRole} />
            {operation.failed ? (
              <span className="rounded bg-red-200 px-1.5 py-0.5 text-[11px] font-medium text-red-900">
                échec
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            {formatTimestamp(operation.startedAt)} · {operation.steps.length}{" "}
            étape{operation.steps.length > 1 ? "s" : ""}
          </span>
        </span>
        <span className="shrink-0 text-right text-sm">
          <span
            data-testid="journal-op-treasury"
            className={`block ${deltaToneClass(operation.treasuryDelta)}`}
          >
            {formatGoldDelta(operation.treasuryDelta)}
          </span>
          <span className="block text-xs text-gray-500">
            trésorerie {formatGold(operation.treasuryAfter)}
          </span>
        </span>
      </button>

      {open ? (
        <ol className="border-t border-gray-200 px-3 py-2">
          {operation.steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function StepRow({ step }: { step: JournalEntry }) {
  const changes = formatChanges(step.changes);
  return (
    <li data-testid="journal-step" className="border-b border-gray-100 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-600">
          #{step.step}
        </span>
        <span className="text-sm text-gray-800">{step.summary}</span>
        <code className="text-[11px] text-gray-400">{step.action}</code>
      </div>

      {step.note ? (
        <p className="mt-1 text-xs italic text-gray-600">{step.note}</p>
      ) : null}

      {changes.length > 0 ? (
        <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {changes.map((c) => (
            <div key={c.field} className="flex items-baseline gap-1">
              <dt className="text-gray-500">{c.label}</dt>
              <dd className="text-gray-800">
                <span className="text-gray-400 line-through">{c.from}</span>
                {" → "}
                <span className="font-medium">{c.to}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* L'état résultant, systématiquement : c'est la réponse à « et
          alors, ça a donné quoi ? » — même quand rien d'autre n'a bougé. */}
      <p className="mt-1.5 text-xs text-gray-500">
        Résultat : trésorerie {formatGold(step.treasury)} · VE{" "}
        {formatGold(step.teamValue)} · VEA {formatGold(step.currentValue)}
        {step.after ? ` · ${step.after.activePlayerCount} joueurs actifs` : ""}
      </p>

      {step.details !== null && step.details !== undefined ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-gray-500">
            Détail technique
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[11px] text-gray-700">
            {JSON.stringify(step.details, null, 2)}
          </pre>
        </details>
      ) : null}
    </li>
  );
}
