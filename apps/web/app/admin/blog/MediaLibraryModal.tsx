"use client";

import { useEffect } from "react";
import MediaLibrary from "./MediaLibrary";
import type { BlogImage } from "./api";

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (image: BlogImage) => void;
}

/**
 * Modale de sélection d'image (picker) réutilisant la galerie `MediaLibrary`.
 * Utilisée par l'éditeur TipTap et le champ de couverture. Pattern overlay
 * inline (`role="dialog"`) aligné sur les autres modales admin du repo.
 */
export default function MediaLibraryModal({
  open,
  onClose,
  onSelect,
}: MediaLibraryModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Médiathèque"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold">🖼️ Médiathèque</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <MediaLibrary
            mode="picker"
            onSelect={(img) => {
              onSelect(img);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
