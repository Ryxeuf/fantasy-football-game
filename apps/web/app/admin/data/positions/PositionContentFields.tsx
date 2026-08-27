"use client";

/**
 * Bloc de saisie du contenu éditorial d'un positionnel (illustration,
 * description de jeu, fluff), partagé par les formulaires de création et
 * d'édition de `/admin/data/positions`.
 *
 * Champs NON contrôlés (`defaultValue`) : les deux formulaires lisent leur
 * état via `FormData` au submit. Les colonnes correspondantes sont nullables
 * en base — une saisie vide est normalisée en `null` côté serveur.
 */

export interface PositionContentDefaults {
  readonly imageUrl?: string | null;
  readonly descriptionFr?: string | null;
  readonly descriptionEn?: string | null;
  readonly fluffFr?: string | null;
  readonly fluffEn?: string | null;
}

const TEXTAREA_CLASS =
  "w-full border rounded px-3 py-2 text-sm leading-relaxed";

export default function PositionContentFields({
  defaults,
}: {
  defaults?: PositionContentDefaults;
}) {
  return (
    <div
      className="col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 border rounded bg-gray-50"
      data-testid="position-content-fields"
    >
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium mb-1" htmlFor="imageUrl">
          Illustration (URL)
        </label>
        <input
          id="imageUrl"
          type="text"
          name="imageUrl"
          defaultValue={defaults?.imageUrl ?? ""}
          placeholder="/images/positions/amazon_guerriere_aigle.png"
          className="w-full border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">
          Chemin ou URL de l&apos;image affichée sur la fiche du poste. Laisser
          vide pour retomber sur le blason du roster.
        </p>
      </div>

      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="descriptionFr"
        >
          Description (FR)
        </label>
        <textarea
          id="descriptionFr"
          name="descriptionFr"
          rows={4}
          defaultValue={defaults?.descriptionFr ?? ""}
          placeholder="Rôle du poste sur le terrain, usage recommandé…"
          className={TEXTAREA_CLASS}
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium mb-1"
          htmlFor="descriptionEn"
        >
          Description (EN)
        </label>
        <textarea
          id="descriptionEn"
          name="descriptionEn"
          rows={4}
          defaultValue={defaults?.descriptionEn ?? ""}
          placeholder="Laisser vide pour reprendre la version française."
          className={TEXTAREA_CLASS}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="fluffFr">
          Fluff / lore (FR)
        </label>
        <textarea
          id="fluffFr"
          name="fluffFr"
          rows={4}
          defaultValue={defaults?.fluffFr ?? ""}
          placeholder="Ambiance, background du poste (texte reformulé)."
          className={TEXTAREA_CLASS}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="fluffEn">
          Fluff / lore (EN)
        </label>
        <textarea
          id="fluffEn"
          name="fluffEn"
          rows={4}
          defaultValue={defaults?.fluffEn ?? ""}
          placeholder="Laisser vide pour reprendre la version française."
          className={TEXTAREA_CLASS}
        />
      </div>
    </div>
  );
}

/**
 * Extrait les champs éditoriaux d'un `FormData` pour le payload d'API.
 * Une saisie vide devient `null` (le serveur normalise aussi, mais on évite
 * d'envoyer des chaînes vides sur le réseau).
 */
export function readPositionContentFields(
  formData: FormData,
): Required<{ [K in keyof PositionContentDefaults]: string | null }> {
  const read = (key: string): string | null => {
    const raw = formData.get(key);
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    imageUrl: read("imageUrl"),
    descriptionFr: read("descriptionFr"),
    descriptionEn: read("descriptionEn"),
    fluffFr: read("fluffFr"),
    fluffEn: read("fluffEn"),
  };
}
