"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CROWNS_TX_TYPES,
  adminGetCrownsOverview,
  adminListCrownsLedger,
  crownsFlagState,
  crownsTxTypeLabel,
  type CrownsFlagState,
  type CrownsFlow,
  type CrownsLedgerPage,
  type CrownsOverview,
} from "../../lib/admin-crowns";
import { formatCrowns, formatCrownsDelta } from "../../lib/crowns";
import { dynamicRoute } from "../../lib/typed-route";

const LEDGER_PAGE_SIZE = 50;
const WINDOWS = [7, 30, 90] as const;

const FLAG_COPY: Record<CrownsFlagState, { tone: string; title: string; body: string }> = {
  missing: {
    tone: "border-red-200 bg-red-50 text-red-900",
    title: "Flag « crowns » absent de la base",
    body: "Les coachs ne peuvent rien acheter et le flag ne peut pas être allumé : synchronisez les flags depuis le code, puis activez-le.",
  },
  off: {
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    title: "Flag « crowns » éteint",
    body: "Les coachs voient la boutique mais l'achat est verrouillé (« Bientôt disponible »). Les admins le contournent.",
  },
  overrides: {
    tone: "border-sky-200 bg-sky-50 text-sky-900",
    title: "Flag « crowns » ouvert à quelques comptes",
    body: "Éteint pour tous, sauf pour les comptes en override.",
  },
  on: {
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: "Flag « crowns » actif pour tous",
    body: "Solde visible et achats ouverts à tous les coachs.",
  },
};

function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-nuffle-anthracite">{value}</div>
      {children}
    </div>
  );
}

