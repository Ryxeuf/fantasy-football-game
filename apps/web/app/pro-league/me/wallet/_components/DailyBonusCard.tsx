"use client";

/**
 * Sprint O — Lot O.C.1 : carte "Daily bonus" sur la page wallet.
 *
 * Le service backend `pro-wallet-rewards.claimDailyBonus` existe depuis
 * Lot 1.D.6 (route `POST /pro-league/me/wallet/daily-bonus`) mais
 * aucune UI ne l'expose. L'audit 2026-05-10 identifiait ca comme un
 * hook retention manquant (+40% DAU attendu).
 *
 * Affiche :
 *   - Streak (si tu reviens N jours d'affilee) — Lot futur si on
 *     persiste un streak ; pour O.C.1 on affiche juste l'etat claim.
 *   - Bouton "Reclamer +50 Crowns" si claimable.
 *   - Compte a rebours "Disponible dans Xh" si deja claim.
 *   - Toast / message de succes apres claim.
 *
 * Endpoints :
 *   - `GET /pro-league/me/wallet/daily-bonus` → `{ canClaim, nextEligibleAt? }`
 *   - `POST /pro-league/me/wallet/daily-bonus` → `{ granted, balance, amount, nextEligibleAt }`
 */

import { useEffect, useState } from "react";

import { apiRequest } from "../../../../lib/api-client";

interface DailyBonusStatus {
  canClaim: boolean;
  nextEligibleAt: string | null;
  amount?: number;
}

interface ClaimOutcome {
  granted: boolean;
  balance: number;
  amount: number;
  nextEligibleAt: string | null;
}

interface DailyBonusCardProps {
  /**
   * Callback appele apres un claim reussi (granted=true) pour rafraichir
   * le wallet parent (balance + transactions).
   */
  readonly onClaimed?: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "maintenant";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m} min`;
}

export default function DailyBonusCard({
  onClaimed,
}: DailyBonusCardProps): JSX.Element {
  const [status, setStatus] = useState<DailyBonusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Refresh status au mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiRequest<DailyBonusStatus>("/pro-league/me/wallet/daily-bonus")
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tick toutes les 30s pour rafraichir le countdown.
  useEffect(() => {
    if (!status || status.canClaim) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status]);

  const claim = async (): Promise<void> => {
    setClaiming(true);
    setError(null);
    try {
      const out = await apiRequest<ClaimOutcome>(
        "/pro-league/me/wallet/daily-bonus",
        { method: "POST" },
      );
      if (out.granted) {
        setJustClaimed(out.amount);
        setStatus({
          canClaim: false,
          nextEligibleAt: out.nextEligibleAt,
        });
        onClaimed?.();
      } else {
        // Defensive : si pas granted (race condition), refresh status.
        setStatus({
          canClaim: false,
          nextEligibleAt: out.nextEligibleAt,
        });
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <section
        data-testid="daily-bonus-card"
        className="mb-4 rounded border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400"
      >
        Chargement du bonus quotidien…
      </section>
    );
  }

  if (error) {
    return (
      <section
        data-testid="daily-bonus-card"
        className="mb-4 rounded border border-rose-800 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
      >
        Bonus quotidien indisponible : {error}
      </section>
    );
  }

  if (!status) return <></>;

  // Just claimed → message de succes.
  if (justClaimed !== null) {
    return (
      <section
        data-testid="daily-bonus-card"
        className="mb-4 rounded border border-emerald-700 bg-emerald-950/40 px-4 py-3"
      >
        <div className="text-xs uppercase text-emerald-400">
          Bonus quotidien réclamé
        </div>
        <div className="mt-1 font-mono text-2xl text-emerald-200">
          +{justClaimed} Crowns 🎉
        </div>
        <div className="mt-1 text-xs text-emerald-500">
          Reviens demain pour ton prochain bonus !
        </div>
      </section>
    );
  }

  // Status disponible.
  if (status.canClaim) {
    return (
      <section
        data-testid="daily-bonus-card"
        className="mb-4 flex items-center justify-between rounded border border-amber-700 bg-amber-950/40 px-4 py-3"
      >
        <div>
          <div className="text-xs uppercase text-amber-400">
            Bonus quotidien
          </div>
          <div className="mt-1 text-sm text-amber-100">
            Réclame ton bonus quotidien : <strong>+50 Crowns</strong>
          </div>
        </div>
        <button
          data-testid="daily-bonus-claim"
          onClick={() => void claim()}
          disabled={claiming}
          className="rounded border border-amber-500 bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500 disabled:opacity-50"
        >
          {claiming ? "Claim…" : "Réclamer +50"}
        </button>
      </section>
    );
  }

  // Pas encore claimable : countdown.
  const nextAt = status.nextEligibleAt
    ? new Date(status.nextEligibleAt).getTime()
    : null;
  const remaining = nextAt ? nextAt - now : 0;
  return (
    <section
      data-testid="daily-bonus-card"
      className="mb-4 rounded border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400"
    >
      <div className="text-xs uppercase text-slate-500">Bonus quotidien</div>
      <div className="mt-1 text-slate-300">
        Déjà réclamé aujourd'hui. Prochain bonus dans{" "}
        <strong
          data-testid="daily-bonus-countdown"
          className="font-mono text-slate-100"
        >
          {formatCountdown(remaining)}
        </strong>
        .
      </div>
    </section>
  );
}
