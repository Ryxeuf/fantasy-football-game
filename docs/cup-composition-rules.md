# Règles avancées de composition des coupes

> Mode coupe uniquement. Tous les champs de config sont optionnels et à défaut
> neutre : une coupe sans config se comporte comme avant (rétro-compatible).

## Vue d'ensemble

Le commissaire peut moduler la construction des équipes d'une coupe :

- **Mode résurrection** : à chaque match de coupe, l'équipe repart de son
  snapshot d'inscription — aucun PSP gagné, aucune blessure/mort/gain conservés.
- **Budget max par tier** (I/II/III/IV) du roster, avec **override par roster**.
- **Pool de PSP de départ** (par tier) que le coach dépense en améliorations au
  build (mode « édition avancée »).
- **Ruleset + format imposés** : la coupe porte un `ruleset` et un `format`
  (`bb11`/`sevens`). Les équipes inscrites doivent les respecter — vérifié à
  l'inscription (Flow A) et verrouillé dans le builder (Flow B).
- **Une équipe = une seule compétition active** : une équipe déjà engagée dans
  une coupe (`ouverte`/`en_cours`) ou une saison de ligue active est indisponible
  pour toute autre inscription. Garde partagée `services/team-competition-status.ts`
  (`getTeamEngagement`) appliquée à `POST /cup/:id/register` (409) et à
  `addParticipant` (ligue).
- **Parcours d'inscription** :
  - **Flow A — inscrire tel quel** : l'équipe existante doit déjà respecter le
    budget + PSP de la coupe ; vérifiée à l'inscription (`POST /cup/:id/register`).
    Le budget se compare à la **dépense de construction**
    (`buildTeamBudgetSummary.totalSpent` : embauches, relances, staff, fans
    dévoués, Star Players, coups de pouce de création), jamais à la VE — les Star Players n'entrent pas
    dans la VE, une équipe de VE 1 000k ayant payé 150k de stars passait
    sous un budget de 1 000k.
  - **Flow B — construire pour la coupe** : builder avec `?cupId=`, budget/pool/
    ruleset/format imposés et verrouillés, équipe auto-inscrite (`POST /team/build`).
  - **Clone & adapter** : builder avec `?cupId=…&fromTeamId=…` — préremplit la
    compo/staff/stars depuis une équipe de base, applique le budget + PSP de la
    coupe (surplus à dépenser), crée une **copie** inscrite ; l'équipe de base
    reste libre. Les advancements de la base ne sont pas recopiés (chacun repart
    du pool de PSP de la coupe). Ses coups de pouce le sont, s'ils sont
    autorisés par la coupe (cf. ci-dessous).
- **Coups de pouce** : achetés à la création (`build`), en avant-match
  (`match`) ou interdits (`none`) — section dédiée ci-dessous.

## Coups de pouce : `build` / `match` / `none`

Une coupe rejoue son roster d'inscription à chaque ronde (résurrection) : un
coup de pouce acheté en avant-match se rachète donc à chaque ronde, sur un
budget d'écart de VEA. Les tournois (NAF World Cup…) font l'inverse : on les
paie UNE fois sur le budget de construction et ils valent pour toute la
compétition. D'où `Cup.inducementMode` :

| Mode | Achat | Feuille de match |
|---|---|---|
| `build` | au build, sur le budget d'or (`TeamInducement`) | rappel en lecture seule, aucun achat (400 `inducements_locked`) |
| `match` | en avant-match, Petite Monnaie = écart de VEA | éditeur habituel, **sans trésorerie** |
| `none` | jamais | aucun achat (400) ; les Star Players d'inscription jouent |

- **Défauts, sans backfill** (`services/cup-inducement-mode`, pur) : colonne
  nullable SANS `@default` — `null` (coupe antérieure) se lit `match`. Une
  coupe BB11 NEUVE naît `build` (écrit par `POST /cup`), une coupe de Sept ne
  peut pas l'être (400 `build_not_allowed_in_sevens`), un règlement de
  tournoi impose `build` quoi qu'on demande. `resolveCupInducementMode` donne
  le mode EFFECTIF, servi par `rulesConfig.inducementMode`.
