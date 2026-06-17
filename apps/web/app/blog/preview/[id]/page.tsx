"use client";

/**
 * Aperçu admin d'un article (brouillon ou publié) rendu dans le chrome public
 * réel du site, via le composant partagé `BlogArticle` — donc strictement le
 * « rendu final ». Réservé aux admins : la donnée provient de l'API admin
 * (`getAdminBlogPost`, middleware authUser + adminOnly). Un non-admin reçoit
 * une erreur 401/403 et voit un message, jamais le contenu.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import BlogArticle, { type BlogArticleData } from "../../BlogArticle";
import { getAdminBlogPost } from "../../../admin/blog/api";

export default function BlogPreviewPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<BlogArticleData | null>(null);
  const [status, setStatus] = useState<"draft" | "published" | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    void (async () => {
      try {
        const detail = await getAdminBlogPost(params.id);
        setStatus(detail.status);
        setSlug(detail.slug);
        setPost({
          title: detail.title,
          excerpt: detail.excerpt,
          contentHtml: detail.contentHtml,
          coverImageUrl: detail.coverImageUrl,
          publishedAt: detail.publishedAt,
          authorName: detail.author?.coachName ?? null,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement de l’aperçu…</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error ?? "Article introuvable"}
        </div>
        <Link
          href={"/admin/blog" as never}
          className="text-sm text-blue-600 underline"
        >
          ← Retour à l’administration du blog
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-amber-900">
          <span>👁</span>
          <span className="font-semibold">Aperçu</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === "published"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-200 text-amber-900"
            }`}
          >
            {status === "published" ? "Publié" : "Brouillon — non publié"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {status === "published" && slug && (
            <Link
              href={`/blog/${slug}` as never}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline"
            >
              Voir la page publique
            </Link>
          )}
          <Link
            href={"/admin/blog" as never}
            className="text-gray-600 hover:text-gray-900 underline"
          >
            ← Retour à l’admin
          </Link>
        </div>
      </div>

      <BlogArticle post={post} />
    </div>
  );
}
