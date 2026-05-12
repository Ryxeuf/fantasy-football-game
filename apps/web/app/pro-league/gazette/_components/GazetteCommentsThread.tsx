"use client";

/**
 * Sprint Q lot Q.B.2 — Thread commentaires sous un article Gazette.
 *
 * Fetch les commentaires + permet de poster (auth) / supprimer
 * (auteur) / report (auth).
 */

import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

interface CommentView {
  id: string;
  articleId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  body: string;
  createdAt: string;
  flagged: boolean;
  deleted: boolean;
  flagReason: string | null;
}

interface CommentsResponse {
  comments: CommentView[];
}

interface GazetteCommentsThreadProps {
  readonly articleId: string;
}

interface MeResponse {
  user?: { id: string } | null;
}

const MAX_BODY = 500;

export function GazetteCommentsThread({
  articleId,
}: GazetteCommentsThreadProps): JSX.Element {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      const data = await apiRequest<CommentsResponse>(
        `/pro-league/gazette/articles/${articleId}/comments`,
      );
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "fetch error");
    }
  }

  useEffect(() => {
    load();
  }, [articleId]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(`/pro-league/gazette/articles/${articleId}/comments`, {
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

  async function deleteComment(id: string): Promise<void> {
    if (!confirm("Supprimer ce commentaire ?")) return;
    try {
      await apiRequest(`/pro-league/gazette/comments/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "delete error");
    }
  }

  async function flagCommentAction(id: string): Promise<void> {
    if (!confirm("Reporter ce commentaire comme inapproprie ?")) return;
    try {
      await apiRequest(`/pro-league/gazette/comments/${id}/flag`, {
        method: "POST",
        body: JSON.stringify({ reason: "inappropriate" }),
        headers: { "Content-Type": "application/json" },
      });
      await load();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "flag error");
    }
  }

  if (error && comments === null) {
    return (
      <section
        className="mt-3 rounded border border-rose-700 bg-rose-950/30 px-3 py-2 text-xs text-rose-300"
        data-testid={`comments-error-${articleId}`}
      >
        {error}
      </section>
    );
  }

  return (
    <section
      className="mt-3 border-t border-slate-800 pt-3"
      data-testid={`comments-thread-${articleId}`}
    >
      <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
        Commentaires{" "}
        <span className="text-slate-500">({comments?.length ?? 0})</span>
      </h3>

      {comments === null ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : comments.length === 0 ? (
        <p
          className="text-xs text-slate-500"
          data-testid={`comments-empty-${articleId}`}
        >
          Soyez le premier a commenter.
        </p>
      ) : (
        <ul className="space-y-2" data-testid={`comments-list-${articleId}`}>
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded border px-2 py-1.5 ${c.flagged ? "border-amber-700 bg-amber-950/40" : "border-slate-800 bg-slate-900"}`}
              data-testid={`comment-${c.id}`}
            >
              <div className="mb-0.5 flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono">{c.userName ?? c.userEmail}</span>
                <span className="text-slate-600">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
                {c.flagged && (
                  <span className="rounded bg-amber-700/40 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-200">
                    flagged
                  </span>
                )}
                {c.deleted && (
                  <span className="rounded bg-rose-700/40 px-1 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
                    deleted
                  </span>
                )}
              </div>
              <div
                className="whitespace-pre-line text-sm text-slate-200"
                data-testid={`comment-body-${c.id}`}
              >
                {c.body}
              </div>
              {currentUserId && (
                <div className="mt-1 flex justify-end gap-2 text-[10px]">
                  {c.userId === currentUserId && !c.deleted && (
                    <button
                      type="button"
                      onClick={() => deleteComment(c.id)}
                      className="text-rose-400 hover:underline"
                      data-testid={`comment-delete-${c.id}`}
                    >
                      Supprimer
                    </button>
                  )}
                  {c.userId !== currentUserId && !c.flagged && (
                    <button
                      type="button"
                      onClick={() => flagCommentAction(c.id)}
                      className="text-amber-400 hover:underline"
                      data-testid={`comment-flag-${c.id}`}
                    >
                      Reporter
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {currentUserId ? (
        <form
          onSubmit={submit}
          className="mt-3 space-y-1"
          data-testid={`comments-form-${articleId}`}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
            maxLength={MAX_BODY}
            placeholder="Donnez votre avis (max 500 caracteres)…"
            className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            rows={2}
            data-testid={`comments-input-${articleId}`}
          />
          {submitError && (
            <div
              className="text-[11px] text-rose-300"
              data-testid={`comments-submit-error-${articleId}`}
            >
              {submitError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {draft.length}/{MAX_BODY}
            </span>
            <button
              type="submit"
              disabled={submitting || draft.trim().length === 0}
              className="rounded bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
              data-testid={`comments-submit-${articleId}`}
            >
              {submitting ? "…" : "Commenter"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">
          Connectez-vous pour commenter.
        </p>
      )}
    </section>
  );
}
