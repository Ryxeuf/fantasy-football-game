import React, { useState, useCallback, useMemo } from "react";
import type { InducementDefinition, InducementSelection, InducementSlug } from "@bb/game-engine";

/** Format a number with spaces as thousand separators (French convention) */
function formatGold(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

interface InducementSelectionPopupProps {
  /** Filtered catalogue of purchasable inducements for this team */
  catalogue: InducementDefinition[];
  /** Maximum budget (petty cash + treasury) */
  budget: number;
  /** Team name displayed in the header */
  teamName: string;
  /** Called with the final selection when the coach confirms */
  onConfirm: (selection: InducementSelection) => void;
  /** Called when the coach skips inducement purchasing */
  onSkip: () => void;
}

export default function InducementSelectionPopup({
  catalogue,
  budget,
  teamName,
  onConfirm,
  onSkip,
}: InducementSelectionPopupProps) {
  const [quantities, setQuantities] = useState<Map<InducementSlug, number>>(
    () => new Map()
  );

  const totalSpent = useMemo(() => {
    let total = 0;
    for (const [slug, qty] of quantities) {
      const def = catalogue.find((d) => d.slug === slug);
      if (def) total += def.baseCost * qty;
    }
    return total;
  }, [quantities, catalogue]);

  const increment = useCallback(
    (slug: InducementSlug) => {
      setQuantities((prev) => {
        const def = catalogue.find((d) => d.slug === slug);
        if (!def) return prev;
        const current = prev.get(slug) ?? 0;
        if (current >= def.maxQuantity) return prev;

        // Check budget
        let currentTotal = 0;
        for (const [s, q] of prev) {
          const d = catalogue.find((c) => c.slug === s);
          if (d) currentTotal += d.baseCost * q;
        }
        if (currentTotal + def.baseCost > budget) return prev;

        const next = new Map(prev);
        next.set(slug, current + 1);
        return next;
      });
    },
    [catalogue, budget]
  );

  const decrement = useCallback((slug: InducementSlug) => {
    setQuantities((prev) => {
      const current = prev.get(slug) ?? 0;
      if (current <= 0) return prev;
      const next = new Map(prev);
      if (current === 1) {
        next.delete(slug);
      } else {
        next.set(slug, current - 1);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const items: InducementSelection["items"] = [];
    for (const [slug, qty] of quantities) {
      if (qty > 0) {
        items.push({ slug, quantity: qty });
      }
    }
    onConfirm({ items });
  }, [quantities, onConfirm]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg mx-4 shadow-xl w-full">
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold">Inducements</h3>
          <p className="text-sm text-gray-600">{teamName}</p>
          <p className="text-sm font-semibold mt-1">
            Budget : {formatGold(totalSpent)} / {formatGold(budget)} gp
          </p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
          {catalogue.map((def) => {
            const qty = quantities.get(def.slug) ?? 0;
            const atMax = qty >= def.maxQuantity;
            const wouldExceedBudget = totalSpent + def.baseCost > budget;

            return (
              <div
                key={def.slug}
                className="flex items-center justify-between border border-gray-200 rounded px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{def.displayName}</div>
                  <div className="text-xs text-gray-500">
                    {formatGold(def.baseCost)} gp — max {def.maxQuantity}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {def.description}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => decrement(def.slug)}
                    disabled={qty <= 0}
                    className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="w-5 text-center font-semibold text-sm">
                    {qty}
                  </span>
                  <button
                    onClick={() => increment(def.slug)}
                    disabled={atMax || wouldExceedBudget}
                    className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleConfirm}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
          >
            Confirmer
          </button>
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-semibold"
          >
            Passer
          </button>
        </div>
      </div>
    </div>
  );
}
