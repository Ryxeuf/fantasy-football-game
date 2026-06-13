"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";

interface BlogPostListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  authorName: string | null;
}

interface BlogListResponse {
  posts: BlogPostListItem[];
  total: number;
  page: number;
  limit: number;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LatestBlogPosts() {
  const { t, language } = useLanguage();
  const [posts, setPosts] = useState<BlogPostListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<BlogListResponse>("/api/blog/posts?limit=3")
      .then((data) => {
        if (!cancelled) setPosts(data.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!posts || posts.length === 0) return null;

  const dateLocale = language === "en" ? "en-US" : "fr-FR";

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8 gap-3">
        <div>
          <p className="font-subtitle text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-nuffle-gold/90">
            {t.home.blogKicker}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">
            {t.home.latestNewsTitle}
          </h2>
          <p className="mt-1 text-base text-nuffle-bronze/90 font-body">
            {t.home.latestNewsSubtitle}
          </p>
        </div>
        <a
          href="/blog"
          className="inline-flex items-center gap-1.5 text-nuffle-bronze hover:text-nuffle-gold font-subtitle font-semibold whitespace-nowrap transition-colors"
        >
          {t.home.latestNewsSeeAll} <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article
            key={post.id}
            className="group bg-[#FBF7EC] rounded-2xl border border-nuffle-bronze/20 shadow-[0_2px_10px_rgba(107,78,46,0.06)] hover:shadow-[0_10px_30px_rgba(107,78,46,0.14)] hover:border-nuffle-gold/60 hover:-translate-y-1 transition-all overflow-hidden flex flex-col"
          >
            <a href={`/blog/${post.slug}`} className="flex flex-col flex-1">
              {post.coverImageUrl ? (
                <div className="w-full aspect-[16/9] bg-[#1B1610] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImageUrl}
                    alt={post.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[16/9] bg-[#1B1610] flex items-center justify-center relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-[0.08] bg-[repeating-linear-gradient(115deg,transparent,transparent_24px,#E8C96A_24px,#E8C96A_25px)]"
                    aria-hidden="true"
                  />
                  <span className="font-logo text-nuffle-gold/80 text-xl tracking-widest" aria-hidden="true">
                    NUFFLE
                  </span>
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-heading font-bold text-nuffle-anthracite mb-2 line-clamp-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-nuffle-anthracite/75 mb-4 line-clamp-3 flex-1 font-body">
                    {post.excerpt}
                  </p>
                )}
                <div className="text-xs text-nuffle-bronze/70 flex items-center gap-2 pt-3 border-t border-nuffle-bronze/15">
                  {post.authorName && <span>{post.authorName}</span>}
                  {post.authorName && post.publishedAt && <span aria-hidden="true">·</span>}
                  {post.publishedAt && (
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt, dateLocale)}
                    </time>
                  )}
                </div>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
