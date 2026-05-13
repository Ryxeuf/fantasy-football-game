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
    <section className="w-full px-4 sm:px-6 pb-8 md:pb-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite">
              {t.home.latestNewsTitle}
            </h2>
            <p className="mt-1 text-base text-nuffle-anthracite/70 font-body">
              {t.home.latestNewsSubtitle}
            </p>
          </div>
          <a
            href="/blog"
            className="text-nuffle-bronze hover:underline font-subtitle font-semibold whitespace-nowrap"
          >
            {t.home.latestNewsSeeAll} →
          </a>
        </div>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-xl border-2 border-nuffle-bronze/30 shadow-sm hover:shadow-md hover:border-nuffle-gold/50 transition-all overflow-hidden flex flex-col"
            >
              <a href={`/blog/${post.slug}`} className="flex flex-col flex-1">
                {post.coverImageUrl ? (
                  <div className="w-full aspect-[16/9] bg-gray-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-[16/9] bg-gradient-to-br from-nuffle-gold/20 to-nuffle-bronze/20 flex items-center justify-center">
                    <span className="text-5xl" aria-hidden="true">
                      📝
                    </span>
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-lg font-heading font-bold text-nuffle-anthracite mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-nuffle-anthracite/80 mb-4 line-clamp-3 flex-1 font-body">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="text-xs text-nuffle-anthracite/60 flex items-center gap-2 pt-3 border-t border-gray-100">
                    {post.authorName && <span>{post.authorName}</span>}
                    {post.authorName && post.publishedAt && <span>·</span>}
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
      </div>
    </section>
  );
}
