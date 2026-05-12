"use client";

/**
 * Lot P.B.1 — Page admin de gestion du wallet d'un utilisateur.
 *
 * Affiche :
 *  - infos user + solde courant
 *  - bouton "Ajuster solde" → BalanceAdjustModal
 *  - liste paginee des transactions (ProTransaction)
 *  - liste des paris pending avec bouton "Refund" → BetRefundModal
 *
 * Toutes les actions exigent un motif et tracent un audit log strict
 * cote serveur (cf. /admin/wallets routes).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../auth-client";
import BalanceAdjustModal from "./_components/BalanceAdjustModal";
import BetRefundModal from "./_components/BetRefundModal";

interface WalletData {
  user: { id: string; email: string; coachName: string };
  wallet: {
    userId: string;
    crowns: number;
    createdAt: string | null;
    updatedAt: string | null;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    ref: string | null;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  pendingBets: Array<{
    id: string;
    marketId: string;
    selection: string;
    stake: number;
    oddsAtPlace: number;
    status: string;
    createdAt: string;
  }>;
}

async function fetchJSON(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

const TX_TYPE_COLORS: Record<string, string> = {
  BET: "text-red-600",
  WIN: "text-green-600",
  REWARD: "text-blue-600",
  DAILY: "text-purple-600",
  BADGE: "text-yellow-600",
  SINK: "text-orange-600",
  ADMIN_ADJUST: "text-pink-700",
  ADMIN_REFUND: "text-teal-700",
};

export default function AdminWalletDetailPage() {
  const params = useParams();
  const userId = typeof params.userId === "string" ? params.userId : "";

  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [refundBet, setRefundBet] = useState<
    WalletData["pendingBets"][number] | null
  >(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched: WalletData = await fetchJSON(
        `/admin/wallets/${userId}?page=${page}&limit=50`,
      );
      setData(fetched);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    if (userId) load();
  }, [load, userId]);

  const handleAdjustConfirm = async (payload: {
    delta: number;
    reason: string;
  }) => {
    setAdjustLoading(true);
    try {
      await fetchJSON(`/admin/wallets/${userId}/balance`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setAdjustOpen(false);
      await load();
    } catch (e: any) {
      alert(e.message || "Erreur lors de l'ajustement");
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleRefundConfirm = async (payload: { reason: string }) => {
    if (!refundBet) return;
    setRefundLoading(true);
    try {
      await fetchJSON(`/admin/bets/${refundBet.id}/refund`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setRefundBet(null);
      await load();
    } catch (e: any) {
      alert(e.message || "Erreur lors du refund");
    } finally {
      setRefundLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4" />
          <p className="text-gray-600">Chargement…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1
            data-testid="admin-wallet-title"
            className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite break-words"
          >
            Wallet de {data.user.coachName}
          </h1>
          <p className="text-sm text-gray-600 break-all">{data.user.email}</p>
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-blue-600 hover:underline whitespace-nowrap"
        >
          ← Retour
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 sm:p-6 flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div>
          <div className="text-sm text-gray-600">Solde courant</div>
          <div
            data-testid="wallet-balance"
            className="text-3xl sm:text-4xl font-bold text-nuffle-anthracite"
          >
            {data.wallet.crowns.toLocaleString("fr-FR")}{" "}
            <span className="text-base font-normal text-gray-500">Crowns</span>
          </div>
        </div>
        <button
          onClick={() => setAdjustOpen(true)}
          data-testid="btn-adjust-balance"
          className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg whitespace-nowrap"
        >
          Ajuster le solde
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Paris en attente ({data.pendingBets.length})
        </h2>
        {data.pendingBets.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun pari en attente.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Selection</th>
                <th className="text-left p-2">Stake</th>
                <th className="text-left p-2">Cote</th>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingBets.map((bet) => (
                <tr key={bet.id} className="border-t border-gray-100">
                  <td className="p-2 font-mono text-xs">{bet.selection}</td>
                  <td className="p-2">
                    {bet.stake.toLocaleString("fr-FR")} Crowns
                  </td>
                  <td className="p-2">{bet.oddsAtPlace.toFixed(2)}</td>
                  <td className="p-2 text-xs text-gray-500">
                    {new Date(bet.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => setRefundBet(bet)}
                      data-testid={`btn-refund-${bet.id}`}
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">
            Transactions ({data.pagination.total})
          </h2>
          <div className="text-xs text-gray-500">
            Page {data.pagination.page} / {data.pagination.totalPages}
          </div>
        </div>
        {data.transactions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucune transaction.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Type</th>
                <th className="text-right p-2">Montant</th>
                <th className="text-left p-2">Ref / Raison</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx) => (
                <tr
                  key={tx.id}
                  data-testid={`tx-${tx.id}`}
                  className="border-t border-gray-100"
                >
                  <td className="p-2 text-xs text-gray-600">
                    {new Date(tx.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-2">
                    <span
                      className={`font-semibold ${TX_TYPE_COLORS[tx.type] ?? "text-gray-700"}`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td
                    className={`p-2 text-right font-mono ${
                      tx.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount.toLocaleString("fr-FR")}
                  </td>
                  <td className="p-2 text-xs text-gray-600 break-all">
                    {tx.ref ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {data.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
            >
              ← Precedent
            </button>
            <button
              disabled={page >= data.pagination.totalPages}
              onClick={() =>
                setPage((p) => Math.min(data.pagination.totalPages, p + 1))
              }
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        )}
      </div>

      <BalanceAdjustModal
        open={adjustOpen}
        userId={userId}
        userLabel={data.user.coachName || data.user.email}
        currentBalance={data.wallet.crowns}
        loading={adjustLoading}
        onClose={() => setAdjustOpen(false)}
        onConfirm={handleAdjustConfirm}
      />

      <BetRefundModal
        open={refundBet !== null}
        bet={refundBet}
        loading={refundLoading}
        onClose={() => setRefundBet(null)}
        onConfirm={handleRefundConfirm}
      />
    </div>
  );
}
