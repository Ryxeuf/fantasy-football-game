"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  adminCreateMissingWallets,
  adminCreateWallet,
  adminListWallets,
  parseWalletStatus,
  type AdminWalletPage,
  type WalletStatusFilter,
} from "../../lib/admin-crowns";
import { formatCrowns } from "../../lib/crowns";
import { dynamicRoute } from "../../lib/typed-route";

const PAGE_SIZE = 25;

const FILTERS: ReadonlyArray<{ id: WalletStatusFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "with", label: "Avec wallet" },
  { id: "without", label: "Sans wallet" },
];

/**
 * Admin — Wallets : chaque coach, avec ou sans wallet. Un coach sans wallet a
 * un solde lu 0 partout ; on peut lui en créer un (solde 0, aucune
 * transaction), un par un ou tous d'un coup.
 */
export default function AdminWalletsPage() {
  const [data, setData] = useState<AdminWalletPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // `null` jusqu'au montage : l'URL n'est lue que côté client (pas d'écart
  // d'hydratation, pas de requête lancée avec un filtre faux).
  const [status, setStatus] = useState<WalletStatusFilter | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  // Numéro de la dernière requête : une réponse plus ancienne arrivée après
  // (filtre changé pendant une recherche lente) est ignorée.
  const requestId = useRef(0);

  useEffect(() => {
    setStatus(parseWalletStatus(new URLSearchParams(window.location.search).get("status")));
  }, []);

  const load = useCallback(async () => {
    if (status === null) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await adminListWallets({ status, search: query || undefined, page, limit: PAGE_SIZE });
      if (id !== requestId.current) return;
      setData(next);
      // Une création vide la dernière page du filtre « sans wallet » : on
      // recule sur la dernière page qui existe encore.
      const last = Math.max(1, Math.ceil(next.total / next.limit));
      if (page > last) setPage(last);
    } catch (e: unknown) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const createOne = async (userId: string, label: string) => {
    setBusy(userId);
    setNotice(null);
    setError(null);
    try {
      const r = await adminCreateWallet(userId);
      setNotice(r.created ? `Wallet créé pour ${label}.` : `${label} avait déjà un wallet.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setBusy(null);
    }
  };

  const createMissing = async () => {
    const missing = data?.counts.without ?? 0;
    if (!window.confirm(`Créer un wallet (solde 0) pour les ${missing} coach(s) qui n'en ont pas ?`)) return;
    setBusy("*");
    setNotice(null);
    setError(null);
    try {
      const r = await adminCreateMissingWallets();
      setNotice(
        `${r.created} wallet${r.created > 1 ? "s" : ""} créé${r.created > 1 ? "s" : ""}` +
          (r.remaining > 0 ? ` — ${r.remaining} restant(s), relancez pour continuer.` : "."),
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Création impossible");
    } finally {
      setBusy(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const missing = data?.counts.without ?? 0;

  return (
    <div className="space-y-6" data-testid="admin-wallets">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">👛 Wallets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Le porte-monnaie de Couronnes de chaque coach. Sans wallet, le solde se lit 0 et rien n&apos;est
            journalisé : créez-le ici, puis créditez-le depuis sa fiche.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createMissing()}
          disabled={missing === 0 || busy !== null}
          className="rounded bg-nuffle-bronze px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          data-testid="wallets-create-missing"
        >
          {missing > 0 ? `Créer les ${missing} wallet${missing > 1 ? "s" : ""} manquant${missing > 1 ? "s" : ""}` : "Tous les coachs ont un wallet"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setStatus(f.id);
              setPage(1);
            }}
            aria-pressed={status === f.id}
            className={`rounded-full border px-3 py-1 text-sm ${
              status === f.id ? "border-nuffle-bronze bg-nuffle-bronze text-white" : "border-gray-300 bg-white text-gray-700"
            }`}
            data-testid={`wallets-filter-${f.id}`}
          >
            {f.label}
            {data && <span className="ml-1 opacity-80">({data.counts[f.id]})</span>}
          </button>
        ))}
        <form
          className="ml-auto flex gap-2"
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
            className="min-w-[14rem] rounded border px-3 py-1.5 text-sm"
            data-testid="wallets-search"
          />
          <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            Rechercher
          </button>
        </form>
      </div>

      {notice && (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status" data-testid="wallets-notice">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

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
                <th className="px-3 py-2">Wallet</th>
                <th className="px-3 py-2">Solde</th>
                <th className="px-3 py-2">Opérations</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((u) => (
                <tr key={u.id} data-testid={`wallet-row-${u.id}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{u.coachName}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {u.wallet ? (
                      <span className="text-xs text-gray-600">
                        ✅ depuis le {new Date(u.wallet.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Aucun wallet</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{u.wallet ? `👑 ${formatCrowns(u.wallet.crowns)}` : "—"}</td>
                  <td className="px-3 py-2">{u.wallet?.transactions ?? 0}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {u.wallet ? (
                      <Link
                        href={dynamicRoute(`/admin/wallets/${u.id}`)}
                        className="rounded bg-nuffle-bronze px-3 py-1 text-xs font-medium text-white"
                        data-testid={`wallet-open-${u.id}`}
                      >
                        Gérer
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createOne(u.id, u.coachName || u.email)}
                        disabled={busy !== null}
                        className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        data-testid={`wallet-create-${u.id}`}
                      >
                        {busy === u.id ? "Création…" : "Créer le wallet"}
                      </button>
                    )}
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
