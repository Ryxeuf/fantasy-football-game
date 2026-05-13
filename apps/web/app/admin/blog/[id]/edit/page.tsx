"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BlogPostForm from "../../BlogPostForm";
import {
  getAdminBlogPost,
  updateAdminBlogPost,
  type BlogPostDetail,
} from "../../api";

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params?.id) return;
    void (async () => {
      try {
        setPost(await getAdminBlogPost(params.id));
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
          <p className="text-gray-600">Chargement…</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error ?? "Article introuvable"}
        </div>
        <Link
          href={"/admin/blog" as never}
          className="text-sm text-blue-600 underline"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ✏️ Éditer : {post.title}
          </h1>
          <p className="text-sm text-gray-600">
            Statut actuel :{" "}
            <span className="font-semibold">
              {post.status === "published" ? "Publié" : "Brouillon"}
            </span>
            {post.publishedAt && (
              <>
                {" · Publié le "}
                {new Date(post.publishedAt).toLocaleDateString("fr-FR")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {post.status === "published" && (
            <Link
              href={`/blog/${post.slug}` as never}
              target="_blank"
              rel="noreferrer"
              className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              👁 Voir publié
            </Link>
          )}
          <Link
            href={"/admin/blog" as never}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ← Retour
          </Link>
        </div>
      </div>

      <BlogPostForm
        submitLabel="Enregistrer"
        initial={{
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? "",
          coverImageUrl: post.coverImageUrl ?? "",
          contentHtml: post.contentHtml,
          status: post.status,
        }}
        onSubmit={async (input) => {
          const updated = await updateAdminBlogPost(post.id, input);
          setPost(updated);
          router.refresh();
        }}
      />
    </div>
  );
}
