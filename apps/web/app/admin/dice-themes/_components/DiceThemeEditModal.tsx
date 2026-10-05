"use client";

import { useEffect, useState } from "react";
import type { AdminDiceTheme, DiceThemePatch } from "../../../lib/admin-dice-themes";
import { DiceThemePreview } from "../../../components/dice/DiceThemePreview";

interface Props {
  readonly theme: AdminDiceTheme | null;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onSave: (patch: DiceThemePatch) => void | Promise<void>;
}

/**
 * Édition d'un thème de dés : libellés FR/EN, prix (vide = gratuit), mise en
 * vente et ordre d'affichage. Les VISUELS ne s'éditent pas (PNG du dépôt +
 * palette du skin) ; le défaut reste gratuit et en service.
 */
export default function DiceThemeEditModal({ theme, saving, onClose, onSave }: Props) {
  const [nameFr, setNameFr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [price, setPrice] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");

  // Échap ferme la modale (comme le bouton Annuler).
  useEffect(() => {
    if (!theme) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theme, onClose]);

  useEffect(() => {
    if (!theme) return;
    setNameFr(theme.name.fr);
    setNameEn(theme.name.en);
    setDescriptionFr(theme.description.fr);
    setDescriptionEn(theme.description.en);
    setPrice(theme.priceCrowns === null ? "" : String(theme.priceCrowns));
    setEnabled(theme.enabled);
    setSortOrder(String(theme.sortOrder));
  }, [theme]);

  if (!theme) return null;

  const priceTrim = price.trim();
  const priceValue = priceTrim === "" ? null : Number(priceTrim);
  const priceValid = priceValue === null || (Number.isInteger(priceValue) && priceValue >= 0 && priceValue <= 1_000_000);
  const sortValue = Number(sortOrder);
  const sortValid = Number.isInteger(sortValue) && sortValue >= 0 && sortValue <= 100_000;
  const namesValid = nameFr.trim().length > 0 && nameEn.trim().length > 0;
  const canSave = priceValid && sortValid && namesValid && !saving;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !theme) return;
    void onSave({
      nameFr: nameFr.trim(),
      nameEn: nameEn.trim(),
      descriptionFr: descriptionFr.trim() || null,
      descriptionEn: descriptionEn.trim() || null,
      ...(theme.isDefault ? {} : { priceCrowns: priceValue, enabled }),
      sortOrder: sortValue,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dice-theme-edit-title"
    >
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        data-testid="dice-theme-edit-modal"
      >
        <h2 id="dice-theme-edit-title" className="text-xl font-heading font-bold text-nuffle-anthracite">
          Modifier « {theme.name.fr} »
        </h2>
        <p className="mb-4 font-mono text-xs text-gray-500">{theme.id}</p>
        <DiceThemePreview themeId={theme.id} withNumberDie />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Nom (FR)
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={nameFr}
              onChange={(e) => setNameFr(e.target.value)}
              maxLength={80}
              data-testid="edit-name-fr"
              autoFocus
            />
          </label>
          <label className="text-sm">
            Nom (EN)
            <input className="mt-1 w-full rounded border px-2 py-1" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={80} />
          </label>
          <label className="text-sm sm:col-span-2">
            Description (FR)
            <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={descriptionFr} onChange={(e) => setDescriptionFr(e.target.value)} maxLength={300} />
          </label>
          <label className="text-sm sm:col-span-2">
            Description (EN)
            <textarea className="mt-1 w-full rounded border px-2 py-1" rows={2} value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} maxLength={300} />
          </label>
          <label className="text-sm">
            Prix en Crowns <span className="text-gray-400">(vide = gratuit)</span>
            <input
              className={`mt-1 w-full rounded border px-2 py-1 ${priceValid ? "" : "border-red-500"}`}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={theme.isDefault}
              data-testid="edit-price"
            />
          </label>
          <label className="text-sm">
            Ordre d&apos;affichage
            <input
              className={`mt-1 w-full rounded border px-2 py-1 ${sortValid ? "" : "border-red-500"}`}
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={theme.isDefault}
              data-testid="edit-enabled"
            />
            En vente (décoché : retiré de la boutique, ses acheteurs le gardent)
          </label>
          {theme.isDefault && (
            <p className="text-xs text-amber-700 sm:col-span-2">
              Thème par défaut : il reste gratuit et en service pour tous les coachs.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">
            Annuler
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded bg-nuffle-bronze px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="edit-save"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
