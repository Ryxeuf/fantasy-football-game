"use client";

/**
 * Sprint Q lot Q.B.2 — Admin moderation des commentaires Gazette.
 *
 * Filtre flagged|deleted|all + actions admin (unflag, restore, delete).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

type Filter = "flagged" | "deleted" | "all";

interface AdminComment {
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
  comments: AdminComment[];
}

export default function AdminGazetteCommentsPage(): JSX.Element {
  const [filter, setFilter] = useState<Filter>("flagged");
  const [comments, setComments] = useState<AdminComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const data = await apiRequest<CommentsResponse>(
        `/admin/gazette/comments?filter=${filter}&limit=200`,
      );
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e: unknown) {
      const msg = e instanceof ApiClientError ? e.message : "fetch error";
      setError(msg);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(
    commentId: string,
    op: "delete" | "unflag" | "restore",
  ): Promise<void> {
    setPending(`${op}:${commentId}`);
    setActionMessage(null);
    setError(null);
    try {
      await apiRequest(`/admin/gazette/comments/${commentId}/${op}`, {
        method: "POST",
      });
      setActionMessage(`${op} OK pour ${commentId}.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "action error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">
          Gazette · Moderation commentaires
        </h1>
      </div>

      <div
        className="flex gap-2 text-sm"
        data-testid="admin-comments-filters"
      >
        {(["flagged", "deleted", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 ${filter === f ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            data-testid={`admin-filter-${f}`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="rounded border border-rose-700 bg-rose-950 px-3 py-2 text-sm text-rose-200"
          data-testid="admin-comments-error"
        >
          {error}
        </div>
      )}

      {actionMessage && (
        <div
          className="rounded border border-emerald-700 bg-emerald-950 px-3 py-2 text-sm text-emerald-200"
          data-testid="admin-comments-message"
        >
          {actionMessage}
        </div>
      )}

      {comments === null ? (
        <p className="text-sm text-slate-500" data-testid="admin-comments-loading">
          Chargement…
        </p>
      ) : comments.length === 0 ? (
        <p
          className="text-sm text-slate-500"
          data-testid="admin-comments-empty"
        >
          Aucun commentaire pour ce filtre.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="admin-comments-list">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded border p-3 ${c.deleted ? "border-rose-800 bg-rose-950/30" : c.flagged ? "border-amber-700 bg-amber-950/30" : "border-slate-800 bg-slate-900"}`}
              data-testid={`admin-comment-${c.id}`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-slate-200">
                  {c.userName ?? c.userEmail}
                </span>
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
                {c.flagReason && (
                  <span className="text-slate-500">
                    · {c.flagReason}
                  </span>
                )}
                <Link
                  href={`/pro-league/gazette` as never}
                  className="ml-auto text-amber-400 hover:underline"
                >
                  article {c.articleId.slice(0, 8)}…
                </Link>
              </div>
              <div
                className="whitespace-pre-line text-sm text-slate-200"
                data-testid={`admin-comment-body-${c.id}`}
              >
                {c.body}
              </div>
              <div className="mt-2 flex gap-2 text-xs">
                {c.flagged && (
                  <button
                    type="button"
                    onClick={() => action(c.id, "unflag")}
                    disabled={pending !== null}
                    className="rounded bg-slate-700 px-2 py-1 text-slate-200 hover:bg-slate-600 disabled:opacity-40"
                    data-testid={`admin-comment-unflag-${c.id}`}
                  >
                    Unflag
                  </button>
                )}
                {c.deleted ? (
                  <button
                    type="button"
                    onClick={() => action(c.id, "restore")}
                    disabled={pending !== null}
                    className="rounded bg-emerald-700 px-2 py-1 text-white hover:bg-emerald-600 disabled:opacity-40"
                    data-testid={`admin-comment-restore-${c.id}`}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => action(c.id, "delete")}
                    disabled={pending !== null}
                    className="rounded bg-rose-700 px-2 py-1 text-white hover:bg-rose-600 disabled:opacity-40"
                    data-testid={`admin-comment-delete-${c.id}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
