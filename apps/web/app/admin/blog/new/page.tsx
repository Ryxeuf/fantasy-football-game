"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BlogPostForm from "../BlogPostForm";
import { createAdminBlogPost } from "../api";

export default function NewBlogPostPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            ✏️ Nouvel article
          </h1>
          <p className="text-sm text-gray-600">
            Crée un brouillon ou publie directement.
          </p>
        </div>
        <Link
          href={"/admin/blog" as never}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          ← Retour à la liste
        </Link>
      </div>

      <BlogPostForm
        submitLabel="Créer l'article"
        onSubmit={async (input) => {
          const post = await createAdminBlogPost(input);
          router.push(`/admin/blog/${post.id}/edit` as never);
        }}
      />
    </div>
  );
}
