"use client";

/**
 * Page « Blog » d'une compétition : articles épinglés, puis les plus récents,
 * paginés ; onglet « Mes brouillons » pour un auteur. Servie à l'identique
 * sous `/leagues/[id]/blog` et `/cups/[id]/blog`.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiClientError } from "../../lib/api-client";
import { COMPETITION_BLOG_FLAG } from "../../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../../hooks/useFeatureFlag";
import { dynamicRoute } from "../../lib/typed-route";
import {
  blogPagePath,
  competitionPagePath,
  listBlogPosts,
  type BlogCompetition,
  type BlogPostList,
} from "../../lib/competition-blog";
import BlogUnavailable from "./BlogUnavailable";
import PostCard from "./PostCard";

const PAGE_SIZE = 10;

export default function CompetitionBlogPage({ competition }: { readonly competition: BlogCompetition }) {
  const enabled = useFeatureFlagOrOff(COMPETITION_BLOG_FLAG);
  const [tab, setTab] = useState<"published" | "drafts">("published");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BlogPostList | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listBlogPosts(competition, { page, limit: PAGE_SIZE, drafts: tab === "drafts" })
      .then((res) => alive && setData(res))
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiClientError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Chargement impossible");
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- clé = (kind, id)
  }, [enabled, competition.kind, competition.id, page, tab]);

  if (!enabled) return <BlogUnavailable />;
  if (notFound) return <BlogUnavailable message="Compétition introuvable." />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={dynamicRoute(competitionPagePath(competition))} className="text-sm text-nuffle-bronze hover:underline">
            ← Retour à la {competition.kind === "league" ? "ligue" : "coupe"}
          </Link>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">📰 Blog</h1>
        </div>
        {data?.viewer.canWrite && (
          <Link
            href={dynamicRoute(blogPagePath(competition, "/new"))}
            className="rounded bg-nuffle-gold px-4 py-2 font-semibold text-white"
            data-testid="blog-write-button"
          >
            ✍️ Écrire un article
          </Link>
        )}
      </div>

      {data?.viewer.canWrite && (
        <div className="flex gap-2 text-sm" role="tablist">
          {(["published", "drafts"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 ${tab === t ? "bg-nuffle-anthracite text-white" : "bg-gray-100"}`}
            >
              {t === "published" ? "Articles" : "Mes brouillons"}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-500">Chargement…</p>}

      {data && (
        <>
          {data.pinned.length + data.posts.length === 0 && (
            <p className="text-gray-500" data-testid="blog-empty">
              {tab === "drafts" ? "Aucun brouillon." : "Aucun article pour l'instant."}
            </p>
          )}
          <div className="space-y-3">
            {[...data.pinned, ...data.posts].map((post) => (
              <PostCard key={post.id} competition={competition} post={post} />
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                Précédent
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40">
                Suivant
              </button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