- **Liste autorisée** (`Cup.allowedInducements`, `null` = tout le catalogue) :
  sans règlement seulement — sous règlement, c'est sa liste fermée et ses prix
  qui s'appliquent (remise d'équipe comprise, plafond « Arme Secrète »).
- **Un seul catalogue de build** (`services/inducement-options` →
  `buildInducementCatalogue`) : prix pour CE roster, liste de la coupe ou du
  règlement, hors Star Players (recrutés à part) et hors coups de pouce à coût
  variable. Servi au builder (`GET /team/build-inducements`) ET relu par
  `POST /team/build`, qui tarife lui-même : un prix envoyé par le client est
  ignoré (`resolveBuildInducements`).
- **Sous règlement, l'or non dépensé est PERDU** (trésorerie 0,
  `treasuryCredit`) ; sans règlement, il part en trésorerie comme avant.
- **Snapshot** : `captureRosterSnapshot` fige les coups de pouce
  (`RosterSnapshot.inducements`, nommés). Une équipe modifiée après coup ne
  change rien aux rencontres de la coupe ; un snapshot antérieur se lit sans
  coup de pouce (`parseSnapshotInducements`).
- **Inscription telle quelle** : une équipe porteuse de coups de pouce n'entre
  qu'en coupe `build`, et seulement s'ils tiennent dans le catalogue effectif
  de la coupe (liste, plafonds) — sinon 422 `inducement_not_allowed`, qui
  oriente vers « Adapter à la coupe ».
- **Adapter à la coupe** : les coups de pouce de l'équipe de base que la coupe
  autorise sont repris au prix de la COUPE (bornés à son plafond), les autres
  listés comme écartés.

Piège : une coupe n'a **pas de trésorerie**. Le budget d'avant-match d'une
coupe en `match` est l'écart de VEA (Petite Monnaie) seul — la trésorerie
affichée par l'équipe est celle de sa vie hors coupe et se rejouerait à
chaque ronde, comme tout le reste du roster d'inscription.

## Modèle de données (`prisma/schema.prisma`)

- `Cup` : `resurrectionMode Boolean`, `tierBudgets Json?`,
  `rosterBudgetOverrides Json?`, `tierStartingPsp Json?`,
  `rosterStartingPspOverrides Json?` (maps kpo / PSP).
- `Cup` : `inducementMode String?` (`build` | `match` | `none`, `null` =
  `match`), `allowedInducements Json?` (slugs, `null` = tout le catalogue).
- `CupParticipant` : `rosterSnapshot Json?` (roster figé à l'inscription,
  Star Players et coups de pouce compris), `pspPoolGranted Int`.
- `TeamInducement` : coups de pouce achetés à la création (`slug`,
  `quantity`, `unitCost` payé), unique par équipe × slug.
- `Team` : `startingPspPool Int` (pool alloué au build ; PSP dépensés = Σ coûts
  des advancements des joueurs — les joueurs restent à `spp = 0`).

> Colonnes JSON : objet natif (Postgres) ou string sérialisée (miroir SQLite de
> test). Écriture via `JSON.stringify`, lecture via un parser tolérant
> (`services/cup-rules.ts#parseNumberMap`).

## Résolution des règles (`services/cup-rules.ts`, pur)

- `resolveCupBudget(cup, roster)` — précédence **override roster > tier >
  budget par défaut du roster**.
- `resolveCupStartingPsp(cup, roster)` — **override roster > PSP du tier > 0**.
- `teamAdvancementsPspCost(players)` — coût PSP cumulé des améliorations (Flow A).

## PSP au build (`services/cup-build-advancements.ts`)

`applyCupBuildAdvancements(teamId, pool, advancements[])` réutilise
`applyAdvancementChoice` (validation d'accès, anti-triche random-primary,
surcharge de VE) via l'astuce « créditer-puis-dépenser » : on crédite le joueur
du coût exact, `applyAdvancementChoice` le consomme (solde `spp` inchangé), et le
pool est décrémenté. Le build est « tout ou rien » : `handleBuildTeam` supprime
l'équipe si une amélioration est refusée.

