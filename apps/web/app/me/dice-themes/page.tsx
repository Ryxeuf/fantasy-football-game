"use client";

import Link from "next/link";
import DiceThemeShop from "./DiceThemeShop";

/**
 * Page « Thèmes de dés » : la boutique complète (36 thèmes). L'accès connecté
 * est garanti par le middleware `/me/*` ; le contenu est gaté par les flags
 * `dice_themes` (boutique) et `crowns` (solde, achat).
 */
export default function DiceThemesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <Link href="/me/profile" className="text-sm text-nuffle-bronze hover:underline">
          ← Mon profil
        </Link>
        <h1 className="mt-1 text-2xl font-heading font-bold text-nuffle-anthracite sm:text-3xl">
          🎲 Thèmes de dés
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          L&apos;apparence de vos dés de blocage et de vos dés chiffrés, partout sur le site :
          accueil, feuille de match, match en ligne et simulateurs.
        </p>
      </div>
      <DiceThemeShop />
    </div>
  );
}
