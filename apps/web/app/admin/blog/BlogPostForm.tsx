"use client";

import { useState } from "react";
import BlogEditor from "./BlogEditor";
import CoverImageField from "./CoverImageField";
import type { BlogPostInput } from "./api";

interface BlogPostFormProps {
  initial?: Partial<BlogPostInput>;
  submitLabel: string;
  onSubmit: (input: BlogPostInput) => Promise<void>;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export default function BlogPostForm({
  initial,
  submitLabel,
  onSubmit,
}: BlogPostFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(
    initial?.coverImageUrl ?? "",
  );
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    initial?.status ?? "draft",
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    Boolean(initial?.slug),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) {
      setError("Le titre doit contenir au moins 3 caractères");
      return;
    }
    if (!SLUG_REGEX.test(slug)) {
      setError(
        "Le slug doit être en kebab-case (lettres minuscules, chiffres et tirets)",
      );
      return;
    }
    if (contentHtml.replace(/<[^>]*>/g, "").trim().length < 1) {
      setError("Le contenu ne peut pas être vide");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        slug,
        excerpt: excerpt.trim() ? excerpt.trim() : null,
        coverImageUrl: coverImageUrl.trim() ? coverImageUrl.trim() : null,
        contentHtml,
        status,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Titre <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            maxLength={200}
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
            placeholder="Mon super article"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Slug (URL) <span className="text-red-600">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-mono">/blog/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              maxLength={120}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 font-mono focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
              placeholder="mon-super-article"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Auto-généré depuis le titre. Modifie pour personnaliser.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Résumé
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={280}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none"
            placeholder="Résumé court (max 280 chars) pour les listings et meta description SEO"
          />
          <p className="text-xs text-gray-500 mt-1">
            {excerpt.length}/280 caractères
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Image de couverture
          </label>
          <CoverImageField value={coverImageUrl} onChange={setCoverImageUrl} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Contenu <span className="text-red-600">*</span>
        </label>
        <BlogEditor
          value={contentHtml}
          onChange={setContentHtml}
          placeholder="Rédigez votre article ici…"
        />
        <p className="text-xs text-gray-500 mt-2">
          HTML sanitizé côté serveur (allowlist : titres, listes, gras,
          italique, liens, images, code). Les balises non autorisées sont
          supprimées.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Statut :
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-nuffle-gold outline-none bg-white"
          >
            <option value="draft">Brouillon (invisible)</option>
            <option value="published">Publié (visible côté public)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
