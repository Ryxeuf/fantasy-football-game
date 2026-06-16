# Mots-clés des positions (Season 3) — 2026-06-16

## Contexte

Les positions Blood Bowl 2025 ont des **mots-clés officiels** : la parenthèse
de la colonne Position dans `data/positionnels-bloodbowl-2025.md`, ex.
`Trois-Quart Humain (Humain, Trois-quart)`. Ils décrivent la **lignée/race** et
le **type de joueur**. La colonne `Position.keywords` existait en base (schéma
Prisma) mais n'était **jamais peuplée** : ni dans la source code, ni au seed, ni
exposée par l'API, ni affichée. Cette feature câble la chaîne de bout en bout.

## Chaîne de données

```
data/positionnels-bloodbowl-2025.md   (source de vérité, parenthèse Position)
        │  scripts/generate-keywords-season3.ts --write
        ▼
packages/game-engine/src/rosters/keywords-season3.ts   (KEYWORDS_SEASON3, généré)
        │  seeders/sync-rosters.ts (bouton admin ou CLI db:sync-rosters --write)
        ▼
DB : Position.keywords            (163 positions season_3)
        │  transformRoster / transformPosition
        ▼
API : /api/rosters/:slug & /api/positions/:slug → champ `keywords`
        ▼
Web : KeywordTags (étiquettes) sur la table équipe, la carte mobile et la
      page de détail position. data-testid="position-keywords".
```

## Pièces

- **Générateur** `scripts/generate-keywords-season3.ts` — mirroir de
  `generate-skill-access-season3.ts` : parse les sections `## <Équipe>`, extrait
  la parenthèse de chaque ligne positionnelle, aligne **par ordre intra-roster**
  au slug (même logique de matching que les accès), émet `KEYWORDS_SEASON3`.
  `tsx scripts/generate-keywords-season3.ts --write`.
- **Fichier généré** `packages/game-engine/src/rosters/keywords-season3.ts` —
  `Record<string, string>` slug → CSV `"Race, Type"`. ⚠️ Ne pas éditer à la
  main, régénérer.
- **Sync** `apps/server/src/seeders/sync-rosters.ts` — écrit `keywords` depuis
  `KEYWORDS_SEASON3` (uniquement `season_3`, `null` ailleurs). Appliqué via le
  bouton **Admin → Utilitaires → Synchroniser les rosters** ou le CLI.
- **API** `public-rosters.ts` + `public-positions.ts` — `keywords` ajouté aux
  payloads (déjà chargé via `include`).
- **Web** `teams/[slug]/TeamDetailClient.tsx` (composant `KeywordTags`) et
  `teams/[slug]/[position]/page.tsx`.

## Périmètre

- **season_3 uniquement** : la markdown source est BB2025. Les positions
  `season_2` (noms anglais génériques) gardent `keywords = null` (pas de source).
- **163 positions** season_3 renseignées (toutes celles du code, alignement
  parfait markdown ↔ rosters).

## Mise à jour en prod

Après déploiement du code, lancer le sync (bouton admin ou
`db:sync-rosters --ruleset=season_3 --write`) pour peupler la colonne, puis
attention aux **deux caches** (mémoire serveur 5 min + HTTP/Next 1 h) — cf.
[high-elf-roster-s3-fix-2026-06-05.md](./high-elf-roster-s3-fix-2026-06-05.md).
Le bouton admin invalide le cache mémoire ; côté navigateur / ISR Next
(`revalidate=3600`), patienter ou hard refresh.

## Traduction EN (2026-06-16)

`packages/game-engine/src/rosters/keyword-translations.ts` : dictionnaire
FR→EN des tokens (lignée + type), lookup normalisé (casse/accents/tirets) pour
absorber les variantes de la source. `translateKeywordsCsv(csv, lang)` traduit
un CSV (repli FR si token inconnu). L'API renvoie désormais **`keywordsEn`** en
plus de `keywords` (toujours traduit, comme `displayNameEn`) ; le front choisit
selon `useLanguage`.

## Filtre par mot-clé (2026-06-16)

Page `/teams/positions` : composant client `PositionKeywordBrowser` qui liste
les mots-clés distincts (dédupliqués insensible casse/variantes) en étiquettes
toggables. Sélection = **ET logique** (ex: `Elfe` + `Blitzer` → blitzers elfes).
Bilingue. Helpers purs testés dans `position-keyword-filter.ts`
(`collectKeywordOptions`, `filterPositionsByKeywords`). `keywords`/`keywordsEn`
ajoutés à `ListedPosition`.

## Suivi possible

- Recherche texte libre en plus des chips.
- Grouper les chips par catégorie (lignée vs type de joueur).