function FlowsTable({ flows }: { flows: readonly CrownsFlow[] }) {
  if (flows.length === 0) return <p className="p-4 text-sm italic text-gray-500">Aucune opération sur la période.</p>;
  const total = flows.reduce(
    (acc, f) => ({ credited: acc.credited + f.credited, debited: acc.debited + f.debited }),
    { credited: 0, debited: 0 },
  );
  return (
    <table className="min-w-full text-sm" data-testid="crowns-flows">
      <thead className="bg-gray-50 text-left">
        <tr>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2 text-right">Opérations</th>
          <th className="px-3 py-2 text-right">Créditées</th>
          <th className="px-3 py-2 text-right">Débitées</th>
          <th className="px-3 py-2 text-right">Net</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {flows.map((f) => (
          <tr key={f.type} data-testid={`crowns-flow-${f.type}`}>
            <td className="px-3 py-2">
              {crownsTxTypeLabel(f.type)} <span className="font-mono text-xs text-gray-400">{f.type}</span>
            </td>
            <td className="px-3 py-2 text-right">{f.count}</td>
            <td className="px-3 py-2 text-right font-mono text-emerald-700">{f.credited ? `+${formatCrowns(f.credited)}` : "—"}</td>
            <td className="px-3 py-2 text-right font-mono text-red-700">{f.debited ? `−${formatCrowns(f.debited)}` : "—"}</td>
            <td className="px-3 py-2 text-right font-mono">{formatCrownsDelta(f.net)}</td>
          </tr>
        ))}
        <tr className="bg-gray-50 font-semibold">
          <td className="px-3 py-2">Total</td>
          <td />
          <td className="px-3 py-2 text-right font-mono text-emerald-700">+{formatCrowns(total.credited)}</td>
          <td className="px-3 py-2 text-right font-mono text-red-700">−{formatCrowns(total.debited)}</td>
          <td className="px-3 py-2 text-right font-mono">{formatCrownsDelta(total.credited - total.debited)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Admin — Couronnes : état du flag, masse en circulation, flux par type
 * (depuis toujours et sur une fenêtre récente), plus gros soldes et journal
 * global de toutes les opérations.
 */
export default function AdminCrownsPage() {
  const [days, setDays] = useState<number>(30);
  const [period, setPeriod] = useState<"recent" | "allTime">("recent");
  const [overview, setOverview] = useState<CrownsOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [ledger, setLedger] = useState<CrownsLedgerPage | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Une réponse du journal plus ancienne que la dernière demandée est ignorée.
  const ledgerRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setOverviewError(null);
    adminGetCrownsOverview(days)
      .then((o) => !cancelled && setOverview(o))
      .catch((e: unknown) => !cancelled && setOverviewError(e instanceof Error ? e.message : "Erreur de chargement"));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const loadLedger = useCallback(async () => {
    const id = ++ledgerRequest.current;
    setLedgerError(null);
    try {
      const next = await adminListCrownsLedger({ type: type || undefined, search: query || undefined, page, limit: LEDGER_PAGE_SIZE });
      if (id === ledgerRequest.current) setLedger(next);
    } catch (e: unknown) {
      if (id === ledgerRequest.current) setLedgerError(e instanceof Error ? e.message : "Erreur de chargement");
    }
  }, [type, query, page]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const flag = overview ? FLAG_COPY[crownsFlagState(overview.flag)] : null;
  const ledgerPages = ledger ? Math.max(1, Math.ceil(ledger.total / ledger.limit)) : 1;

  return (
    <div className="space-y-6" data-testid="admin-crowns">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">👑 Couronnes</h1>
        <p className="mt-1 text-sm text-gray-600">
          La monnaie du site : masse en circulation, d&apos;où viennent les Couronnes et où elles partent.
        </p>
      </div>

      {overviewError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {overviewError}
        </div>
      )}

      {overview && flag && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${flag.tone}`} data-testid="crowns-flag">
          <div>
            <p className="font-semibold">{flag.title}</p>
            <p>
              {flag.body}
              {overview.flag.userOverrides > 0 && ` (${overview.flag.userOverrides} compte${overview.flag.userOverrides > 1 ? "s" : ""} en override)`}
            </p>
          </div>
          <Link href="/admin/feature-flags" className="rounded border border-current px-3 py-1 font-medium">
            Feature flags →
          </Link>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="En circulation" value={`👑 ${formatCrowns(overview.supply)}`} />
          <Kpi label="Wallets" value={formatCrowns(overview.wallets)}>
            <Link href="/admin/wallets" className="mt-1 inline-block text-xs text-nuffle-bronze hover:underline">
              Gérer les wallets →
            </Link>
          </Kpi>
          <Kpi label="Coachs sans wallet" value={formatCrowns(overview.usersWithoutWallet)}>
            {overview.usersWithoutWallet > 0 && (
              <Link
                href={dynamicRoute("/admin/wallets?status=without")}
                className="mt-1 inline-block text-xs text-nuffle-bronze hover:underline"
                data-testid="crowns-missing-wallets-link"
              >
                Les créer →
              </Link>
            )}
          </Kpi>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <h2 className="font-semibold">Flux par type</h2>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  aria-pressed={period === "recent"}
                  onClick={() => setPeriod("recent")}
                  className={`rounded px-2 py-1 ${period === "recent" ? "bg-nuffle-bronze text-white" : "border"}`}
                >
                  Récents
                </button>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded border px-2 py-1"
                  aria-label="Fenêtre"
                  data-testid="crowns-window"
                >
                  {WINDOWS.map((d) => (
                    <option key={d} value={d}>
                      {d} jours
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-pressed={period === "allTime"}
                  onClick={() => setPeriod("allTime")}
                  className={`rounded px-2 py-1 ${period === "allTime" ? "bg-nuffle-bronze text-white" : "border"}`}
                  data-testid="crowns-period-all"
                >
                  Depuis toujours
                </button>
              </div>
            </div>
            <FlowsTable flows={period === "recent" ? overview.flows.recent : overview.flows.allTime} />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white shadow">
            <h2 className="border-b p-3 font-semibold">Plus gros soldes</h2>
            {overview.topHolders.length === 0 ? (
              <p className="p-4 text-sm italic text-gray-500">Aucun solde positif.</p>
            ) : (
              <ol className="divide-y divide-gray-100 text-sm">
                {overview.topHolders.map((h, i) => (
                  <li key={h.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Link href={dynamicRoute(`/admin/wallets/${h.userId}`)} className="min-w-0 truncate hover:underline">
                      {i + 1}. {h.coachName}
                    </Link>
                    <span className="font-mono">👑 {formatCrowns(h.crowns)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="font-semibold">Journal{ledger ? ` (${ledger.total})` : ""}</h2>
          <form
            className="flex flex-wrap gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="rounded border px-2 py-1"
              aria-label="Type d'opération"
              data-testid="crowns-ledger-type"
            >
              <option value="">Tous les types</option>
              {CROWNS_TX_TYPES.map((t) => (
                <option key={t} value={t}>
                  {crownsTxTypeLabel(t)}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Coach…"
              className="rounded border px-2 py-1"
              data-testid="crowns-ledger-search"
            />
            <button type="submit" className="rounded border px-3 py-1">
              Filtrer
            </button>
          </form>
        </div>
        {ledgerError && (
          <p className="p-3 text-sm text-red-700" role="alert">
            {ledgerError}
          </p>
        )}
        {ledger && ledger.items.length === 0 && <p className="p-4 text-sm italic text-gray-500">Aucune opération.</p>}
        {ledger && ledger.items.length > 0 && (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Coach</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Montant</th>
                <th className="px-3 py-2">Réf. / raison</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ledger.items.map((tx) => (
                <tr key={tx.id} data-testid={`crowns-tx-${tx.id}`}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-600">{new Date(tx.createdAt).toLocaleString("fr-FR")}</td>
                  <td className="px-3 py-2">
                    <Link href={dynamicRoute(`/admin/wallets/${tx.user.id}`)} className="hover:underline">
                      {tx.user.coachName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{crownsTxTypeLabel(tx.type)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${tx.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {formatCrownsDelta(tx.amount)}
                  </td>
                  <td className="break-all px-3 py-2 text-xs text-gray-600">{tx.ref ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {ledger && ledgerPages > 1 && (
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <span className="text-gray-500">
              Page {ledger.page}/{ledgerPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                ←
              </button>
              <button type="button" disabled={page >= ledgerPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
