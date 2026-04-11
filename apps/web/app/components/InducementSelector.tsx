"use client";

import { useState, useMemo, useCallback } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import type {
  InducementDefinition,
  InducementSlug,
  InducementSelection,
} from "@bb/game-engine";

interface InducementSelectorProps {
  catalogue: InducementDefinition[];
  budget: number;
  pettyCash: number;
  onConfirm: (selection: InducementSelection) => void;
  onSkip: () => void;
  disabled?: boolean;
  teamName: string;
}

export default function InducementSelector({
  catalogue,
  budget,
  pettyCash,
  onConfirm,
  onSkip,
  disabled = false,
  teamName,
}: InducementSelectorProps) {
  const { t, language: lang } = useLanguage();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const totalCost = useMemo(() => {
    return catalogue.reduce((sum, ind) => {
      const qty = quantities[ind.slug] || 0;
      return sum + ind.baseCost * qty;
    }, 0);
  }, [quantities, catalogue]);

  const remaining = budget - totalCost;

  const handleAdd = useCallback(
    (slug: InducementSlug) => {
      setQuantities((prev) => ({
        ...prev,
        [slug]: (prev[slug] || 0) + 1,
      }));
    },
    [],
  );

  const handleRemove = useCallback(
    (slug: InducementSlug) => {
      setQuantities((prev) => {
        const current = prev[slug] || 0;
        if (current <= 0) return prev;
        return { ...prev, [slug]: current - 1 };
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([slug, quantity]) => ({
        slug: slug as InducementSlug,
        quantity,
      }));
    onConfirm({ items });
  }, [quantities, onConfirm]);

  const canAdd = useCallback(
    (ind: InducementDefinition): boolean => {
      if (disabled) return false;
      const currentQty = quantities[ind.slug] || 0;
      if (currentQty >= ind.maxQuantity) return false;
      if (remaining < ind.baseCost) return false;
      return true;
    },
    [quantities, remaining, disabled],
  );

  if (budget <= 0) {
    return (
      <div
        data-testid="inducement-selector"
        className="rounded border bg-white p-4"
      >
        <h3 className="font-semibold mb-2">
          {t.inducements?.title || "Inducements"} — {teamName}
        </h3>
        <p className="text-sm text-gray-500">
          {t.inducements?.noBudget || "No budget available"}
        </p>
        <button
          data-testid="inducement-skip"
          onClick={onSkip}
          disabled={disabled}
          className="mt-3 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {t.inducements?.skip || "Skip (no inducements)"}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="inducement-selector"
      className="rounded border bg-white p-4 max-w-lg w-full"
    >
      <h3 className="font-semibold mb-3 text-lg">
        {t.inducements?.selectInducements || "Select your inducements"} — {teamName}
      </h3>

      {/* Budget info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm space-y-1">
        <div className="flex justify-between">
          <span>{t.inducements?.pettyCash || "Petty Cash"}</span>
          <span className="font-semibold">{(pettyCash / 1000).toFixed(0)}{t.teams?.kpo || "K po"}</span>
        </div>
        <div className="flex justify-between">
          <span>{t.inducements?.budget || "Budget"}</span>
          <span className="font-semibold">{(budget / 1000).toFixed(0)}{t.teams?.kpo || "K po"}</span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span>{t.inducements?.totalCost || "Total cost"}</span>
          <span className={`font-semibold ${totalCost > budget ? "text-red-600" : "text-emerald-700"}`}>
            {(totalCost / 1000).toFixed(0)}{t.teams?.kpo || "K po"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t.inducements?.remaining || "Remaining"}</span>
          <span className={`font-semibold ${remaining < 0 ? "text-red-600" : ""}`}>
            {(remaining / 1000).toFixed(0)}{t.teams?.kpo || "K po"}
          </span>
        </div>
      </div>

      {/* Catalogue */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {catalogue.map((ind) => {
          const qty = quantities[ind.slug] || 0;
          const canAddThis = canAdd(ind);
          const displayName = lang === "fr" ? ind.displayNameFr : ind.displayName;

          return (
            <div
              key={ind.slug}
              className={`border rounded p-3 transition-colors ${
                qty > 0
                  ? "bg-emerald-50 border-emerald-300"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{displayName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {ind.description}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-sm font-semibold text-emerald-700 whitespace-nowrap">
                    {(ind.baseCost / 1000).toFixed(0)}K
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="-"
                      onClick={() => handleRemove(ind.slug)}
                      disabled={disabled || qty <= 0}
                      className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {qty}
                    </span>
                    <button
                      aria-label="+"
                      onClick={() => handleAdd(ind.slug)}
                      disabled={!canAddThis}
                      className="w-7 h-7 rounded bg-emerald-200 hover:bg-emerald-300 text-emerald-800 font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    max {ind.maxQuantity}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          data-testid="inducement-confirm"
          onClick={handleConfirm}
          disabled={disabled || totalCost > budget}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {t.inducements?.confirm || "Confirm Selection"}
        </button>
        <button
          data-testid="inducement-skip"
          onClick={onSkip}
          disabled={disabled}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          {t.inducements?.skip || "Skip (no inducements)"}
        </button>
      </div>
    </div>
  );
}
