# Suites identifiées hors périmètre des changes archivés

> Dernière mise à jour : 2026-10-05
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

## Sorties = éliminations qui rapportent des PSP

Source : `casualties-are-spp-eliminations` (2026-09-11). La définition d'une
sortie est unique (`eliminationEarnsSpp`), les Prières 10, 11 et 13 sont
câblées. Restent :

- **Prière 12 « Interaction avec les Fans »** (2 PSP à qui pousse un
  adversaire dans le Public) : la feuille ne saisit pas l'auteur d'une
  sortie par le public (« la foule n'a pas d'acteur »). Câbler la prière
  demande un picker « poussé par » sur `crowd_surge`, puis une entrée dans
  `eliminationEarnsSpp` — la sortie deviendrait alors une sortie (Sor+,
  cogneurs) pour le côté béni.
- **Saisons clôturées** : le rattrapage les ignore (palmarès persisté), que
  ce soit par le script ou par le balayage automatique — la feuille est même
  MARQUÉE comme traitée pour ne pas être retentée à chaque consultation. À
  reprendre au cas par cas si une ligue close veut ses colonnes Sor+/Sor-
  exactes : il faudrait rouvrir la saison, lire son classement, la reclôturer.

## Rattrapage automatique des compteurs persistés

Source : `casualty-count-and-hate-keyword-choice` (2026-09-16). Le rattrapage
des sorties se déclenche seul à la lecture du classement, avec un marqueur
versionné (`LeagueMatchSheet.casualtyRuleVersion`). Restent :

- **Première lecture coûteuse** : sur une ligue ancienne, la première
  consultation du classement resynchronise toutes ses feuilles d'un coup
  (quelques requêtes par feuille). Acceptable une fois ; à surveiller si une
  saison dépasse la cinquantaine de rencontres.
- **`coach-championships` balaie saison par saison** : le palmarès d'un coach
  appelle `computeSeasonStandings` pour chacune de ses saisons, donc une
  requête de balayage par saison même une fois tout marqué. À regrouper si le
  coût se voit.
- **Le script d'opérateur reste** (`db:resync-sheet-casualties`) : seul chemin
  pour une saison clôturée ou pour forcer une rencontre précise.

## Relever le Mort (Maîtres de la Non-vie)

Source : `raise-the-dead-masters-of-undeath` (2026-09-11).

- ~~**Trait Contagieux (Nurgle)**~~ — livré par `contagious-plague-ridden`
  (2026-09-12) : seconde source `plague_ridden` du même joueur relevé.
- **Deux relevés sur le même côté** quand les deux règles jouent dans le même
  match (Morts-Vivants qui engagent Guffle Pussmaw) : un seul choix par côté,
  la victime gratuite étant préférée. Source `contagious-plague-ridden`.
- **Blessures durables du relevé pendant le match** : s'il est recruté, ses
  blessures de la rencontre ne sont pas reportées sur le `TeamPlayer` créé
  (même limite que le journalier recruté).

## Ordre de classement d'une ligue

Source : `league-standings-order` (2026-09-17 → 2026-09-18).

- **Additionner les bonus aux points.** `points` reste le barème
  win/draw/loss pur et `Bo` son sous-total, compté à part ; les bonus sont un
  critère de DÉPARTAGE, pas une redéfinition du total. Une ligue qui voudrait
  classer sur `points + bonus` n'a aucun levier. Ce n'est pas un réglage de
  plus : le total nourrit aussi les awards de fin de saison
  (`league-scoring`) et le seeding des play-offs, qui devraient le suivre.
- **Le commissaire reste bloqué sur TOUT le reste après le premier match.**
  Seul l'ordre du classement lui échappe (il est appliqué à la lecture). Le
  reste — barème, rosters autorisés, points bonus, coups de pouce — reste
  gelé parce qu'il réécrirait des points déjà attribués ; le jour où l'un
  d'eux devient corrigeable, il lui faudra son propre rattrapage, comme les
  sorties ont eu le leur.
- **Aucun ordre par POULE ni par phase.** Une ligue à poules applique le même
  ordre partout, et le bracket de play-offs n'en dépend pas.

## Pronostics de ligue

