import type { HelpCategory, HelpFeature } from "./help-catalogue";

/**
 * Visibilité d'une fonctionnalité dans la page d'aide — module PUR.
 *
 * L'aide décrit le site TEL QUE TOUT LE MONDE LE VOIT : une fonctionnalité
 * sans flag est toujours listée, une fonctionnalité derrière un ou plusieurs
 * feature flags ne l'est que si TOUS sont activés POUR TOUT LE MONDE (l'IA
 * d'entraînement vit dans la page de jeu en ligne : il faut les deux). Un override
 * individuel (testeur) ou le bypass admin ne comptent pas : sinon l'aide
 * annoncerait à un admin une recette que personne d'autre ne voit.
 *
 * Les flags « pour tout le monde » sont ceux que l'API sert à un visiteur
 * ANONYME (`GET /api/feature-flags/me` sans jeton = flags globalement
 * activés). Ils sont lus côté serveur, cf. `page.tsx`.
 */

export function isHelpFeatureVisible(
  feature: Pick<HelpFeature, "flags">,
  globalFlags: ReadonlySet<string>,
): boolean {
  return (feature.flags ?? []).every((flag) => globalFlags.has(flag));
}

/**
 * Catégories à afficher : fonctionnalités filtrées par flag, liens
 * secondaires aussi, catégories vides retirées. Ne mute rien.
 */
export function visibleHelpCategories(
  categories: readonly HelpCategory[],
  globalFlags: ReadonlySet<string>,
): HelpCategory[] {
  return categories
    .map((category) => ({
      ...category,
      features: category.features
        .filter((f) => isHelpFeatureVisible(f, globalFlags))
        .map((f) =>
          f.links
            ? { ...f, links: f.links.filter((l) => isHelpFeatureVisible(l, globalFlags)) }
            : f,
        ),
    }))
    .filter((category) => category.features.length > 0);
}

/**
 * Lit la réponse de `GET /api/feature-flags/me` (enveloppe `{ success,
 * data }`). Toute réponse inattendue ⇒ aucun flag : un gate reste FERMÉ
 * faute d'information, jamais ouvert.
 */
export function parseGlobalFlags(envelope: unknown): ReadonlySet<string> {
  if (!envelope || typeof envelope !== "object") return new Set();
  const { success, data } = envelope as { success?: unknown; data?: unknown };
  if (success !== true || !Array.isArray(data)) return new Set();
  return new Set(data.filter((k): k is string => typeof k === "string"));
}
