# Design — Aperçu de partage d'un roster

## 1. Pourquoi le logo était déformé (et pourquoi ce n'est pas un recadrage)

`app/layout.tsx` annonce `width: 1200, height: 630` pour un fichier qui
fait 1024 × 1024. Les scrapers (Discord, Slack, X, Facebook) font
confiance aux `og:image:width` / `og:image:height` déclarés pour réserver
la place **avant** d'avoir téléchargé l'image, puis y peignent le fichier.
Déclarer 1,91:1 pour un carré produit donc un étirement horizontal, pas un
recadrage : c'est exactement ce que montre la capture.

Trois corrections possibles :

| Option | Effet | Retenu |
|---|---|---|
| Déclarer les vraies dimensions (1024 × 1024) + `twitter.card = "summary"` | Vignette carrée minuscule, on perd la grande carte | non |
| Committer un PNG 1200 × 630 statique | Correct, mais un asset binaire de plus à maintenir, et le contenu reste figé | non |
| `ImageResponse` 1200 × 630 générée (convention `opengraph-image.tsx`) | Vraies dimensions, logo `contain`, réutilise le template OG déjà en place | **oui** |

La règle de fond, appliquée partout dans ce lot : **une image dont on ne
maîtrise pas les proportions ne doit jamais être dimensionnée en dur**.
Le template la pose dans une boîte carrée fixe et lui applique
`objectFit: "contain"`. Un logo panoramique, un carré ou un portrait
tiennent tous dedans sans déformation.

## 2. Convention Next.js : pourquoi retirer `openGraph.images` de la racine

`mergeStaticMetadata` (Next 14) n'applique le fichier
`opengraph-image.tsx` d'un segment **que si** la metadata de ce même
segment ne déclare pas déjà `openGraph.images` :

```js
if (openGraph && !source?.openGraph?.hasOwnProperty("images")) {
  target.openGraph = resolveOpenGraph({ ...target.openGraph, images: openGraph }, …);
}
```

Tant que `app/layout.tsx` déclare `images`, un `app/opengraph-image.tsx`
racine serait **ignoré silencieusement**. On retire donc `images` des deux
blocs (`openGraph` et `twitter`) : `resolveTwitter` recopie automatiquement
les images d'`openGraph` quand `twitter.images` est absent.

Corollaire vérifié dans la source de Next (`resolveOpenGraph`) : un segment
qui déclare `openGraph` **remplace** intégralement celui du parent, images
comprises. Les pages qui déclarent leur propre `openGraph` sans images
(blog, compendium, skills…) n'héritaient donc **déjà pas** de l'image
racine — retirer `images` ne leur enlève rien. C'est aussi pourquoi
`/r/[token]` et `/me/teams/[id]` ont chacune besoin de leur propre
`opengraph-image.tsx` plutôt que d'un héritage.

## 3. Résolution du logo d'équipe dans une image OG

Deux sources possibles, **deux rendus différents** — et c'est le rendu réel
qui a tranché :

- **logo uploadé** (`Team.logoUrl`) → une image. L'URL servie par l'API est
  éventuellement **relative** (`/images/team-logos/x.png` quand
  `TEAM_LOGO_ASSET_PUBLIC_BASE` n'est pas posé). Satori ne résout pas les
  chemins relatifs : on absolutise contre l'origine du site.
- **pas de logo** → l'emblème du roster, décrit en **données** (monogramme
  + couleurs canoniques, via `getTeamLogo` / `getTeamColors`) et rendu par
  le template avec ses propres éléments.

Le réflexe évident était de réutiliser `renderTeamLogoSvg` (la source de
vérité de `<TeamLogo>` côté web) dans un `data:image/svg+xml;base64`. Le
rendu montre pourquoi c'est faux : satori rasterise un SVG imbriqué **sans
résoudre ses polices**, le `<text>` du monogramme disparaît, et l'emblème
se réduit à un disque de couleur muet. Passer les mêmes données en éléments
satori restitue le monogramme.

La résolution est un module **pur** (`app/lib/og-team-logo.ts`) qui rend une
union discriminée `{ kind: "image" } | { kind: "emblem" }`, testable sans
satori ni réseau.

Le cas d'échec est explicite : si satori ne parvient pas à charger le logo
uploadé, l'`ImageResponse` entière échoue. On garde donc `logo` optionnel
dans le template et on n'ajoute jamais un `src` vide — l'emblème, lui, ne
peut pas échouer.

## 4. Pourquoi une route publique par id, et pas par token

`/me/teams/[id]` ne connaît que l'id ; `getPublicTeamByToken` filtre sur
`shareToken`. Plutôt que d'exposer la lecture complète par id, on ajoute
`GET /api/public/teams/by-id/:id` qui rend un **aperçu** : nom, race,
règles, VE, effectif, logo, description, `shareToken`. Trois raisons :

1. **Moindre exposition** : l'aperçu n'a pas besoin de la trésorerie, ni
   du détail des joueurs, ni des compétences — la route ne les rend pas.
2. **Même porte que le partage** : la route ne répond que si
   `isPublic = true`. Une équipe privée est un 404, indiscernable d'une
   équipe inexistante.
3. Elle rend `shareToken`, ce qui permet à `/me/teams/[id]` de pointer son
   `og:url` vers la page réellement consultable (`/r/:token`) au lieu
   d'une page qui exige une session.