Source : `league-match-predictions` (archivé 2026-09-27, #1034). Pick'em à
points par rencontre de ligue, portée `off | members | open`, clôture
write-once, classement Coachs / Tribunes, Oracle au palmarès. Restent :

- **Les coupes.** Le modèle s'appelle déjà `CompetitionPrediction` : il
  accueillera un `cupPairingId` nullable (XOR `pairingId`, invariant tenu par
  le service, patron `CompetitionDocument`) — sans renommage, qui serait un
  DROP + CREATE sous `db push`.
- **Les Crowns (phase 2).** Les points restent des points tant qu'aucun puits
  de Crowns n'existe hors Pro League (gelée). Le jour où il en existe un, la
  conversion peut être RÉTROACTIVE (« N Crowns par point, plafond par
  saison »), puisque les points se dérivent des pronostics réglés — gate
  décrite au §5 de `docs/roadmap/explorations/2026-09-27-pronostics-de-ligue.md`.
- **Widget « pronostics à faire »** sur l'accueil connecté, et **puce « ton
  prono »** dans les cartes du calendrier (`MatchCard`).
- **D'autres types de pronostics** (sorties, morts, TD pairs…), lisibles dans
  le résumé de feuille mais hors v1.
- Trouvé au passage : `services/pro-badges.ts` utilise encore
  `createMany({ skipDuplicates })`, absent du miroir SQLite (Pro League
  gelée) ; et le serveur lancé par `tests/e2e-api/setup.ts` survit à la fin
  de la suite (`proc.kill()` ne tue pas l'arbre `pnpm → tsx → node`), si bien
  que le run suivant le réutilise et échoue en `ECONNREFUSED` quand il meurt.

## Thèmes de dés et Couronnes

Source : `dice-themes` puis `dice-theme-shop-and-crowns` (archivés
2026-10-05). Le dé original est servi partout ; boutique (flag `dice_themes`)
et Couronnes (flag `crowns`) sont en recette. Restent :

- **Sources de Couronnes hors Pro League** : aujourd'hui seul l'admin en
  crédite (`PATCH /admin/wallets/:id/balance`). Bonus quotidien, récompenses
  de ligue ou d'Oracle des pronostics (cf. la suite « conversion rétroactive »
  ci-dessus) sont à décider avant d'ouvrir `crowns` à tous.
- **App mobile (Expo)** : le choix de blocage y reste textuel, aucun dé
  dessiné ; brancher `@bb/ui/dice` (skins) côté React Native.
- **Upload de nouvelles faces depuis l'admin** : un thème reste un contrat de
  code (PNG du dépôt + skin + entrée du catalogue). Un upload suivrait le
  patron « Upload de binaire » de CLAUDE.md.
- **Thème de l'adversaire en match en ligne** : chacun voit ses propres dés ;
  afficher ceux du lanceur demanderait de servir son thème dans l'état du
  match.

## Pro League — coach persisté et exploitation (lots 4 et 5)

Source : `pro-league-coach-evolution` et `pro-league-exploitation` (archivés
2026-10-06, #1057). Le coach de chaque équipe est une persona persistée qui
évolue de façon bornée ; les simulations tournent dans un pool de
`worker_threads`, les matchs en direct se clôturent d'eux-mêmes et les
replays anciens sont purgés. La Pro League reste gelée
(`PRO_LEAGUE_ENABLED=false`). Restent :

- **Gazette : un paragraphe « le coach » par match**, à partir du résumé
  d'évolution (`ProCoachMemory.summary`).
- **Comparer deux coachs d'une même race** après une saison (console admin),
  avec alerte quand un profil reste collé à une borne de la bande `ancre ± 15`.
- **Rejouer l'historique** (`ProCoachMemory`) pour recalculer la mémoire si
  la règle d'adaptation change (script `db:replay-coach-memory`).
- **Estimateur de cotes calibré sur le bench nocturne** : remplacer les 50
  runs par une table race × race (décision 1 de l'exploration), puis retirer
  le driver hybride une fois l'estimateur en place.
- **Comparaison automatique de deux rapports nocturnes**
  (`sim:compare-versions` sur `bench/nightly/*.json`) avec alerte.
- **Live « par coups » du viewer**, différé depuis le lot 2.
- **Décision de dégel** (`PRO_LEAGUE_ENABLED`) : produit, après le panel
  humain de la gate du lot 3.

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
| ~~`casualties-are-spp-eliminations`~~ | **Plus rien à faire** depuis `casualty-count-and-hate-keyword-choice` : le rattrapage se déclenche à la première lecture du classement de chaque saison. Le script `db:resync-sheet-casualties` reste disponible pour une saison clôturée (que le balayage ignore) ou pour forcer une rencontre (`-- --pairing <id>`). |
| `raise-the-dead-masters-of-undeath` | `prisma db push` (colonnes `LeagueMatchSheet.raisedDeadHome/Away`, nullables, aucun backfill). |
| `casualty-count-and-hate-keyword-choice` | `prisma db push` (colonnes `LeagueMatchSheet.casualtyRuleVersion` et `hateChoices`, nullables, aucun backfill) — joué automatiquement par `scripts/deploy.sh` (étape 3/5). Puis ouvrir une fois le classement de chaque ligue active pour déclencher le rattrapage. |
| `dice-theme-shop-and-crowns` | `prisma db push` (tables `DiceTheme`, `UserDiceTheme`), joué par `scripts/deploy.sh`. Le catalogue sert le compilé tant que la table est vide ; le seed (`syncDiceThemes`, create-if-missing) la remplit pour l'éditer en admin. Créer la ligne du flag `crowns` (seed ou « Synchroniser depuis le code » dans `/admin/feature-flags`) pour pouvoir l'allumer. |
| `league-match-predictions` | `prisma db push` (table `CompetitionPrediction`, colonnes `League.predictionsScope`, `LeaguePairing.predictionsClosedAt`, `LeagueRound.predictionsNotifiedAt`, nullables, aucun backfill) — joué automatiquement par `scripts/deploy.sh`. Les ligues existantes démarrent SANS pronostics (`null` ⇒ `off`) : c'est leur commissaire qui les active. |
| `pro-league-coach-evolution` | `prisma db push` (tables `ProCoach`, `ProCoachMemory`), joué par `scripts/deploy.sh`. Aucun backfill : le coach d'une équipe se crée à son premier match. Variables optionnelles du lot 5 : `PRO_LEAGUE_SIM_WORKERS`, `PRO_LEAGUE_COMPLETION_TICK_MS`, `PRO_LEAGUE_REPLAY_RETENTION_DAYS`. |
