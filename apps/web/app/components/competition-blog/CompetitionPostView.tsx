"use client";

/**
 * Page d'un article : couverture, en-tête (auteur, date, saison, « modifié »),
 * corps assaini, réactions, commentaires, et les actions que le serveur
 * accorde au lecteur (modifier, publier / dépublier, supprimer ; épingler et
 * masquer pour le commissaire).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiClientError } from "../../lib/api-client";
import { COMPETITION_BLOG_FLAG } from "../../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { dynamicRoute } from "../../lib/typed-route";
import {
  authorLabel,
  blogPagePath,
  deleteBlogPost,
  formatBlogDate,
  getBlogPost,
  hiddenReasonLabel,
  postAction,
  type BlogCompetition,
  type BlogPost,
  type BlogViewer,
  type PostAction,
} from "../../lib/competition-blog";
import BlogUnavailable from "./BlogUnavailable";
import PostComments from "./PostComments";
import PostReactions from "./PostReactions";
import SafeHtml from "./SafeHtml";

interface CompetitionPostViewProps {
  readonly competition: BlogCompetition;
  readonly postId: string;
}

const ACTION_BTN = "rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-100";

export default function CompetitionPostView({ competition, postId }: CompetitionPostViewProps) {
  const enabled = useFeatureFlagOrOff(COMPETITION_BLOG_FLAG);
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [viewer, setViewer] = useState<BlogViewer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getBlogPost(competition, postId)
      .then((res) => {
        if (!alive) return;
        setPost(res.post);
        setViewer(res.viewer);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiClientError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Chargement impossible");
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clé = (kind, id)
  }, [enabled, competition.kind, competition.id, postId]);

  if (!enabled) return <BlogUnavailable />;
  if (notFound) return <BlogUnavailable message="Article introuvable." />;
  if (!post || !viewer) {
    return <p className="p-6 text-gray-500">{error ?? "Chargement…"}</p>;
  }

  const act = async (action: PostAction) => {
    let reason: string | null = null;
    if (action === "hide") {
      reason = window.prompt("Raison du masquage (facultatif) :");
      if (reason === null) return;
    }
    setBusy(true);
    setError(null);
    try {
      setPost(await postAction(competition, post.id, action, reason));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer définitivement cet article ?")) return;
    setBusy(true);
    try {
      await deleteBlogPost(competition, post.id);
      router.push(dynamicRoute(blogPagePath(competition)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
      setBusy(false);
    }
  };

  const published = post.status === "published";

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4">
      <Link href={dynamicRoute(blogPagePath(competition))} className="text-sm text-nuffle-bronze hover:underline">
        ← Tout le blog
      </Link>

      {post.hidden && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" data-testid="post-hidden-banner">
          {hiddenReasonLabel(post.hidden)} — seuls l'auteur et la modération voient cet article.
        </p>
      )}
      {!published && (
        <p className="rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          ✏️ Brouillon : visible de vous seul.
        </p>
      )}

      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="h-auto w-full rounded-xl" />
      )}

      <header className="space-y-2">
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">{post.title}</h1>
        <p className="text-sm text-gray-600">
          {post.pinned && "📌 "}
          {authorLabel(post.author)}
          {post.publishedAt && ` · ${formatBlogDate(post.publishedAt)}`}
          {post.seasonNumber !== null && ` · Saison ${post.seasonNumber}`}
          {post.editedAt && ` · modifié le ${formatBlogDate(post.editedAt)}`}
        </p>
      </header>

      {post.contentHtml && (
        <SafeHtml
          html={post.contentHtml}
          className="prose max-w-none prose-headings:font-heading prose-headings:text-nuffle-anthracite prose-a:text-nuffle-bronze"
        />
      )}

      {(post.viewer.canEdit || post.viewer.canDelete || viewer.canModerate) && (
        <div className="flex flex-wrap gap-2" data-testid="post-moderation-menu">
          {post.viewer.canEdit && (
            <>
              <Link href={dynamicRoute(blogPagePath(competition, `/${post.id}/edit`))} className={ACTION_BTN}>
                ✏️ Modifier
              </Link>
              <button type="button" disabled={busy} className={ACTION_BTN} onClick={() => act(published ? "unpublish" : "publish")}>
                {published ? "Repasser en brouillon" : "Publier"}
              </button>
            </>
          )}
          {viewer.canModerate && published && (
            <button type="button" disabled={busy} className={ACTION_BTN} onClick={() => act(post.pinned ? "unpin" : "pin")}>
              {post.pinned ? "Désépingler" : "📌 Épingler"}
            </button>
          )}
          {viewer.canModerate && (
            <button type="button" disabled={busy} className={ACTION_BTN} onClick={() => act(post.hidden ? "unhide" : "hide")}>
              {post.hidden ? "Rétablir" : "🚫 Masquer"}
            </button>
          )}
          {post.viewer.canDelete && (
            <button type="button" disabled={busy} className={`${ACTION_BTN} text-red-600`} onClick={remove}>
              🗑️ Supprimer
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {published && !post.hidden && (
        <>
          <PostReactions
            competition={competition}
            postId={post.id}
            initial={post.reactions}
            canReact={viewer.canReact}
          />
          <PostComments competition={competition} postId={post.id} viewer={viewer} />
        </>
      )}
    </main>
  );
}
