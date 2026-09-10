import type { Route } from "next";

/**
 * URL construite à l'exécution, pour `experimental.typedRoutes`.
 *
 * Next.js vérifie statiquement que chaque `href` correspond à une route qui
 * existe : c'est précieux pour un lien littéral (`/cups`), mais impossible
 * pour une URL assemblée au moment du rendu — id de rencontre, slug d'équipe,
 * querystring d'un lien de construction. TypeScript n'a alors qu'un `string`
 * et refuse.
 *
 * Ce helper concentre l'échappatoire en UN endroit documenté, au lieu de
 * laisser huit `as Route` dispersés (ou, comme c'était le cas, huit erreurs
 * que `pnpm --filter @bb/web typecheck` remontait sans que personne ne les
 * voie — la CI avale son propre code de sortie, cf. CLAUDE.md).
 *
 * À n'utiliser QUE pour une URL dont la forme est construite : un lien
 * littéral doit rester littéral, c'est lui que la vérification protège.
 */
export function dynamicRoute(href: string): Route {
  return href as Route;
}
