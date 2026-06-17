import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchServerJson, getServerApiBase } from "../../lib/serverApi";
import { safeJsonLd } from "../../lib/safe-json-ld";
import BlogArticle from "../BlogArticle";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const revalidate = 300;

interface BlogPostDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  updatedAt: string;
  authorName: string | null;
}

interface BlogDetailResponse {
  post: BlogPostDetail;
}

interface BlogPostPageProps {
  params: { slug: string };
}

async function fetchPost(slug: string): Promise<BlogPostDetail | null> {
  const base = getServerApiBase();
  const data = await fetchServerJson<BlogDetailResponse>(
    `${base}/api/blog/posts/${encodeURIComponent(slug)}`,
    { next: { revalidate: 300 } },
  );
  return data?.post ?? null;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) {
    return { title: "Article introuvable" };
  }
  const url = `${BASE_URL}/blog/${post.slug}`;
  const description =
    post.excerpt ?? "Article du blog Nuffle Arena.";
  return {
    title: `${post.title} — Blog Nuffle Arena`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImageUrl ?? undefined,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    author: post.authorName
      ? { "@type": "Person", name: post.authorName }
      : undefined,
    mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`,
  };

  return (
    <div className="w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <nav className="max-w-3xl mx-auto mb-6 text-sm">
        <Link
          href={"/blog" as never}
          className="text-nuffle-bronze hover:underline"
        >
          ← Tous les articles
        </Link>
      </nav>

      <BlogArticle post={post} />
    </div>
  );
}
