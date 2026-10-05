# Design — boutique de thèmes de dés et Couronnes

## Où vit quoi

| Donnée | Lieu | Rôle |
|---|---|---|
| Rendu (PNG + palette) | `packages/ui/src/dice/skins.ts` (`DICE_SKINS`) | site + match en ligne |
| Contexte de skin | `@bb/ui/dice` `DiceSkinProvider` / `useDiceSkin` | posé par `DiceThemeProvider` |
| Renderers du site | `apps/web/app/components/dice/themes/registry.ts` | construits depuis les skins |
| Catalogue compilé | `apps/server/src/services/dice-theme-catalogue.ts` | repli + seed, règles pures |
| Catalogue éditable | table `DiceTheme` via `dice-theme-repository` | base d'abord |
| Acquisitions | table `UserDiceTheme` (unique coach × thème) | achat / cadeau |
| Crowns | `ProWallet` + `ProTransaction` (existants) | solde + journal |

Cohérence verrouillée par `catalogue-consistency.test.ts` (ids serveur ==
renderers web) et `skins.test.ts` (chaque PNG référencé existe en 3 tailles).

## Décisions

- **Un registre de rendu dans `@bb/ui`** plutôt que dans le site : les
  composants de match en ligne (popup de choix de blocage, journal, popup de
  résultat, plateau Pixi) vivent dans `@bb/ui` et ne peuvent pas importer le
  site. Le site importe `@bb/ui/dice` (alias dédié, pour ne pas tirer Pixi
  dans la home via le barrel).
- **Dés numériques dessinés, pas d'images** : aucun PNG n'existe pour le D6.
  La palette de chaque skin (relevée sur les PNG du pack, reprise du
  `manifest.json` des équipes) dessine un jeton du même style. Au-delà de 6
  (total de 2D6), le dé s'affiche chiffré — corrige au passage le plateau Pixi
  qui dessinait 4 points pour un 9.
- **Face de blocage animée** : une entrée de journal portant `details.result`
  fait défiler les faces du Dé de Blocage puis s'arrête sur la face tirée
  (le plateau dessinait un D6 à points pour un blocage).
- **Résolution d'image selon la taille** (`px`) : 64 px pour ≤ 32 px affichés,
  128 px pour ≤ 64, 320 px au-delà ; `loading="lazy"` en boutique et admin
  (36 thèmes × 5 faces).
- **Une seule monnaie** : réutiliser `ProWallet` évite deux soldes et garde
  l'ajustement admin existant (`PATCH /admin/wallets/:id/balance`). Les routes
  coach du wallet étant gelées avec la Pro League, `GET /crowns/me` est une
  route dédiée, gatée par `crowns`.
- **Achat atomique** : décrément CONDITIONNEL (`crowns >= prix`) dans la même
  instruction SQL que l'écriture — deux achats simultanés ne passent pas sous
  zéro — + unicité (coach, thème) contre le double achat (P2002 → 409). Le
  thème acheté est équipé dans la même transaction.
- **Tous les écrivains du wallet deviennent atomiques** (`pro-wallet` :
  `debit`/`debitInTx` en décrément conditionnel, `credit`/`creditInTx` en
  incrément). Un seul écrivain en lire-puis-écrire suffit à perdre la mise à
  jour d'un autre : un ajustement ou un remboursement admin concurrent d'un
  achat aurait réécrit le solde calculé sur un état périmé.
- **États honnêtes en boutique** : solde en chargement ou en erreur ≠
  « bientôt disponible » (action `pending`, bandeaux avec « Réessayer ») ;
  un aperçu de thème est UNE image nommée pour un lecteur d'écran.
- **Un total de 2D6 n'est jamais pointé** (`isSingleD6Roll` : cible > 6+ ⇒
  dé chiffré), dans le journal, la popup, les toasts et le plateau.
- **Cache du catalogue** : le repli d'une erreur n'est pas mis en cache, et
  une lecture partie avant une invalidation n'écrit pas le cache.
- **Retiré de la vente ≠ retiré à l'acheteur** : `enabled = false` masque le
  thème de la boutique des non-possédants ; un acheteur le garde. Un thème
  gratuit retiré n'est plus possédé d'office.
- **Le défaut est intouchable** : gratuit et en service quoi qu'en dise la base
  (repository) et refusé à l'écriture (`default-theme-locked`).
- **Pas d'achat en impersonation** : un admin « connecté en tant que » ne
  dépense pas les Crowns du coach (403).
- **Colonnes et tables lisibles sans backfill** : `prisma/migrations/` est
  gitignoré ; pas de FK du thème vers `DiceTheme` (le compilé fait repli).
