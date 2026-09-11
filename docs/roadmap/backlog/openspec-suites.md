# Suites identifiées hors périmètre des changes archivés

> Dernière mise à jour : 2026-09-11
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

## Coupes gérées comme les ligues

Sources : `cups-managed-like-leagues`, `cup-pools-and-playoffs` et
`cup-calendar-by-pool` (tous archivés 2026-09-10).
La feuille de match, les trois systèmes d'appariement, les critères de
classement, l'édition d'une coupe, les poules, les play-offs et le calendrier
groupé par poule sont livrés. La parité UI, elle, n'est pas complète —
26 000 lignes d'écrans de ligue contre 4 700 de coupe au départ. Restent :

- ~~**Poules de coupe**~~ — livré par `cup-pools-and-playoffs` (2026-09-10) :
  `CupPool`, appariement par groupe, classement par poule,
  `CupPoolsManagerPanel`.
- ~~**Playoffs de coupe**~~ — livré par `cup-pools-and-playoffs` (2026-09-10) :
  bracket seedé (moteur partagé avec la ligue), publication différée, seeds
  éditables, `CupPlayoffBracketView`.
- ~~**Calendrier de coupe groupé par poule, poule du coach en premier**~~ —
  livré par `cup-calendar-by-pool` (2026-09-10) : la règle de groupement est
  désormais COMMUNE aux deux compétitions (`lib/competition-pools`), la coupe
  n'ajoutant que « une ronde de bracket ne se groupe pas ».
- **Export PDF d'une ronde** (`MatchdayExport` côté ligue).
- **Relance des coachs d'une ronde** (`league-round-followup` côté ligue).
- **Page de récapitulatif et palmarès d'une coupe** : les championnats de
  coupe sont recalculés à la demande (`getCoachCupChampionships`) et ne sont
  jamais persistés ; une clôture de coupe ne fige donc aucun palmarès.
- **Éditeur de roster commissaire côté coupe** (le dossier `commissioner/`
  des ligues, 1 700 lignes).
- **i18n de `apps/web/app/cups/[id]/page.tsx`** : encore majoritairement en
  français en dur, là où la page de ligue passe intégralement par
  `useLanguage()`. Même remarque pour `cups/page.tsx`, `cups/archived/` et
  `admin/cups/**`, qui réimplémentent aussi leur propre `fetchJSON` au lieu
  d'`apiRequest`.
- **`POST /team/create-from-roster`** (assistant « première équipe »)
  n'applique ni contexte de coupe ni pool de PSP : une équipe créée par ce
  chemin pour une coupe à règlement est refusée à l'inscription.
- **Miroir SQLite** : `LeagueMatchEvent.meta` y est `String?` alors que
  PostgreSQL accepte un objet — la mi-temps et le tour d'un évènement ne sont
  donc pas testables en e2e-api.

## Partie offline désactivée

Source : `disable-offline-matches` (archivé 2026-09-11). La brique
`/local-matches` est gatée par `offline_match`, OFF par défaut : elle n'est
ni supprimée ni maintenue. Ce qui reste à trancher :

- **La mûrir ou la retirer.** Tant que le flag dort, le code (≈ 1 800 lignes
  de route, quatre écrans, `LocalMatchAction`) vit sans utilisateur. Soit on
  la réaligne sur la feuille de match (séquence de fin de match, VE, PSP),
  soit on la retire — en gardant le modèle `LocalMatch`, qui porte la
  matérialisation du résultat d'une feuille de coupe.
- **`/admin/local-matches` reste ouvert** (bypass de rôle admin, page hors
  du gate) : c'est voulu tant que des parties d'historique existent, à
  reconsidérer le jour où la brique est retirée.
- **Le partage par jeton** (`/local-matches/share/<token>`) tombe avec le
  gate : un lien envoyé à un adversaire avant la coupure n'ouvre plus rien.
  Acceptable au moment de la bascule, à revoir si la brique revient.

## Relever le Mort (Maîtres de la Non-vie)

Source : `raise-the-dead-masters-of-undeath` (2026-09-11).

- **Trait Contagieux (Nurgle)** : même recrutement d'un Trois-quart relevé,
  mais déclenché sur un BLOCAGE du porteur du Trait, une fois par match, et
  seulement si la victime n'a ni Décomposition, ni Régénération, ni Minus
  (ni Gros Bras). La dérivation `league-sheet-raised-dead` est prête à
  recevoir une seconde source d'éligibilité ; il manque la lecture de
  `causedByPlayerId` + cause « block » et les Traits du causeur / de la
  victime.
- **Blessures durables du relevé pendant le match** : s'il est recruté, ses
  blessures de la rencontre ne sont pas reportées sur le `TeamPlayer` créé
  (même limite que le journalier recruté).

## Opérations à faire au déploiement

Ces tâches ne sont pas du code : elles restent dues sur staging/prod et
étaient cochées « à faire au déploiement » dans leurs changes respectifs.

| Change | Opération |
|--------|-----------|
| `add-roster-staff-config` | `prisma db push` + `seed-roster-staff-config` |
| `fix-league-status-lifecycle` | `tsx src/scripts/backfill-league-status.ts --dry-run` puis exécution |
| `fix-qa-log-2026-07` | `db-migrate.sh --seed` manuel + restart serveur + re-validation testeur |
| `add-site-search`, `improve-league-match-sheet-ux` | Vérification visuelle sur staging |
| `disable-offline-matches` | « Synchroniser depuis le code » dans `/admin/feature-flags` (ou passage de seed) pour créer la ligne `offline_match`. Sans elle la brique est déjà vue comme désactivée — la ligne sert à pouvoir la RALLUMER. |
| `raise-the-dead-masters-of-undeath` | `prisma db push` (colonnes `LeagueMatchSheet.raisedDeadHome/Away`, nullables, aucun backfill). |
