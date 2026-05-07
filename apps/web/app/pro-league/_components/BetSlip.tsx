"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { useLanguage } from "../../contexts/LanguageContext";
import { ApiClientError, apiRequest } from "../../lib/api-client";
import { useWallet } from "../../lib/use-wallet";

/**
 * Modale de pose de pari — sprint 1.D.7.
 *
 * UX :
 * - Affiche le market + selection picked + cote courante
 * - Input mise (stake) avec quick chips 50/100/250/500
 * - Calcule le payout potentiel = round(stake * odds)
 * - Bouton "Confirmer" → POST /pro-league/bets avec clientToken cuid
 * - Errors : INVALID_STAKE / WALLET_INSUFFICIENT_FUNDS / STALE_ODDS …
 *   affichés inline avec un message friendly
 * - Animation success : pas de toast lib, juste un état local "won"
 *   avec couleur emerald
 */

interface MarketSummary {
  readonly id: string;
  readonly matchId: string;
  readonly type: string;
}

interface SelectionTarget {
  readonly market: MarketSummary;
  readonly selection: string;
  readonly label: string;
  readonly odds: number;
}

interface BetSlipProps {
  readonly target: SelectionTarget;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

const QUICK_STAKES = [50, 100, 250, 500];

interface PlaceBetResponse {
  readonly id: string;
  readonly status: string;
  readonly stake: number;
  readonly oddsAtPlace: number;
}

/** Génère un cuid-like minimal (timestamp + random). Suffit pour
 *  l'idempotence (clientToken est unique au scope user/session). */
function makeClientToken(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `cw${ts}${rnd}`;
}

const ERROR_MESSAGES: Record<string, string> = {
  WALLET_INSUFFICIENT_FUNDS: "Solde insuffisant.",
  INVALID_STAKE: "Mise invalide.",
  INVALID_ODDS: "Cote invalide.",
  STALE_ODDS: "La cote a changé. Rafraîchis et réessaie.",
  MARKET_CLOSED: "Le market est fermé.",
  INVALID_SELECTION: "Sélection invalide.",
  MARKET_NOT_FOUND: "Market introuvable.",
};

export function BetSlip({
  target,
  onClose,
  onSuccess,
}: BetSlipProps): JSX.Element {
  const { t } = useLanguage();
  const wallet = useWallet();
  const dialogId = useId();
  const [stake, setStake] = useState(50);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    payout: number;
  } | null>(null);

  // Re-générer un clientToken à chaque ouverture (target change).
  const [clientToken, setClientToken] = useState(() => makeClientToken());
  useEffect(() => {
    setClientToken(makeClientToken());
    setStake(50);
    setError(null);
    setConfirmation(null);
  }, [target.market.id, target.selection]);

  const potentialPayout = useMemo(() => {
    return Math.round(stake * target.odds);
  }, [stake, target.odds]);

  const submit = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const out = await apiRequest<PlaceBetResponse>("/pro-league/bets", {
        method: "POST",
        body: JSON.stringify({
          marketId: target.market.id,
          selection: target.selection,
          stake,
          oddsAtPlace: target.odds,
          clientToken,
        }),
      });
      setConfirmation({
        id: out.id,
        payout: Math.round(out.stake * out.oddsAtPlace),
      });
      // Actualise wallet en arrière-plan.
      void wallet.refresh();
    } catch (e: unknown) {
      const code =
        e instanceof ApiClientError && typeof e.message === "string"
          ? extractCode(e.message)
          : null;
      const friendly =
        (code && ERROR_MESSAGES[code]) ||
        (e instanceof Error ? e.message : t.proLeague.betSlip.unknownError);
      setError(friendly);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby={`${dialogId}-title`}
      aria-modal="true"
      data-testid="bet-slip"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-xl">
        <header className="mb-3 flex items-center justify-between">
          <h3 id={`${dialogId}-title`} className="text-lg font-bold">
            {t.proLeague.betSlip.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.proLeague.betSlip.labelClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕
          </button>
        </header>

        {confirmation ? (
          <div
            data-testid="bet-confirmation"
            className="rounded border border-emerald-700 bg-emerald-950 px-3 py-3"
          >
            <p className="text-sm text-emerald-100">
              {t.proLeague.betSlip.confirmedTitle}
            </p>
            <p className="mt-2 font-mono text-emerald-200">
              {t.proLeague.betSlip.confirmedSummary.replace(
                "{stake}",
                String(stake),
              )}{" "}
              <span className="font-bold">{confirmation.payout}</span>{" "}
              {t.proLeague.wallet.crowns}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onSuccess}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-600"
              >
                {t.proLeague.betSlip.ok}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 rounded border border-slate-800 bg-slate-950 px-3 py-2">
              <p className="text-xs uppercase text-slate-500">
                {t.proLeague.betSlip.selection}
              </p>
              <p className="text-sm font-medium text-slate-100">
                {target.label}
              </p>
              <p className="mt-1 text-xs uppercase text-slate-500">
                {t.proLeague.betSlip.odds}
              </p>
              <p className="font-mono text-lg font-bold text-emerald-300">
                {target.odds.toFixed(2)}
              </p>
            </div>

            <label
              htmlFor={`${dialogId}-stake`}
              className="text-xs uppercase text-slate-400"
            >
              {t.proLeague.betSlip.stakeLabel}
            </label>
            <div className="mb-2 flex items-center gap-2">
              <input
                id={`${dialogId}-stake`}
                data-testid="stake-input"
                type="number"
                min={1}
                max={100_000}
                value={stake}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setStake(Number.isNaN(n) ? 0 : n);
                }}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStake(s)}
                  className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between rounded bg-slate-950 px-3 py-2">
              <span className="text-xs uppercase text-slate-500">
                {t.proLeague.betSlip.potentialPayout}
              </span>
              <span className="font-mono text-lg font-bold text-emerald-300">
                {potentialPayout}
              </span>
            </div>

            {wallet.authed ? (
              <p className="mb-3 text-xs text-slate-500">
                {t.proLeague.betSlip.balanceAvailable}{" "}
                <span className="font-mono">{wallet.balance}</span>{" "}
                {t.proLeague.wallet.crowns}
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mb-3 rounded border border-rose-700 bg-rose-950 px-2 py-1 text-sm text-rose-200"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
              >
                {t.proLeague.betSlip.cancel}
              </button>
              <button
                type="button"
                data-testid="confirm-bet"
                onClick={() => {
                  void submit();
                }}
                disabled={pending || stake < 1}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending
                  ? t.proLeague.betSlip.sending
                  : t.proLeague.betSlip.confirm}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Extrait le code d'erreur backend depuis un message ApiClientError.
 *  Le serveur renvoie `{error, code}` ; la classe ApiClientError ne
 *  conserve que `message` = error. On re-fetch le code via une heuristique
 *  basée sur des keywords du message. */
function extractCode(message: string): string | null {
  if (message.includes("Solde insuffisant")) return "WALLET_INSUFFICIENT_FUNDS";
  if (message.includes("stake") && message.includes("entier"))
    return "INVALID_STAKE";
  if (message.includes("Cote a changé")) return "STALE_ODDS";
  if (message.toLowerCase().includes("market") && message.includes("statut"))
    return "MARKET_CLOSED";
  if (message.includes("Market clos")) return "MARKET_CLOSED";
  if (message.includes("introuvable")) return "MARKET_NOT_FOUND";
  return null;
}
