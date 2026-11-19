"use client";

/**
 * Commentaires d'un article : liste à plat (du plus ancien au plus récent),
 * formulaire pour les membres, modification / suppression par l'auteur,
 * masquage par le commissaire. Un commentaire masqué n'est servi qu'à son
 * auteur et aux modérateurs, avec la raison.
 */

import { useCallback, useEffect, useState } from "react";
import {
  authorLabel,
  BLOG_COMMENT_MAX,
  createBlogComment,
  deleteBlogComment,
  formatBlogDate,
  hiddenReasonLabel,
  listBlogComments,
  moderateBlogComment,
  updateBlogComment,
  type BlogComment,
  type BlogCompetition,
  type BlogViewer,
} from "../../lib/competition-blog";

interface PostCommentsProps {
  readonly competition: BlogCompetition;
  readonly postId: string;
  readonly viewer: BlogViewer;
}

export default function PostComments({ competition, postId, viewer }: PostCommentsProps) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const res = await listBlogComments(competition, postId, nextPage);
        setComments((prev) => (nextPage === 1 ? res.comments : [...prev, ...res.comments]));
        setTotal(res.total);
        setPage(nextPage);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Chargement impossible");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clé = (kind, id)
    [competition.kind, competition.id, postId],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      const created = await createBlogComment(competition, postId, draft);
      setComments((prev) => [...prev, created]);
      setTotal((t) => t + 1);
      setDraft("");
    });

  const replace = (updated: BlogComment) =>
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const saveEdit = (id: string) =>
    run(async () => {
      replace(await updateBlogComment(competition, id, editBody));
      setEditingId(null);
    });

  const remove = (id: string) =>
    run(async () => {
      if (!window.confirm("Supprimer ce commentaire ?")) return;
      await deleteBlogComment(competition, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    });

  const moderate = (comment: BlogComment) =>
    run(async () => {
      const hide = !comment.hidden;
      const reason = hide ? window.prompt("Raison du masquage (facultatif) :") : null;
      if (hide && reason === null) return;
      replace(await moderateBlogComment(competition, comment.id, hide, reason));
    });

  return (
    <section className="space-y-4" data-testid="post-comments">
      <h2 className="text-xl font-heading font-bold text-nuffle-anthracite">
        💬 Commentaires ({total})
      </h2>

      {comments.length === 0 && !loading && (
        <p className="text-sm text-gray-500">Aucun commentaire pour l'instant.</p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border p-3 ${c.hidden ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"}`}
            data-testid="post-comment"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-nuffle-anthracite">{authorLabel(c.author)}</span>
              <span className="text-gray-500">
                {formatBlogDate(c.createdAt)}
                {c.editedAt && " · modifié"}
              </span>
            </div>
            {c.hidden && (
              <p className="mt-1 text-xs font-medium text-amber-800">{hiddenReasonLabel(c.hidden)}</p>
            )}
            {editingId === c.id ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editBody}
                  maxLength={BLOG_COMMENT_MAX}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full rounded border border-gray-300 p-2 text-sm"
                  rows={3}
                  aria-label="Modifier le commentaire"
                />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !editBody.trim()} onClick={() => saveEdit(c.id)} className="rounded bg-nuffle-gold px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
                    Enregistrer
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded border px-3 py-1 text-sm">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{c.body}</p>
            )}
            {(c.viewer.canEdit || c.viewer.canDelete || viewer.canModerate) && editingId !== c.id && (
              <div className="mt-2 flex gap-3 text-xs">
                {c.viewer.canEdit && (
                  <button type="button" className="text-nuffle-bronze hover:underline" onClick={() => { setEditingId(c.id); setEditBody(c.body); }}>
                    Modifier
                  </button>
                )}
                {c.viewer.canDelete && (
                  <button type="button" className="text-red-600 hover:underline" onClick={() => remove(c.id)}>
                    Supprimer
                  </button>
                )}
                {viewer.canModerate && (
                  <button type="button" className="text-amber-700 hover:underline" onClick={() => moderate(c)}>
                    {c.hidden ? "Rétablir" : "Masquer"}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {comments.length < total && (
        <button type="button" disabled={loading} onClick={() => load(page + 1)} className="text-sm text-nuffle-bronze hover:underline">
          Voir plus de commentaires
        </button>
      )}

      {viewer.canComment ? (
        <form
          className="space-y-2"
          data-testid="post-comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) void submit();
          }}
        >
          <textarea
            value={draft}
            maxLength={BLOG_COMMENT_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Votre commentaire…"
            aria-label="Votre commentaire"
            className="w-full rounded border border-gray-300 p-2 text-sm"
            rows={3}
          />
          <button type="submit" disabled={busy || !draft.trim()} className="rounded bg-nuffle-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Commenter
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500">
          Les commentaires sont réservés aux coachs de la compétition.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
