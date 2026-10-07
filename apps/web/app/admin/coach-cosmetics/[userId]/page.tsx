"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  acquisitionSourceLabel,
  adjustCoachCrowns,
  adminGetCoachCosmetics,
  adminGrantDiceTheme,
  adminRevokeDiceTheme,
  adminSetCoachDiceTheme,
  type CoachCosmeticsDetail,
} from "../../../lib/admin-dice-themes";
import { DiceThemePreview } from "../../../components/dice/DiceThemePreview";
import { describeCrownsTransaction, formatCrowns, formatCrownsDelta } from "../../../lib/crowns";
import { dynamicRoute } from "../../../lib/typed-route";
import BalanceAdjustModal from "../../wallets/[userId]/_components/BalanceAdjustModal";
import { CoachCrownsRewards } from "./CoachCrownsRewards";

/**
 * Admin — Couronnes & thèmes de dés d'UN coach :
 *  - solde de Crowns + ajustement (route wallet, journal `ADMIN_ADJUST`) ;
 *  - thème choisi (parmi ceux qu'il possède, ou retour au défaut) ;
 *  - thèmes acquis (retrait, avec remboursement d'un achat) et cadeaux ;
 *  - dernières opérations du journal des Crowns ;
 *  - registre des récompenses gagnées en jouant (`crowns-earning`).
 */
export default function AdminCoachCosmeticsDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";
  const [detail, setDetail] = useState<CoachCosmeticsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [grantId, setGrantId] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await adminGetCoachCosmetics(userId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const themeName = useCallback(
    (id: string) => detail?.themes.find((t) => t.id === id)?.name.fr,
    [detail],
  );
  const grantable = useMemo(() => (detail ? detail.themes.filter((t) => !t.owned) : []), [detail]);
  const owned = useMemo(() => (detail ? detail.themes.filter((t) => t.owned) : []), [detail]);

  async function run(action: () => Promise<CoachCosmeticsDetail | void>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      if (next) setDetail(next);
      else await load();
      setNotice(success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-nuffle-gold" />
      </div>
    );
  }
  if (!detail) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error ?? "Coach introuvable"}</div>;
  }

  return (
    <div className="space-y-6" data-testid="admin-coach-cosmetics-detail">
      <div>
        <Link href="/admin/coach-cosmetics" className="text-sm text-nuffle-bronze hover:underline">
          ← Couronnes &amp; thèmes des coachs
        </Link>
        <h1 className="mt-1 text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">{detail.user.coachName}</h1>
        <p className="text-sm text-gray-500">{detail.user.email}</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}
      {notice && <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Couronnes */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">👑 Couronnes</h2>
          <p className="mt-1 text-3xl font-heading font-bold text-nuffle-bronze" data-testid="coach-crowns-balance">
            {formatCrowns(detail.crowns)} Crowns
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={busy}
              className="rounded bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
              data-testid="coach-crowns-adjust"
            >
              Ajuster le solde
            </button>
            <Link
              href={dynamicRoute(`/admin/wallets/${detail.user.id}`)}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
            >
              Wallet complet
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-gray-100 text-sm" data-testid="coach-crowns-history">
            {detail.transactions.length === 0 && <li className="py-2 text-gray-500">Aucune opération.</li>}
            {detail.transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between gap-3 py-1.5">
                <span>
                  {describeCrownsTransaction(tx, themeName)}
                  <span className="ml-2 text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString("fr-FR")}</span>
                </span>
                <span className={`font-mono ${tx.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatCrownsDelta(tx.amount)}</span>
              </li>
            ))}
          </ul>
        </section>

        <CoachCrownsRewards userId={detail.user.id} />

        {/* Thème choisi */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold">🎲 Thème choisi</h2>
          <p className="mt-1 text-sm text-gray-600">
            Effectif : <strong>{themeName(detail.effectiveThemeId) ?? detail.effectiveThemeId}</strong>
            {detail.storedThemeId === null && " (jamais choisi — défaut)"}
            {detail.storedThemeId !== null && detail.storedThemeId !== detail.effectiveThemeId && (
              <span className="text-amber-700"> — préférence stockée « {detail.storedThemeId} » plus possédée</span>
            )}
          </p>
          <div className="mt-3">
            <DiceThemePreview themeId={detail.effectiveThemeId} size="md" withNumberDie />
          </div>
          <label className="mt-4 block text-sm">
            Changer le thème du coach (parmi ses thèmes)
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={detail.storedThemeId ?? ""}
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value || null;
                void run(() => adminSetCoachDiceTheme(detail.user.id, value), "Thème du coach mis à jour");
              }}
              data-testid="coach-theme-select"
            >
              <option value="">— Défaut (jamais choisi)</option>
              {owned.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name.fr}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>

      {/* Thèmes acquis */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold">Thèmes acquis</h2>
        {detail.acquisitions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Aucun thème acheté ni offert (le dé original est possédé d&apos;office).</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2" data-testid="coach-acquisitions">
            {detail.acquisitions.map((a) => (
              <li key={a.themeId} className="rounded-lg border p-3" data-testid={`coach-acquisition-${a.themeId}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{themeName(a.themeId) ?? a.themeId}</span>
                  <span className="text-xs text-gray-500">
                    {acquisitionSourceLabel(a.source)}
                    {a.priceCrowns !== null && ` · 👑 ${formatCrowns(a.priceCrowns)}`} · {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {a.known ? (
                  <div className="mt-2">
                    <DiceThemePreview themeId={a.themeId} />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-amber-700">Thème retiré du catalogue du code (aucun rendu).</p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const refund =
                      a.source === "purchase" && (a.priceCrowns ?? 0) > 0
                        ? window.confirm(`Rembourser ${formatCrowns(a.priceCrowns ?? 0)} Crowns au coach ? (Annuler = retrait sans remboursement)`)
                        : false;
                    if (!window.confirm(`Retirer « ${themeName(a.themeId) ?? a.themeId} » à ce coach ?`)) return;
                    void run(
                      () => adminRevokeDiceTheme(detail.user.id, a.themeId, refund),
                      refund ? "Thème retiré et remboursé" : "Thème retiré",
                    );
                  }}
                  className="mt-3 rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
                  data-testid={`coach-revoke-${a.themeId}`}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!grantId) return;
            void run(() => adminGrantDiceTheme(detail.user.id, grantId), "Thème offert").then(() => setGrantId(""));
          }}
        >
          <label className="text-sm">
            Offrir un thème
            <select
              className="mt-1 block min-w-[16rem] rounded border px-2 py-1"
              value={grantId}
              onChange={(e) => setGrantId(e.target.value)}
              data-testid="coach-grant-select"
            >
              <option value="">— Choisir —</option>
              {grantable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name.fr}
                  {t.priceCrowns !== null ? ` (👑 ${formatCrowns(t.priceCrowns)})` : ""}
                  {t.enabled ? "" : " — retiré"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || !grantId}
            className="rounded bg-nuffle-bronze px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            data-testid="coach-grant-submit"
          >
            Offrir
          </button>
          {grantId && (
            <div className="w-full">
              <DiceThemePreview themeId={grantId} />
            </div>
          )}
        </form>
      </section>

      <BalanceAdjustModal
        open={adjustOpen}
        userId={detail.user.id}
        userLabel={detail.user.coachName}
        currentBalance={detail.crowns}
        loading={busy}
        onClose={() => setAdjustOpen(false)}
        onConfirm={async ({ delta, reason }) => {
          await run(async () => {
            await adjustCoachCrowns(detail.user.id, delta, reason);
          }, `Solde ajusté de ${formatCrownsDelta(delta)} Crowns`);
          setAdjustOpen(false);
        }}
      />
    </div>
  );
}
