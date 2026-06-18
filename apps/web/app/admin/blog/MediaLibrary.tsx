"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listBlogImages,
  uploadBlogImage,
  updateBlogImageAlt,
  deleteBlogImage,
  BlogImageInUseError,
  type BlogImage,
} from "./api";

const LIMIT = 24;

type SortKey = "date" | "name" | "size";

interface MediaLibraryProps {
  /** "manage" = édition complète (alt, suppression) ; "picker" = sélection. */
  mode: "manage" | "picker";
  /** Picker : appelé au clic sur une image. */
  onSelect?: (image: BlogImage) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(ta);
    }
  }
}

export default function MediaLibrary({ mode, onSelect }: MediaLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<BlogImage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Debounce de la recherche.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Retour à la page 1 quand les filtres changent.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort]);

  // Chargement (page 1 = remplace, pages suivantes = append).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBlogImages({
      search: debouncedSearch || undefined,
      sort,
      page,
      limit: LIMIT,
    })
      .then((res) => {
        if (cancelled) return;
        setTotal(res.total);
        setImages((prev) =>
          page === 1 ? res.images : [...prev, ...res.images],
        );
        setError(null);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Erreur de chargement");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, sort, page, reloadKey]);

  const reload = useCallback(() => {
    setPage(1);
    setReloadKey((k) => k + 1);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(
        (f) =>
          f.type.startsWith("image/") ||
          /\.(png|jpe?g|gif|webp)$/i.test(f.name),
      );
      if (list.length === 0) return;
      setUploadError(null);
      setUploading(true);
      try {
        for (const file of list) {
          await uploadBlogImage(file, file.name);
        }
        reload();
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Échec de l'upload");
      } finally {
        setUploading(false);
      }
    },
    [reload],
  );

  const handleCopy = useCallback(async (img: BlogImage) => {
    await copyToClipboard(img.url);
    setCopied(img.filename);
    setTimeout(() => setCopied((c) => (c === img.filename ? null : c)), 1500);
  }, []);

  const handleAltSave = useCallback(async (filename: string, alt: string) => {
    try {
      const updated = await updateBlogImageAlt(
        filename,
        alt.trim() ? alt.trim() : null,
      );
      setImages((prev) =>
        prev.map((i) => (i.filename === filename ? updated : i)),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Échec de l'enregistrement du texte alternatif",
      );
    }
  }, []);

  const handleDelete = useCallback(async (img: BlogImage) => {
    if (!window.confirm(`Supprimer définitivement « ${img.filename} » ?`))
      return;
    const remove = () => {
      setImages((prev) => prev.filter((i) => i.filename !== img.filename));
      setTotal((t) => Math.max(0, t - 1));
    };
    try {
      await deleteBlogImage(img.filename);
      remove();
    } catch (e) {
      if (e instanceof BlogImageInUseError) {
        const titles = e.referencedBy.map((p) => `« ${p.title} »`).join(", ");
        const ok = window.confirm(
          `Cette image est utilisée par ${e.referencedBy.length} article(s) : ${titles}.\n` +
            `Supprimer quand même ? Ces articles afficheront une image cassée.`,
        );
        if (!ok) return;
        try {
          await deleteBlogImage(img.filename, { force: true });
          remove();
        } catch (e2) {
          setError(
            e2 instanceof Error ? e2.message : "Échec de la suppression",
          );
        }
      } else {
        setError(e instanceof Error ? e.message : "Échec de la suppression");
      }
    }
  }, []);

  const canLoadMore = images.length < total;

  return (
    <div data-testid="media-library" className="space-y-4">
      {/* Barre d'actions : upload + recherche + tri */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-sm transition-all disabled:opacity-60"
        >
          {uploading ? "Envoi…" : "⬆️ Uploader des images"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          data-testid="media-upload-input"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom…"
          data-testid="media-search"
          className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-nuffle-gold outline-none"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          data-testid="media-sort"
          className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-nuffle-gold outline-none"
        >
          <option value="date">Plus récentes</option>
          <option value="name">Nom (A→Z)</option>
          <option value="size">Taille</option>
        </select>
      </div>

      {uploadError && (
        <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          ⚠️ {uploadError}
        </div>
      )}

      {/* Zone de drag & drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragOver ? "border-nuffle-gold bg-nuffle-gold/5" : "border-gray-200"
        }`}
      >
        {error && (
          <div className="px-4 py-2 mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {loading && images.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Chargement…</p>
        ) : images.length === 0 ? (
          <p className="text-center text-gray-400 py-10">
            Aucune image. Glisse-dépose des fichiers ici ou clique sur «
            Uploader ».
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img) => (
              <li
                key={img.filename}
                data-testid="media-card"
                className="border border-gray-200 rounded-lg overflow-hidden bg-white flex flex-col"
              >
                <button
                  type="button"
                  onClick={
                    mode === "picker" ? () => onSelect?.(img) : undefined
                  }
                  data-testid={
                    mode === "picker"
                      ? `media-select-${img.filename}`
                      : undefined
                  }
                  className={`block aspect-video bg-gray-50 ${
                    mode === "picker"
                      ? "cursor-pointer hover:opacity-80"
                      : "cursor-default"
                  }`}
                  aria-label={
                    mode === "picker" ? `Choisir ${img.filename}` : undefined
                  }
                  tabIndex={mode === "picker" ? 0 : -1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt ?? img.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </button>

                <div className="p-2 text-xs space-y-1.5 flex-1 flex flex-col">
                  <p
                    className="font-mono truncate text-gray-700"
                    title={img.filename}
                  >
                    {img.filename}
                  </p>
                  <p className="text-gray-400">
                    {img.width && img.height
                      ? `${img.width}×${img.height} · `
                      : ""}
                    {formatBytes(img.bytes)} · {formatDate(img.uploadedAt)}
                  </p>

                  {mode === "manage" && (
                    <input
                      type="text"
                      defaultValue={img.alt ?? ""}
                      placeholder="Texte alternatif (alt)…"
                      data-testid={`media-alt-${img.filename}`}
                      maxLength={300}
                      onBlur={(e) => {
                        const next = e.target.value;
                        if (next.trim() !== (img.alt ?? "").trim()) {
                          void handleAltSave(img.filename, next);
                        }
                      }}
                      className="w-full border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-nuffle-gold outline-none"
                    />
                  )}

                  <div className="flex gap-1.5 mt-auto pt-1">
                    <button
                      type="button"
                      onClick={() => void handleCopy(img)}
                      data-testid={`media-copy-${img.filename}`}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                      title="Copier l'URL"
                    >
                      {copied === img.filename ? "✓ Copié" : "📋 URL"}
                    </button>
                    {mode === "picker" && (
                      <button
                        type="button"
                        onClick={() => onSelect?.(img)}
                        className="flex-1 px-2 py-1 bg-nuffle-gold text-white rounded hover:bg-nuffle-gold/90 transition-colors"
                      >
                        Choisir
                      </button>
                    )}
                    {mode === "manage" && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(img)}
                        data-testid={`media-delete-${img.filename}`}
                        className="px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pied : compteur + charger plus */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {total} image{total > 1 ? "s" : ""}
        </span>
        {canLoadMore && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            data-testid="media-load-more"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-60"
          >
            {loading ? "Chargement…" : "Charger plus"}
          </button>
        )}
      </div>
    </div>
  );
}
