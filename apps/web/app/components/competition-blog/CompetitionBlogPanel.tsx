"use client";

/**
 * Bloc « 📰 Blog » de la fiche d'une ligue ou d'une coupe : les trois
 * derniers articles visibles, un lien vers le blog complet et, pour un
 * membre, le bouton de rédaction. Autonome (charge sa liste), gaté par le
 * flag `competition_blog` ; une compétition invisible (404) masque le bloc.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { COMPETITION_BLOG_FLAG } from "../../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { dynamicRoute } from "../../lib/typed-route";
import {
  blogPagePath,
  listBlogPosts,
  type BlogCompetition,
  type BlogPost,
  type BlogViewer,
} from "../../lib/competition-blog";
import PostCard from "./PostCard";

export const PANEL_POST_COUNT = 3;

export default function CompetitionBlogPanel({ competition }: { readonly competition: BlogCompetition }) {
  const enabled = useFeatureFlagOrOff(COMPETITION_BLOG_FLAG);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [viewer, setViewer] = useState<BlogViewer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listBlogPosts(competition, { limit: PANEL_POST_COUNT })
      .then((res) => {
        if (!alive) return;
        setPosts([...res.pinned, ...res.posts].slice(0, PANEL_POST_COUNT));
        setViewer(res.viewer);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clé = (kind, id)
  }, [enabled, competition.kind, competition.id]);

  if (!enabled || failed || !viewer) return null;

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="competition-blog-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-heading font-bold text-nuffle-anthracite">📰 Blog</h2>
        <div className="flex gap-2 text-sm">
          {viewer.canWrite && (
            <Link
              href={dynamicRoute(blogPagePath(competition, "/new"))}
              className="rounded bg-nuffle-gold px-3 py-1.5 font-semibold text-white"
              data-testid="blog-write-button"
            >
              ✍️ Écrire un article
            </Link>
          )}
          <Link href={dynamicRoute(blogPagePath(competition))} className="rounded border border-gray-300 bg-white px-3 py-1.5">
            Tout le blog
          </Link>
        </div>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucun article pour l'instant.
          {viewer.canWrite && " Racontez votre dernier match !"}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} competition={competition} post={p} compact />
          ))}
        </div>
      )}
    </section>
  );
}