## Mode résurrection (`services/resurrection.ts` + `routes/local-match.ts`)

À la complétion d'un match de coupe en résurrection,
`shouldPersistMatchOutcome` renvoie `false` → aucun SPP/blessure/mort n'est
persisté. Le roster live reste identique au snapshot d'inscription.

## Frontend

- `cups/page.tsx` — section « Règles de composition » à la création, dont le
  régime des coups de pouce (`CupInducementModeField` : `build` présélectionné
  en BB11, imposé et grisé sous règlement, absent en Sept) et la liste
  autorisée (`AllowedInducementsField`, partagé avec `LeagueForm`).
- `cups/[id]/page.tsx` — affichage des règles (mode et liste des coups de
  pouce compris) + bouton « Construire pour cette coupe » (Flow B).
- `me/teams/new/page.tsx` — mode « édition avancée » (budget custom + pool),
  `?cupId=` verrouille budget + pool ; allocateur de PSP
  (`BuildAdvancementAllocator.tsx`).
- `me/teams/new/BuildInducementPicker.tsx` — section « Coups de pouce » du
  builder (coupe en `build` ou règlement), catalogue servi par le serveur.
- `me/teams/[id]/page.tsx` — budget de départ + bloc PSP (pool / dépensés /
  disponibles) + coups de pouce de création (`TeamInducementsPanel`).

## Invitations de coupe

Le créateur d'une coupe peut inviter des coachs (utile pour les coupes privées) :
- **Lien partageable** (`code` public) ou **invitation personnelle** (coach ciblé
  via autocomplete). Modèle `CupInvitation` (miroir simplifié de
  `LeagueInvitation`, sans saison), service `cup-invitation.ts`, notif non
  bloquante `cup-invitation-notify.ts`, routes `cup-invitation.ts` montées sous
  `/cup` **avant** `cupRoutes`.
- L'invité ouvre `/cups/invitations/:code`, choisit une équipe existante (ou
  construit pour la coupe via Flow B) → l'inscription réutilise `registerTeamToCup`
  (`services/cup-registration.ts`, logique extraite de `POST /:id/register`).
- UI : `CupInvitationsManager` (créateur), `cups/invitations/[code]/page.tsx`
  (acceptation), `PendingCupInvitations` (invitations reçues sur `/cups`).

## Classements individuels (leaderboards)

`services/cup-player-stats.ts` agrège par joueur depuis `LocalMatchAction` :
marqueur, castagneur, agresseur, passeur, intercepteur, sac de frappe. Exposé
dans `GET /cup/:id` (`playerLeaderboards`), affiché sur le détail coupe. Exclut
« future star » (PSP, absents en coupe) et « MVP » (aucun MVP en coupe).

## Divers

- **Description** de coupe (optionnelle) affichée dans la liste ; badges format +
  « règles ajustées/standard ». **Mode résurrection** forcé (seul mode dispo).
  L'inscription se fait depuis la page de la coupe : « tel quel » si aucun
  ajustement, sinon « Adapter à la coupe » (clone).

## Endpoints

- `POST /cup` — accepte la config de composition + `description`,
  `inducementMode`, `allowedInducements`.
- `PATCH /cup/:id/rules` — met à jour la config (créateur/admin, avant validation).
- `GET /cup/:id` — expose `rulesConfig`.
- `POST /cup/:id/register` — Flow A : valide les coups de pouce (régime et
  catalogue de la coupe), le budget (sur la dépense de construction) + PSP
  (si la coupe définit ces règles) et capture le snapshot.
- `POST /team/build` — champs `cupId?`, `startingPspPool?`, `advancements?`,
  `inducements?` (`[{ slug, quantity }]`, tarifés par le serveur).
- `GET /team/build-inducements` — catalogue de build pour un roster, une coupe
  (`cupId`) ou un règlement, `stars` pour le plafond « Arme Secrète ».
