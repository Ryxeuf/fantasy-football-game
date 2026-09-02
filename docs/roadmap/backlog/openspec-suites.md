# Suites identifiées hors périmètre des changes archivés

> Dernière mise à jour : 2026-09-02
> Statut : **suites consignées**, non scopées.

Quand un change OpenSpec est archivé, ses tâches « hors périmètre » /
« hors lot » / « suites possibles » partent avec lui dans
`openspec/changes/archive/`. Ce fichier les remonte à la surface pour
qu'elles restent trouvables sans fouiller l'archive.

Contrairement à [`future-ideas.md`](./future-ideas.md), **aucune gate ne
s'applique ici** : ce sont des suites naturelles de travaux déjà livrés, pas
des paris produit. Elles se piochent au fil de l'eau.

## Règlements de tournoi (NAF World Cup 2027)

Source : `add-tournament-ruleset-selection` (archivé 2026-09-02).
Le pack est appliqué au budget, au pool de SPP, aux restrictions de Star
Players et au barème de cumul de compétences. Restent :

- **Liste officielle des Elite Skills du pack** (surcoût +2 SPP) à intégrer.
- **Modélisation des escouades** : 6 coachs, unicité roster/star au sein de
  l'escouade, scoring d'escouade.
- **Résurrection côté ligues à règlement** : neutraliser SPP et blessures
  entre les matchs, comme `Cup.resurrectionMode` le fait déjà pour les coupes.
- **Enforcement en match de la liste fermée de coups de pouce** du pack (elle
  est aujourd'hui affichée mais pas contrainte).

## Star Players

Source : `add-star-player-keywords` (archivé 2026-09-02).

- **Confronter la table des mots-clés au PDF officiel GW « Star Players! »**
  — les 68 entrées ont été dérivées, pas relues ligne à ligne contre la source.
- **Page d'index par mot-clé** (`/star-players/mots-cles/<kw>`), si le besoin
  de navigation se confirme.

## Statut des joueurs (morts / licenciements)

Source : `manage-player-deaths-and-firings` (archivé 2026-09-02).

- **Aligner `ProTeamRoster.status`** (Pro League) sur le même modèle de
  provenance + journal que `TeamPlayer`.
- **Exposer `getPlayerStatusHistory`** sur la fiche joueur.
- **Renumérotation automatique** quand un licencié libère son numéro.

## Règle Capitaine

Source : `add-team-captain-rule` (archivé 2026-09-02).

- **Hint UI dédié** dans l'écran de setup online quand le capitaine n'est pas
  aligné (la règle impose son alignement, l'écran ne le dit pas).
- **Capitaine dans la Pro League simulée** (`sim-engine`) : la relance
  d'équipe gratuite sur 6 naturel n'est pas modélisée côté sim.

## Renommage & partage d'équipe

Sources : `add-team-rename`, `enhance-roster-share-preview` (archivés 2026-09-02).

- **Modération (blocklist) du nom d'équipe et de la description** — le
  pattern existe déjà pour les commentaires
  (`detectBlocklist`, cf. `CLAUDE.md` § blocklist regex auto-flag).
- **Historique des noms** dans l'onglet Journal de l'équipe : `TeamAuditEvent`
  trace déjà le renommage, il reste à l'exposer.
- **Pages déclarant leur propre `openGraph` sans `images`** : elles
  n'héritent pas de l'image de partage par défaut.

## Cartes de joueur

Source : `export-player-cards` (archivé 2026-09-02).

- **Portraits maison** (pipeline webp→png) si des artworks propres au site
  voient le jour.
- **Bouton carte** sur les joueurs Pro League / page carrière.
- **Planche d'impression 3×3** (PDF A4) pour imprimer un roster entier.

## Pages de positionnels

Source : `add-position-pages` (archivé 2026-09-02).

- **JSON-LD `ItemList`** des positions sur `/teams/[slug]`.
- **E2E Playwright** `/teams/skaven` → position → compétence.

## Opérations à faire au déploiement

Ces tâches ne sont pas du code : elles restent dues sur staging/prod et
étaient cochées « à faire au déploiement » dans leurs changes respectifs.

| Change | Opération |
|--------|-----------|
| `add-roster-staff-config` | `prisma db push` + `seed-roster-staff-config` |
| `fix-league-status-lifecycle` | `tsx src/scripts/backfill-league-status.ts --dry-run` puis exécution |
| `fix-qa-log-2026-07` | `db-migrate.sh --seed` manuel + restart serveur + re-validation testeur |
| `add-site-search`, `improve-league-match-sheet-ux` | Vérification visuelle sur staging |
