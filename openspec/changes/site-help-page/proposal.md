# Une page d'aide qui présente toutes les fonctionnalités du site

## Pourquoi

Demande du mainteneur : « une page d'aide qui montre et explique toutes les
fonctionnalités disponibles dans le site, y compris celles qui ont un feature
flag activé pour tout le monde, classées par catégorie, avec des liens ».

L'inventaire préalable a montré combien de choses ne se découvrent pas :
feuille de match, pronostics, récap de saison, tops, bracket et documents
officiels ne s'atteignent qu'au fond des fiches de compétition ; profil
public de coach, statut de supporter et invitations de ligue ne sont liés
nulle part dans les menus.

## Quoi

1. **`/aide`** (server component, ISR 5 min) : 11 catégories (bien démarrer,
   équipes, ligues, coupes, feuille de match, jouer, règles, outils, compte,
   Nuffle Coach, communauté), un sommaire ancré, une carte par
   fonctionnalité — ce qu'elle permet de faire, qui peut s'en servir, un
   lien direct et ses pages voisines.
2. **Flags « pour tout le monde »** : une fonctionnalité gatée n'apparaît
   que si TOUS ses flags sont activés globalement. Ils sont lus par une
   requête ANONYME à `GET /api/feature-flags/me` (aucun override testeur,
   aucun bypass admin) ; API injoignable ⇒ seules les fonctionnalités sans
   flag sont listées. Aucune route serveur nouvelle.
3. **Catalogue pur** (`aide/help-catalogue.ts`) et filtre pur
   (`aide/help-visibility.ts`).
4. **Ratchet d'exhaustivité** : toute page statique du site est dans l'aide
   ou dans `HELP_UNLISTED_ROUTES` avec sa raison (Pro League gelée, pages
   techniques, orphelines…) ; aucun lien de l'aide n'est mort ; aucun flag
   inconnu du code.
5. **Points d'entrée** : menu Compendium (bureau et mobile), pied de page,
   sitemap.

## Hors périmètre (suites possibles)

- Trancher le sort des pages orphelines `/cups/monthly` (Nuffle Cup
  mensuelles) et `/leagues/seasons` (saisons thématiques) avant de les
  annoncer.
- Version anglaise de la page (le site bascule FR/EN, l'aide est en
  français comme le compendium).
- `/play` pointe vers `/team`, qui n'existe pas (seul `/team/select`
  existe) — relevé pendant l'inventaire, non corrigé ici.
