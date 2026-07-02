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
  - **Flow B — construire pour la coupe** : builder avec `?cupId=`, budget/pool/
    ruleset/format imposés et verrouillés, équipe auto-inscrite (`POST /team/build`).
  - **Clone & adapter** : builder avec `?cupId=…&fromTeamId=…` — préremplit la
    compo/staff/stars depuis une équipe de base, applique le budget + PSP de la
    coupe (surplus à dépenser), crée une **copie** inscrite ; l'équipe de base
    reste libre. Les advancements de la base ne sont pas recopiés (chacun repart
    du pool de PSP de la coupe).

## Modèle de données (`prisma/schema.prisma`)

- `Cup` : `resurrectionMode Boolean`, `tierBudgets Json?`,
  `rosterBudgetOverrides Json?`, `tierStartingPsp Json?`,
  `rosterStartingPspOverrides Json?` (maps kpo / PSP).
- `CupParticipant` : `rosterSnapshot Json?` (roster figé à l'inscription),
  `pspPoolGranted Int`.
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

- `cups/page.tsx` — section « Règles de composition » à la création.
- `cups/[id]/page.tsx` — affichage des règles + bouton « Construire pour cette
  coupe » (Flow B).
- `me/teams/new/page.tsx` — mode « édition avancée » (budget custom + pool),
  `?cupId=` verrouille budget + pool ; allocateur de PSP
  (`BuildAdvancementAllocator.tsx`).
- `me/teams/[id]/page.tsx` — budget de départ + bloc PSP (pool / dépensés /
  disponibles).

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

- `POST /cup` — accepte la config de composition + `description`.
- `PATCH /cup/:id/rules` — met à jour la config (créateur/admin, avant validation).
- `GET /cup/:id` — expose `rulesConfig`.
- `POST /cup/:id/register` — Flow A : valide budget + PSP (si la coupe définit
  ces règles) et capture le snapshot.
- `POST /team/build` — champs `cupId?`, `startingPspPool?`, `advancements?`.
