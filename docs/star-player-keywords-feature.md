# Mots-clés des Star Players — 2026-08-18

## Contexte

Les positionnels portent leurs mots-clés officiels BB2025 (lignée/race +
type de joueur) depuis juin 2026 — cf.
[`position-keywords-feature.md`](./position-keywords-feature.md). Les Star
Players, qui sont des joueurs comme les autres sur la fiche officielle,
n'avaient **rien** : pas de colonne, pas de donnée, pas d'affichage. Cette
feature câble la même chaîne de bout en bout pour les 68 stars.

## Chaîne de données

```
packages/game-engine/src/rosters/star-player-keywords.ts  (STAR_PLAYER_KEYWORDS, curé)
        │  appliqué sur StarPlayerDefinition.keywords (les 2 rulesets)
        ▼
apps/server/src/seed.ts  →  DB : StarPlayer.keywords
        │  transformStarPlayer (mapper unique des routes /star-players*)
        ▼
API : keywords (FR) + keywordsEn (traduit)
        ▼
Web : KeywordChips (carte de listing, fiche détail, sélecteur de recrutement)
      + filtre par mots-clés sur /star-players
      + JSON-LD `Keywords` et metadata.keywords de la fiche
```

## Provenance de la donnée ⚠️

Contrairement à `keywords-season3.ts` (généré depuis
`data/positionnels-bloodbowl-2025.md`), **il n'existe pas de source
markdown des Star Players dans le repo**. `STAR_PLAYER_KEYWORDS` est donc
une table **curée à la main** : lignée déduite du lore / de l'illustration
/ de la règle spéciale de chaque star, type déduit de son profil et de ses
compétences (ex. `chainsaw` + `secret-weapon` ⇒ `Spécial`, ogre / troll /
homme-arbre ⇒ `Gros Bras`).

Elle doit être **confrontée au PDF officiel GW « Star Players! »** (Blood
Bowl Third Season Edition) à la première occasion. Les cas les moins sûrs
sont les stars ajoutées en 2025 (Rodney Roachbait, Rowana ForestFoot,
Rumbelow Sheepskin, Swiftvine Glimmershard, Willow Rosebark, Kiroth
Krakeneye, Ivan Deathshroud, Skrull Halfheight). Corriger = éditer **une
seule ligne** de `star-player-keywords.ts`, rien d'autre (la garde de test
vérifie le vocabulaire et la couverture).

## Pièces

- **Table** `packages/game-engine/src/rosters/star-player-keywords.ts` —
  `STAR_PLAYER_KEYWORDS` (slug → CSV `"Lignée, Type"`),
  `STAR_PLAYER_LINEAGE_KEYWORDS` / `STAR_PLAYER_ROLE_KEYWORDS` (vocabulaire
  fermé, mêmes libellés que les positions), `getStarPlayerKeywords(slug)`.
  Appliquée sur `StarPlayerDefinition.keywords` dans la boucle
  post-construction de `star-players.ts` — **pas** de `keywords:` posé à la
  main dans les définitions.
- **Pas de dépendance au ruleset** : un mercenaire est la même personne en
  `season_2` et `season_3` (seul `hirableBy` change), donc les deux
  rulesets sont renseignés — là où les positions ne le sont qu'en S3.
- **Migration** `prisma/migrations/20260818100000_add_star_player_keywords`
  — `StarPlayer.keywords TEXT` (nullable, additive).
- **Seed** `apps/server/src/seed.ts` — écrit `keywords` depuis la
  définition engine (create **et** update).
- **API** `routes/star-players.ts` — mapper unique `transformStarPlayer`
  partagé par les 4 routes ; `keywords` vient de la DB avec **repli sur le
  game-engine** quand la colonne est encore `NULL` (base pas re-seedée),
  `keywordsEn` toujours calculé via `translateKeywordsCsv`.
  `team-star-player-handlers.ts` ajoute `keywordsEn` sur les stars recrutés
  et disponibles.
- **Admin** — champ « Mots-clés » dans les formulaires create/edit Star
  Player, `keywords` dans les schémas Zod et l'audit.
- **Web** — `KeywordChips` (prop `testId` ajoutée),
  `StarPlayerCard`, `/star-players/[slug]`, `StarPlayerSelector` ; filtre
  par mots-clés sur `/star-players` (`data-testid="star-player-keyword-filter"`,
  ET logique) via les helpers génériques `app/lib/keyword-filter.ts`
  (`position-keyword-filter.ts` en est désormais la façade typée position).

## Traduction EN

Le dictionnaire `keyword-translations.ts` couvrait déjà tout le vocabulaire
sauf `Zoat` (Zolcath the Zoat), ajouté. Un token inconnu resterait affiché
en FR plutôt que perdu, et le test unitaire échouerait avant.

## Mise à jour en prod

Après déploiement, rejouer le **seed** (`db:seed`) pour peupler
`StarPlayer.keywords`. En attendant, l'API sert déjà les mots-clés depuis
le game-engine : aucune page vide entre le déploiement et le seed. Penser
au cache HTTP/ISR de la fiche (`revalidate = 3600`).

## Suivi possible

- Confronter la table au PDF officiel et corriger les cas incertains.
- Page d'index par mot-clé (`/star-players/mots-cles/<kw>`) pour la
  longue traîne SEO, si le filtre client montre de l'usage.
