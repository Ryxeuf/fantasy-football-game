"use client";

import { useRef, useState } from "react";
import { uploadBlogImage } from "./api";
import MediaLibraryModal from "./MediaLibraryModal";

interface CoverImageFieldProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Champ d'image de couverture : aperçu + upload (bouton & glisser-déposer) +
 * sélection depuis la médiathèque + repli « coller une URL ». Remplace l'ancien
 * champ texte nu de `BlogPostForm`.
 */
export default function CoverImageField({
  value,
  onChange,
}: CoverImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadBlogImage(file, file.name);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload de l'image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        data-testid="cover-dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-lg border-2 border-dashed p-3 flex items-center justify-center min-h-[120px] transition-colors ${
          dragOver ? "border-nuffle-gold bg-nuffle-gold/5" : "border-gray-200"
        }`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Aperçu de la couverture"
            data-testid="cover-preview"
            className="max-h-48 rounded-lg object-contain"
          />
        ) : (
          <p className="text-sm text-gray-400 text-center">
            {uploading
              ? "Envoi en cours…"
              : "Glisse une image ici, ou utilise les boutons ci-dessous."}
          </p>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 text-sm bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 transition-all disabled:opacity-60"
        >
          {uploading ? "Envoi…" : "⬆️ Uploader"}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          data-testid="cover-pick"
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 transition-all"
        >
          🖼️ Médiathèque
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            data-testid="cover-remove"
            className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-all"
          >
            Retirer
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          data-testid="cover-upload-input"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          ⚠️ {error}
        </p>
      )}

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        data-testid="cover-url-input"
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none font-mono text-sm"
        placeholder="/images/blog/mon-article.jpg ou https://… (ou colle une URL)"
      />

      <MediaLibraryModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(img) => onChange(img.url)}
      />
    </div>
  );
}
