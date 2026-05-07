"use client";

import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "../../contexts/LanguageContext";
import { ApiClientError, apiRequest } from "../../lib/api-client";

import { BetSlip } from "./BetSlip";

/**
 * Liste les markets `open` d'un match Pro League — sprint 1.D.7.
 *
 * Affiche un bloc par market type avec les selections cliquables.
 * Au clic sur une selection : ouvre le `<BetSlip/>` modale pour
 * saisir la mise, puis confirme via `POST /pro-league/bets`.
 *
 * Si l'user n'est pas authentifié, masque la section et invite à
 * login (les markets sont chargés publiquement, juste les CTAs sont
 * gated).
 */

interface MarketSummary {
  readonly id: string;
  readonly matchId: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
  readonly status: string;
  readonly closesAt: string;
}

interface MarketsListProps {
  readonly matchId: string;
  /** Si false, masque les CTAs (visiteur anonyme). */
  readonly authed: boolean;
}

interface SelectionTarget {
  readonly market: MarketSummary;
  readonly selection: string;
  readonly label: string;
  readonly odds: number;
}

interface MarketsT {
  labelOneXTwo: string;
  labelOverUnderTd: string;
  labelCasCount: string;
  labelNuffleOccurs: string;
  selectionHome: string;
  selectionDraw: string;
  selectionAway: string;
  selectionOver: string;
  selectionUnder: string;
  selectionYes: string;
  selectionNo: string;
}

function marketLabel(type: string, m: MarketsT): string {
  switch (type) {
    case "ONE_X_TWO":
      return m.labelOneXTwo;
    case "OVER_UNDER_TD":
      return m.labelOverUnderTd;
    case "CAS_COUNT":
      return m.labelCasCount;
    case "NUFFLE_OCCURS":
      return m.labelNuffleOccurs;
    default:
      return type;
  }
}

function readNumber(o: Record<string, unknown>, key: string): number | null {
  const v = o[key];
  return typeof v === "number" ? v : null;
}

function selectionsForMarket(
  market: MarketSummary,
  m: MarketsT,
): SelectionTarget[] {
  const cfg = market.config;
  switch (market.type) {
    case "ONE_X_TWO": {
      const home = readNumber(cfg, "homeOdds");
      const draw = readNumber(cfg, "drawOdds");
      const away = readNumber(cfg, "awayOdds");
      const out: SelectionTarget[] = [];
      if (home !== null)
        out.push({
          market,
          selection: "home",
          label: m.selectionHome,
          odds: home,
        });
      if (draw !== null)
        out.push({
          market,
          selection: "draw",
          label: m.selectionDraw,
          odds: draw,
        });
      if (away !== null)
        out.push({
          market,
          selection: "away",
          label: m.selectionAway,
          odds: away,
        });
      return out;
    }
    case "OVER_UNDER_TD":
    case "CAS_COUNT": {
      const line = typeof cfg.line === "number" ? cfg.line : 0;
      const over = readNumber(cfg, "overOdds");
      const under = readNumber(cfg, "underOdds");
      const out: SelectionTarget[] = [];
      if (over !== null)
        out.push({
          market,
          selection: "over",
          label: m.selectionOver.replace("{line}", String(line)),
          odds: over,
        });
      if (under !== null)
        out.push({
          market,
          selection: "under",
          label: m.selectionUnder.replace("{line}", String(line)),
          odds: under,
        });
      return out;
    }
    case "NUFFLE_OCCURS": {
      const yes = readNumber(cfg, "yesOdds");
      const no = readNumber(cfg, "noOdds");
      const out: SelectionTarget[] = [];
      if (yes !== null)
        out.push({
          market,
          selection: "yes",
          label: m.selectionYes,
          odds: yes,
        });
      if (no !== null)
        out.push({
          market,
          selection: "no",
          label: m.selectionNo,
          odds: no,
        });
      return out;
    }
    default:
      return [];
  }
}

export function MarketsList({
  matchId,
  authed,
}: MarketsListProps): JSX.Element {
  const { t } = useLanguage();
  const [markets, setMarkets] = useState<readonly MarketSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickedTarget, setPickedTarget] = useState<SelectionTarget | null>(
    null,
  );
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<{ markets: readonly MarketSummary[] }>(
      `/pro-league/matches/${encodeURIComponent(matchId)}/markets`,
    )
      .then((d) => {
        if (cancelled) return;
        setMarkets(d.markets);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.status === 401) {
          // markets endpoint est public, mais on tolère le cas
          setMarkets([]);
          return;
        }
        const msg = e instanceof Error ? e.message : "fetch error";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, refreshTick]);

  const grouped = useMemo(() => {
    if (!markets) return [];
    return markets.map((m) => ({
      market: m,
      selections: selectionsForMarket(m, t.proLeague.markets),
    }));
  }, [markets, t.proLeague.markets]);

  if (loading) {
    return (
      <p className="text-sm text-slate-400" data-testid="markets-loading">
        {t.proLeague.markets.loading}
      </p>
    );
  }
  if (error) {
    return (
      <p
        role="alert"
        className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
      >
        {error}
      </p>
    );
  }
  if (!markets || markets.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="markets-empty">
        {t.proLeague.markets.empty}
      </p>
    );
  }

  return (
    <>
      <div data-testid="markets-list" className="flex flex-col gap-3">
        {grouped.map(({ market, selections }) => (
          <section
            key={market.id}
            className="rounded border border-slate-800 bg-slate-900 px-3 py-2"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-100">
              {marketLabel(market.type, t.proLeague.markets)}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selections.map((s) => (
                <button
                  key={`${market.id}-${s.selection}`}
                  type="button"
                  onClick={() => setPickedTarget(s)}
                  disabled={!authed}
                  data-testid={`bet-button-${market.type}-${s.selection}`}
                  className="flex flex-col items-center justify-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-2 text-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-slate-200">{s.label}</span>
                  <span className="font-mono text-base font-bold text-emerald-300">
                    {s.odds.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
            {!authed ? (
              <p className="mt-2 text-xs text-slate-500">
                {t.proLeague.markets.loginPrompt}
              </p>
            ) : null}
          </section>
        ))}
      </div>

      {pickedTarget ? (
        <BetSlip
          target={pickedTarget}
          onClose={() => setPickedTarget(null)}
          onSuccess={() => {
            setPickedTarget(null);
            setRefreshTick((n) => n + 1);
          }}
        />
      ) : null}
    </>
  );
}
