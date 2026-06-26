# Design — Moteur de recherche du contenu public

## Contexte

`apps/web` ne dépend pas de `@bb/game-engine` ; les corpus publics sont
exposés via des API serveur (`/api/skills`, `/api/positions`,
`/api/rosters`, `/star-players`) sauf le compendium, qui est un JSON local
(`app/compendium/data/rules-bb-2025.json`). Les pages de référence
existantes (`/skills`, `/teams`, positions) suivent déjà le motif
server-fetch + ISR.

## Décision : index en mémoire côté client, agrégé au serveur

Les corpus publics sont petits (quelques centaines d'entrées). Plutôt
qu'un moteur externe ou une route de recherche serveur appelée à chaque
frappe, on agrège **une fois** au rendu serveur (ISR 3600) un tableau
d'enregistrements unifiés, transmis au client qui filtre en mémoire. Frappe
instantanée, zéro round-trip par requête, et compatible cache statique.

```
/recherche (server, ISR)
  ├─ compendiumRecords()          (local)
  ├─ skillRecords(/api/skills)     ┐
  ├─ positionRecords(/api/positions)│ safeServerJson (tolérant : null → [])
  ├─ rosterRecords(/api/rosters)   │
  └─ starRecords(/star-players)    ┘
        → SearchRecord[]  → <SearchClient records=… />  (Suspense)
```

`SearchRecord = { id, type, title, subtitle?, text, url }` — forme unique
pour tous les corpus ; `url` porte le lien profond (avec ancre pour les
sections de compendium).

## Décision : repli d'accents à longueur constante

La recherche est insensible casse/accents. `String.normalize("NFD")` +
suppression des diacritiques **change la longueur** (un `é` → `e` + accent
combinant retiré), ce qui désaligne les indices utilisés pour découper un
extrait sur le texte d'origine. `fold` mappe donc **un code point en
entrée → un caractère en sortie** (`Array.from(s, ch => ch.normalize("NFD")[0].toLowerCase())`),
préservant la longueur : l'index trouvé dans la version repliée correspond
au même index dans le texte d'origine.

## Décision : indexation du compendium par chapitre ET par section

Pour des liens profonds utiles, on émet un enregistrement par chapitre
(intro + résumé) **et** un par titre de niveau 2, dont l'ancre est calculée
avec `chapterToc` (même dédup que le rendu `Blocks`), garantissant que le
lien `#ancre` pointe vers le bon titre.

## Scoring

Pour chaque enregistrement, chaque terme de la requête est cherché dans le
titre (+8, +12 si préfixe), le sous-titre (+3) et le corps (+2). Un
enregistrement n'est retenu que si **tous** les termes apparaissent (ET).
Bonus si le titre **égale** (+25) ou **commence par** (+10) la requête
complète. Tri : score décroissant, puis priorité de type
(règle > compétence > position > équipe > star), puis titre.

## UI

`SearchClient` ("use client") lit `?q=` via `useSearchParams` (d'où le
`Suspense` parent), garde un état local pour la réactivité et resynchronise
l'URL en différé (partage). Filtres par type avec compteurs ; surlignage
des termes via une fonction qui marque les plages repliées et reconstruit
des `<mark>` sur le texte d'origine.

## Alternatives écartées

- **Algolia / Meilisearch** : surdimensionné pour ce volume, ajoute une
  dépendance et un coût d'infra.
- **Route serveur `/api/search?q=`** : un round-trip par frappe, moins
  réactif, sans bénéfice à ce volume.
- **Filtre local par page** (existant sur `/skills`) : ne couvre pas la
  recherche transversale demandée.
