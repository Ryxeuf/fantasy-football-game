"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CrownsBalance } from "../../components/crowns/CrownsBalance";
import { dynamicRoute } from "../../lib/typed-route";
import { activeShopCategory } from "./categories";
import { useShopCategories } from "./useShopCategories";

/**
 * Boutique : en-tête commun (titre, solde de Couronnes) et onglets des
 * catégories ouvertes. Chaque catégorie sert sa page sous `/me/shop/<id>`.
 * L'accès connecté est garanti par le middleware `/me/*`.
 */
export default function ShopLayout({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const { categories, loading } = useShopCategories();
  const active = activeShopCategory(pathname);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" data-testid="shop">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/me/profile" className="text-sm text-nuffle-bronze hover:underline">
            ← Mon profil
          </Link>
          <h1 className="mt-1 text-2xl font-heading font-bold text-nuffle-anthracite sm:text-3xl">🛒 Boutique</h1>
          {active && <p className="mt-1 max-w-3xl text-sm text-gray-600">{active.description}</p>}
        </div>
        <CrownsBalance className="text-sm" />
      </div>

      {loading && categories.length === 0 ? (
        <div className="flex justify-center py-12" data-testid="shop-loading">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-nuffle-gold" />
        </div>
      ) : categories.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600" data-testid="shop-closed">
          La boutique n&apos;est pas encore ouverte.
        </p>
      ) : (
        <>
          <nav aria-label="Catégories de la boutique" className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {categories.map((c) => {
              const current = active?.id === c.id;
              return (
                <Link
                  key={c.id}
                  href={dynamicRoute(c.href)}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    current ? "bg-nuffle-bronze text-white" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                  }`}
                  data-testid={`shop-category-${c.id}`}
                >
                  <span aria-hidden="true">{c.icon}</span> {c.label}
                </Link>
              );
            })}
          </nav>
          {children}
        </>
      )}
    </div>
  );
}
