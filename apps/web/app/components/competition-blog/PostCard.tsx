"use client";

/** Carte d'un article dans une liste (fiche de compétition, page du blog). */

import Link from "next/link";
import { dynamicRoute } from "../../lib/typed-route";
import {
  authorLabel,
  blogPostPagePath,
  formatBlogDate,
  REACTIONS,
  type BlogCompetition,
  type BlogPost,
} from "../../lib/competition-blog";

interface PostCardProps {
  readonly competition: BlogCompetition;
  readonly post: BlogPost;
  readonly compact?: boolean;
}

export default function PostCard({ competition, post, compact = false }: PostCardProps) {
  const reactionTotal = REACTIONS.reduce((n, r) => n + (post.reactions.counts[r.kind] ?? 0), 0);
  return (
    <article
      className={`rounded-lg border bg-white p-4 ${post.hidden ? "border-amber-300" : "border-gray-200"}`}
      data-testid="blog-post-card"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {post.pinned && <span className="font-semibold text-nuffle-bronze">📌 Épinglé</span>}
        {post.status === "draft" && <span className="font-semibold text-gray-700">✏️ Brouillon</span>}
        {post.hidden && <span className="font-semibold text-amber-700">🚫 Masqué</span>}
        <span>{authorLabel(post.author)}</span>
        {post.publishedAt && <span>· {formatBlogDate(post.publishedAt)}</span>}
        {post.seasonNumber !== null && <span>· Saison {post.seasonNumber}</span>}
      </div>
      <h3 className="mt-1 text-lg font-heading font-bold text-nuffle-anthracite">
        <Link href={dynamicRoute(blogPostPagePath(competition, post.id))} className="hover:underline">
          {post.title}
        </Link>
      </h3>
      {!compact && post.excerpt && <p className="mt-1 text-sm text-gray-700">{post.excerpt}</p>}
      <div className="mt-2 flex gap-3 text-xs text-gray-500">
        <span>💬 {post.commentCount}</span>
        <span>✨ {reactionTotal}</span>
      </div>
    </article>
  );
}
