/**
 * Systèmes d'appariement d'une ronde de coupe.
 *
 * Module minuscule et SANS dépendance : le schéma Zod des routes s'en sert
 * pour construire son `z.enum`, et le service pour typer son aiguillage. Le
 * garder à part évite que le schéma n'ait à importer le service (qui tire
 * Prisma, les notifications et le classement) — et qu'un test de route qui
 * mocke le service ne casse la validation de son propre corps de requête.
 */

/**
 * Systèmes d'appariement d'une ronde de coupe.
 *
 *  - `random` : tirage au sort. C'est ce qu'il faut pour la PREMIÈRE ronde —
 *    le classement y est vide, donc un appariement « suisse » s'y réduirait
 *    à l'ordre alphabétique.
 *  - `swiss`  : appariement sur le classement courant, sans rematch.
 *  - `manual` : rencontres posées à la main par le commissaire (poules
 *    imposées, contraintes de déplacement, ronde de rattrapage…).
 */
export const CUP_ROUND_SYSTEMS = ["random", "swiss", "manual"] as const;
export type CupRoundSystem = (typeof CUP_ROUND_SYSTEMS)[number];

export function isCupRoundSystem(value: unknown): value is CupRoundSystem {
  return (
    typeof value === "string" &&
    (CUP_ROUND_SYSTEMS as readonly string[]).includes(value)
  );
}

