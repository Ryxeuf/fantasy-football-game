"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";
import InducementSelector from "../../components/InducementSelector";
import type {
  InducementDefinition,
  InducementSelection,
} from "@bb/game-engine";

interface TeamInducementInfo {
  name: string;
  roster: string;
  ctv: number;
  budget: number;
  hasApothecary: boolean;
}

interface InducementsInfo {
  catalogue: InducementDefinition[];
  pettyCash: {
    teamA: { base: number; treasuryUsed: number; maxBudget: number };
    teamB: { base: number; treasuryUsed: number; maxBudget: number };
  };
  teamA: TeamInducementInfo;
  teamB: TeamInducementInfo;
}

interface LocalMatchInducementsProps {
  matchId: string;
  onSuccess: () => Promise<void> | void;
}

export default function LocalMatchInducements({
  matchId,
  onSuccess,
}: LocalMatchInducementsProps) {
  const [info, setInfo] = useState<InducementsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectionA, setSelectionA] = useState<InducementSelection | null>(null);
  const [selectionB, setSelectionB] = useState<InducementSelection | null>(null);

  const authHeader = useCallback((): Record<string, string> => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/local-match/${matchId}/inducements-info`,
        { headers: authHeader() },
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Erreur ${res.status}`);
      }
      const data = (await res.json()) as InducementsInfo;
      setInfo(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [matchId, authHeader]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  const submit = useCallback(
    async (a: InducementSelection, b: InducementSelection) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/local-match/${matchId}/inducements`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader(),
            },
            body: JSON.stringify({ selectionA: a, selectionB: b }),
          },
        );
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `Erreur ${res.status}`);
        }
        await onSuccess();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [matchId, authHeader, onSuccess],
  );

  const handleConfirmA = useCallback((s: InducementSelection) => {
    setSelectionA(s);
  }, []);

  const handleSkipA = useCallback(() => {
    setSelectionA({ items: [] });
  }, []);

  const handleConfirmB = useCallback((s: InducementSelection) => {
    setSelectionB(s);
  }, []);

  const handleSkipB = useCallback(() => {
    setSelectionB({ items: [] });
  }, []);

  const handleValidate = useCallback(() => {
    if (!selectionA || !selectionB) return;
    submit(selectionA, selectionB);
  }, [selectionA, selectionB, submit]);

  const handleSkipAll = useCallback(() => {
    submit({ items: [] }, { items: [] });
  }, [submit]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-nuffle-anthracite">Chargement des inducements...</p>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700 font-semibold">Erreur</p>
        <p className="text-red-600 text-sm mt-2">{error}</p>
        <button
          onClick={loadInfo}
          className="mt-4 px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded font-semibold hover:bg-nuffle-bronze transition-colors"
        >
          Reessayer
        </button>
      </div>
    );
  }

  if (!info) return null;

  const bothReady = selectionA !== null && selectionB !== null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 sm:p-6 shadow-md">
        <h2 className="text-xl sm:text-2xl font-bold text-nuffle-anthracite mb-2">
          Phase d&apos;inducements
        </h2>
        <p className="text-sm text-gray-700">
          Selectionnez les inducements pour chaque equipe. En partie locale,
          chaque phase doit etre validee manuellement. Confirmez la selection
          de chaque equipe, puis validez pour passer a la phase suivante.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="flex flex-col items-stretch">
          <div className="mb-2 text-sm font-semibold text-nuffle-anthracite">
            Equipe A —{" "}
            {selectionA !== null ? (
              <span className="text-emerald-700">Selection confirmee</span>
            ) : (
              <span className="text-gray-500">En cours de selection</span>
            )}
          </div>
          {selectionA !== null ? (
            <div className="rounded border bg-emerald-50 border-emerald-300 p-4 text-sm">
              <div className="font-semibold text-emerald-700">
                {info.teamA.name}
              </div>
              <div className="text-emerald-600 mt-1">
                {selectionA.items.length === 0
                  ? "Aucun inducement"
                  : `${selectionA.items.length} inducement(s) selectionne(s)`}
              </div>
              <button
                onClick={() => setSelectionA(null)}
                disabled={submitting}
                className="mt-3 text-xs text-emerald-800 underline disabled:opacity-50"
              >
                Modifier
              </button>
            </div>
          ) : (
            <InducementSelector
              catalogue={info.catalogue}
              budget={info.teamA.budget}
              pettyCash={info.pettyCash.teamA.maxBudget}
              teamName={info.teamA.name}
              disabled={submitting}
              onConfirm={handleConfirmA}
              onSkip={handleSkipA}
            />
          )}
        </div>

        <div className="flex flex-col items-stretch">
          <div className="mb-2 text-sm font-semibold text-nuffle-anthracite">
            Equipe B —{" "}
            {selectionB !== null ? (
              <span className="text-emerald-700">Selection confirmee</span>
            ) : (
              <span className="text-gray-500">En cours de selection</span>
            )}
          </div>
          {selectionB !== null ? (
            <div className="rounded border bg-emerald-50 border-emerald-300 p-4 text-sm">
              <div className="font-semibold text-emerald-700">
                {info.teamB.name}
              </div>
              <div className="text-emerald-600 mt-1">
                {selectionB.items.length === 0
                  ? "Aucun inducement"
                  : `${selectionB.items.length} inducement(s) selectionne(s)`}
              </div>
              <button
                onClick={() => setSelectionB(null)}
                disabled={submitting}
                className="mt-3 text-xs text-emerald-800 underline disabled:opacity-50"
              >
                Modifier
              </button>
            </div>
          ) : (
            <InducementSelector
              catalogue={info.catalogue}
              budget={info.teamB.budget}
              pettyCash={info.pettyCash.teamB.maxBudget}
              teamName={info.teamB.name}
              disabled={submitting}
              onConfirm={handleConfirmB}
              onSkip={handleSkipB}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={handleSkipAll}
          disabled={submitting}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          Passer (aucun inducement)
        </button>
        <button
          onClick={handleValidate}
          disabled={submitting || !bothReady}
          className="px-6 py-2 bg-gradient-to-r from-nuffle-gold to-nuffle-bronze text-nuffle-anthracite rounded font-bold hover:from-nuffle-bronze hover:to-nuffle-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Validation..." : "Valider les inducements"}
        </button>
      </div>
    </div>
  );
}
