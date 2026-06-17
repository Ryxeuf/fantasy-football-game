"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../auth-client";
import {
  listAdminBlogPosts,
  deleteAdminBlogPost,
  type BlogPostListItem,
} from "./api";

async function fetchMe(): Promise<{ roles: string[] }> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return { roles: [] };
  const data = (await res.json()) as { user?: { roles?: string[]; role?: string } };
  const roles = Array.isArray(data.user?.roles)
    ? data.user!.roles!
    : data.user?.role
      ? [data.user.role]
      : [];
  return { roles };
}

const STATUS_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "published", label: "Publiés" },
] as const;

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchMe();
      if (!me.roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      const data = await listAdminBlogPosts({
        status: status || undefined,
        search: search || undefined,
      });
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer définitivement l'article « ${title} » ?`)) return;
    try {
      await deleteAdminBlogPost(id);
      setPosts((current) => current.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la suppression");
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            📝 Blog
          </h1>
          <p className="text-sm text-gray-600">
            Articles rédigés en WYSIWYG. Brouillons invisibles côté public.
          </p>
        </div>
        <Link
          href={"/admin/blog/new" as never}
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md transition-all flex items-center gap-2"
        >
          <span>+</span>
          <span>Nouvel article</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-3 flex-wrap items-center">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "" | "draft" | "published")}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none bg-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Rechercher titre ou slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2.5 flex-1 min-w-[200px] focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-nuffle-anthracite text-white rounded-lg font-medium hover:bg-nuffle-anthracite/80 transition-colors"
          >
            Rechercher
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Titre
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Slug
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Auteur
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  MAJ
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun article pour le moment.
                  </td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {post.title}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {post.slug}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          post.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {post.status === "published" ? "Publié" : "Brouillon"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {post.author?.coachName ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(post.updatedAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/blog/${post.id}/edit` as never}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nuffle-gold/10 text-nuffle-bronze rounded-lg hover:bg-nuffle-gold/20 transition-colors text-sm font-medium"
                        >
                          ✏️ Modifier
                        </Link>
                        <Link
                          href={`/blog/preview/${post.id}` as never}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                        >
                          👁 Aperçu
                        </Link>
                        {post.status === "published" && (
                          <Link
                            href={`/blog/${post.slug}` as never}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                          >
                            👁 Voir
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(post.id, post.title)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
