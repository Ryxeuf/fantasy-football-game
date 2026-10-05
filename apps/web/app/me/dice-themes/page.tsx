import { redirect } from "next/navigation";

/**
 * Ancienne adresse de la page « Thèmes de dés », devenue une catégorie de la
 * boutique. Conservée pour les liens et favoris existants.
 */
export default function LegacyDiceThemesPage() {
  redirect("/me/shop/dice-themes");
}