## 5. Le garde `/me/*` : pourquoi la metadata ne suffisait pas

Constat vérifié au rendu, et c'est la cause racine de l'aperçu signalé :

```
GET /me/teams/<id>            -> 307 /auth/sync?redirect=/me/teams/<id>
GET /auth/sync?...            -> 200, carte GÉNÉRIQUE du site
```

`middleware.ts` redirige toute requête non authentifiée sur `/me/*`. Un
scraper (Discord, Slack, X) n'a jamais de session : il ne voit donc jamais
la metadata de `/me/teams/[id]`, quelle qu'elle soit. Poser des `<meta>` sur
cette page sans toucher au garde, c'est écrire du code inatteignable.

Options considérées :

| Option | Verdict |
|---|---|
| Laisser passer `/me/teams/:id` sans session | Non : un humain déconnecté verrait une coquille vide au lieu du login |
| Sniffer l'User-Agent des scrapers | Non : heuristique fragile, et ça crée une porte contournable |
| Poser la metadata de l'équipe sur `/login` selon `?redirect=` | Non : action à distance, la page de connexion n'a rien à savoir des équipes |
| Détourner vers un résolveur public | **Oui** |

Le résolveur `/r/by-id/:id` (route serveur, pas le middleware : celui-ci
reste synchrone et sans I/O) renvoie vers `/r/:token` si l'équipe est
publique, et reconduit sinon le parcours de connexion. Le détournement est
volontairement étroit — lecture seule, feuille `/me/teams/:id` uniquement,
pas de query string, `new` exclu — et la logique de décision vit dans un
module PUR (`lib/private-team-share-divert.ts`), testable sans `NextRequest`.

Deux points de sûreté :

- **Aucune redirection ouverte.** Le résolveur ne suit jamais une URL
  fournie par l'appelant : il reconstruit `/me/teams/<id>` depuis son propre
  paramètre de route. Le seul état transmis par le middleware est un
  booléen (`sync=1` = « il n'y avait pas de cookie d'auth »), pas une
  destination.
- **Le comportement humain ne change que pour une équipe publiée.**
  `isPublic` est faux par défaut ; pour une équipe privée, la redirection
  finale est celle d'aujourd'hui, `?redirect=` compris.

## 6. Description : bornes et troncature

- **Stockage** : 1000 caractères. Assez pour du fluff (deux ou trois
  paragraphes), assez peu pour ne pas transformer la colonne en champ
  libre illimité.
- **Meta description** : tronquée à 200 caractères sur une frontière de
  mot, avec une ellipse. Les scrapers coupent de toute façon vers 150-300 ;
  tronquer nous-mêmes évite une phrase amputée au milieu d'un mot.
- **Image OG** : le sous-titre affiche la description quand elle existe,
  sinon la ligne « Avec <Star Players> » actuelle. La troncature y est plus
  courte (120) : satori ne fait pas de retour à la ligne automatique sur un
  bloc unique.

Ces trois bornes vivent dans le même module pur pour ne pas diverger.

## 7. Le miroir SQLite est une SECONDE déclaration de schéma

`Team.description` ajoutée à `prisma/schema.prisma` ne suffit pas : la
suite `e2e-api` génère son client depuis `apps/server/prisma/sqlite/
schema.prisma`, un miroir distinct. Une colonne absente de ce miroir fait
échouer à l'exécution tout `select` qui la demande — donc l'aperçu public
ET l'écriture de la description, mais uniquement sous `TEST_SQLITE=1`.

Rien ne garde cette parité automatiquement. Le garde ici est le spec
`tests/e2e-api/specs/team-share-preview.spec.ts` : il exerce les deux
nouvelles routes contre le miroir, et 9 de ses 11 cas tombent si la colonne
manque (vérifié en retirant la colonne). Toute colonne ajoutée par la suite
et lue par une route couverte en e2e-api hérite du même garde.

## 8. Journalisation

`Team.description` est une écriture sur `Team` : la garde CI
`services/team-audit-coverage.test.ts` impose de journaliser. On suit
`team-rename.ts` à la lettre (capture `before`, `safeRecordTeamAudit`,
no-op silencieux si la valeur est identique) plutôt que de demander une
exemption. `description` n'entre PAS dans `DIFFED_FIELDS` : le diff
dénormalisé sert à reconstituer l'économie de l'équipe, pas son fluff — le
`details: { from, to }` de l'étape suffit à retrouver un texte effacé.

## 9. Alternatives écartées

- **Enrichir l'aperçu de `/me/teams/[id]` même pour une équipe privée.**
  Rejeté : le repo pose le partage comme opt-in explicite (« Désactivé par
  défaut (vie privée) »). Un aperçu riche sur un lien privé publierait le
  nom, le logo et le fluff auprès de quiconque obtient l'URL.
- **Rediriger `/me/teams/[id]` vers `/r/:token` pour tout le monde.**
  Rejeté : c'est la fiche de travail du coach. Le détournement ne vise que
  les requêtes SANS session, celles qui n'auraient de toute façon vu que la
  page de connexion.
- **Générer un OG statique au build.** Rejeté : le nom, le logo et la
  description changent après le build ; l'ISR (`revalidate = 600`) donne
  déjà le cache sans figer le contenu.
