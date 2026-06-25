"use client";
import { createContext, useContext, type ReactNode } from "react";

// Catalogue de compétences fourni par le serveur (SSR) pour résoudre les
// noms/catégories SANS dépendre du cache client asynchrone — ce qui évite le
// « flash » fallback→API au chargement (et le changement au survol). Voir
// docs : option 1 du fix badges de compétences.

export interface SkillCatalogEntry {
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string;
  readonly description: string;
  readonly descriptionEn?: string | null;
  readonly category: string;
}

/** Map clé→entrée. Clés indexées par slug, nameFr et nameEn (cf. serveur). */
export type SkillsCatalog = Record<string, SkillCatalogEntry>;

const SkillsCatalogContext = createContext<SkillsCatalog | null>(null);

export function SkillsCatalogProvider({
  value,
  children,
}: {
  value: SkillsCatalog;
  children: ReactNode;
}) {
  return (
    <SkillsCatalogContext.Provider value={value}>
      {children}
    </SkillsCatalogContext.Provider>
  );
}

/** Catalogue courant (null si aucun provider — on retombe sur le cache client). */
export function useSkillsCatalog(): SkillsCatalog | null {
  return useContext(SkillsCatalogContext);
}

/**
 * Résout une entrée du catalogue par slug ou nom (fr/en), dans la langue
 * demandée — même forme de retour que `getSkillDescription`. Null si absent.
 */
export function resolveFromCatalog(
  catalog: SkillsCatalog | null,
  slugOrName: string,
  language: "fr" | "en",
): { name: string; description: string; category: string } | null {
  const entry = catalog?.[slugOrName];
  if (!entry) return null;
  return {
    name: language === "fr" ? entry.nameFr : entry.nameEn,
    description:
      language === "en" && entry.descriptionEn
        ? entry.descriptionEn
        : entry.description,
    category: entry.category,
  };
}
