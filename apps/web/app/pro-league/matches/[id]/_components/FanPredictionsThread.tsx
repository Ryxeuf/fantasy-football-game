"use client";

/**
 * Sprint Q lot Q.B.3 — Thread fan predictions sur la page match.
 *
 * Pre-match (status=scheduled) : form pour poster sa prediction.
 * Post-match (status=completed) : affiche les predictions avec score
 * badges (perfect / winner / wrong).
 */

import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../../lib/api-client";

interface FanPredictionView {
  id: string;
  matchId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  body: string;
  score: "perfect" | "winner" | "wrong" | null;
  createdAt: string;
  scoredAt: string | null;
}

interface PredictionsResponse {
  predictions: FanPredictionView[];
}

interface MeResponse {
  user?: { id: string } | null;
}

interface FanPredictionsThreadProps {
  readonly matchId: string;
  /** Status du match — bloque le form si != scheduled. */
  readonly matchStatus: string;
}

const MAX_BODY = 200;

export function FanPredictionsThread({
  matchId,
  matchStatus,
}: FanPredictionsThreadProps): JSX.Element {
  const [predictions, setPredictions] = useState<
    FanPredictionView[] | null
  >(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<MeResponse>("/auth/me")
      .then((m) => {
        if (!cancelled) setCurrentUserId(m.user?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setCurrentUserId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function load(): Promise<void> {
    setError(null);
    try {
      const data = await apiRequest<PredictionsResponse>(
        `/pro-league/matches/${matchId}/predictions`,
      );
      setPredictions(
        Array.isArray(data?.predictions) ? data.predictions : [],
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "fetch error");
    }
  }

  useEffect(() => {
    load();
  }, [matchId]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(`/pro-league/matches/${matchId}/predictions`, {
        method: "POST",
        body: JSON.stringify({ body: draft }),
        headers: { "Content-Type": "application/json" },
      });
      setDraft("");
      await load();
    } catch (e: unknown) {
      const msg = e instanceof ApiClientError ? e.message : "post error";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOwn(): Promise<void> {
    if (!confirm("Supprimer votre prediction ?")) return;
    try {
      await apiRequest(`/pro-league/matches/${matchId}/predictions/me`, {
        method: "DELETE",
      });
      await load();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "delete error");
    }
  }

  const isOpen = matchStatus === "scheduled";
  const myPrediction = predictions?.find((p) => p.userId === currentUserId);

  if (error && predictions === null) {
    return (
      <section
        className="mt-6 rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
        data-testid="fan-pred-error"
      >
        {error}
      </section>
    );
  }

  return (
    <section
      className="mt-6 rounded-lg border border-slate-700 bg-slate-900 p-4"
      data-testid="fan-predictions-section"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase text-slate-400">
          Predictions
        </h2>
        <span className="text-xs text-slate-500" data-testid="fan-pred-count">
          {predictions?.length ?? 0} predictions ·{" "}
          {isOpen ? "ouvert" : "ferme"}
        </span>
      </div>

      {currentUserId && isOpen && (
        <form
          onSubmit={submit}
          className="mb-3 space-y-1"
          data-testid="fan-pred-form"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
            maxLength={MAX_BODY}
            placeholder='Ex: "Orcs gagnent 3-1", "Match nul 2-2"…'
            rows={2}
            className="w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
            data-testid="fan-pred-input"
          />
          {submitError && (
            <div
              className="text-[11px] text-rose-300"
              data-testid="fan-pred-submit-error"
            >
              {submitError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {draft.length}/{MAX_BODY}
            </span>
            <div className="flex items-center gap-2">
              {myPrediction && (
                <button
                  type="button"
                  onClick={deleteOwn}
                  className="text-[10px] text-rose-400 hover:underline"
                  data-testid="fan-pred-delete-mine"
                >
                  Supprimer la mienne
                </button>
              )}
              <button
                type="submit"
                disabled={submitting || draft.trim().length === 0}
                className="rounded bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
                data-testid="fan-pred-submit"
              >
                {submitting
                  ? "…"
                  : myPrediction
                    ? "Modifier"
                    : "Predire"}
              </button>
            </div>
          </div>
        </form>
      )}

      {currentUserId && !isOpen && (
        <p
          className="mb-3 text-xs text-slate-500"
          data-testid="fan-pred-closed-note"
        >
          Predictions fermees : le match a commence.
        </p>
      )}

      {!currentUserId && isOpen && (
        <p className="mb-3 text-xs text-slate-500">
          Connectez-vous pour poster votre prediction.
        </p>
      )}

      {predictions === null ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : predictions.length === 0 ? (
        <p
          className="text-xs text-slate-500"
          data-testid="fan-pred-empty"
        >
          Aucune prediction pour l&apos;instant.
        </p>
      ) : (
        <ul
          className="space-y-1.5"
          data-testid="fan-pred-list"
        >
          {predictions.map((p) => (
            <li
              key={p.id}
              className={`rounded border px-2 py-1.5 ${p.score === "perfect" ? "border-amber-600 bg-amber-950/30" : p.score === "winner" ? "border-emerald-700 bg-emerald-950/30" : "border-slate-800 bg-slate-950"}`}
              data-testid={`fan-pred-${p.id}`}
            >
              <div className="mb-0.5 flex items-center gap-2 text-xs">
                <span className="font-mono text-slate-200">
                  {p.userName ?? p.userEmail}
                </span>
                <span className="text-slate-600">
                  {new Date(p.createdAt).toLocaleString()}
                </span>
                {p.score === "perfect" && (
                  <span
                    className="rounded bg-amber-700/40 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-200"
                    data-testid={`fan-pred-badge-${p.id}`}
                  >
                    ⭐ Seer
                  </span>
                )}
                {p.score === "winner" && (
                  <span
                    className="rounded bg-emerald-700/40 px-1 py-0.5 text-[10px] font-semibold uppercase text-emerald-200"
                    data-testid={`fan-pred-badge-${p.id}`}
                  >
                    ✓ Winner
                  </span>
                )}
                {p.score === "wrong" && (
                  <span
                    className="rounded bg-slate-700/60 px-1 py-0.5 text-[10px] font-semibold uppercase text-slate-300"
                    data-testid={`fan-pred-badge-${p.id}`}
                  >
                    ✗ Wrong
                  </span>
                )}
              </div>
              <div
                className="whitespace-pre-line text-sm text-slate-100"
                data-testid={`fan-pred-body-${p.id}`}
              >
                {p.body}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
