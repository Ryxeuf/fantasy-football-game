import type { Metadata } from "next";
import Link from "next/link";
import { fetchServerJson, getServerApiBase } from "../lib/serverApi";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const revalidate = 300;

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

async function fetchBlogPosts(): Promise<BlogListResponse> {
  const base = getServerApiBase();
  const data = await fetchServerJson<BlogListResponse>(
    `${base}/api/blog/posts`,
    { next: { revalidate: 300 } },
  );
  return data ?? { posts: [], total: 0, page: 1, limit: 20 };
}

export const metadata: Metadata = {
  title: "Blog Nuffle Arena — Actualités, guides et coulisses",
  description:
    "Articles, guides et actualités autour de Blood Bowl et de Nuffle Arena.",
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: "Blog Nuffle Arena",
    description:
      "Articles, guides et actualités autour de Blood Bowl et de Nuffle Arena.",
    url: `${BASE_URL}/blog`,
    type: "website",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogIndexPage() {
  const { posts } = await fetchBlogPosts();

  return (
    <div className="w-full">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold text-nuffle-anthracite mb-3">
          Blog
        </h1>
        <p className="text-base text-gray-600 max-w-2xl">
          Articles, guides et actualités autour de Blood Bowl et de Nuffle Arena.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            Aucun article pour le moment. Reviens bientôt !
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
            >
              <Link
                href={`/blog/${post.slug}` as never}
                className="flex flex-col flex-1"
              >
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
                    <span className="text-5xl">📝</span>
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="text-xl font-heading font-bold text-nuffle-anthracite mb-2 group-hover:text-nuffle-bronze line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 flex items-center gap-2 pt-3 border-t border-gray-100">
                    {post.authorName && <span>{post.authorName}</span>}
                    {post.authorName && post.publishedAt && <span>·</span>}
                    {post.publishedAt && (
                      <time dateTime={post.publishedAt}>
                        {formatDate(post.publishedAt)}
                      </time>
                    )}
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
