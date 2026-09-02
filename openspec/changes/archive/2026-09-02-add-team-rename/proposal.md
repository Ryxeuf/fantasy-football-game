# Renommage d'équipe après la création

## Why

Le nom d'équipe est saisi à la création et n'est plus modifiable ensuite,
sauf par un détour qui ne marche presque jamais :

- `PUT /team/:id` (`handleUpdateTeam`) accepte bien un `name`, mais exige
  la liste COMPLÈTE des joueurs (`players` requis, ids exhaustifs) — ce
  n'est pas un endpoint de renommage, c'est une sauvegarde de roster.
- `PUT /team/:id/roster` (page « Modifier l'équipe ») accepte aussi un
  `name`, mais passe par le verrou anti-triche : les deux routes rendent
  403 `TEAM_ENGAGED_MESSAGE` dès que l'équipe est engagée (match, ligue,
  coupe). Or c'est précisément là que le coach vit avec son équipe.

Résultat : une faute de frappe à la création est définitive dès le premier
match, et un coach qui rejoint une ligue ne peut plus aligner son nom sur
celui de sa bande. La demande revient régulièrement.

Le nom est pourtant purement COSMÉTIQUE : il ne pèse ni sur la VE, ni sur
le budget, ni sur la composition. Le repo a déjà tranché ce cas de figure
pour l'identité des joueurs (E12, `PATCH /team/:id/players/:playerId/
identity`) : cosmétique ⇒ éditable même équipe engagée.

## What Changes

- **Serveur.** Nouveau service `services/team-rename.ts`
  (`renameTeam`, `TeamRenameError` typée) et route
  `PATCH /team/:id/name` `{ name }` réservée au propriétaire. Autorisée
  quelle que soit l'ancienneté de l'équipe, MATCH EN COURS ET LIGUE
  INCLUS : le nom affiché en match est figé dans l'état de jeu à
  `setupPreMatchWithTeams`, un renommage ne peut donc pas réécrire une
  partie en cours.
- **Journal.** Chaque renommage écrit une étape `team.rename` via
  `safeRecordTeamAudit` (avec `before`), donc `name: { from, to }` dans
  le diff, plus le libellé français dans `ACTION_LABELS`. C'est la
  contrepartie de l'ouverture : un nom qui change en pleine ligue reste
  reconstituable.
- **UI web.** Édition inline du nom sur la fiche `/me/teams/[id]`,
  composant `TeamNameInlineEdit` calqué sur `PlayerIdentityInlineEdit`
  (crayon → champ → OK/Annuler), visible même quand le bouton
  « Modifier l'équipe » est verrouillé.

## Impact

- Aucune migration Prisma : `Team.name` existe déjà et n'est contraint par
  aucun index unique.
- Aucune donnée dénormalisée à rattraper : aucun modèle BB ne recopie
  `Team.name` (les copies existantes — `ProHallOfFame.teamName`,
  `NflFantasyEntry.teamName` — appartiennent à d'autres axes).
- Les routes existantes (`PUT /team/:id`, `PUT /team/:id/roster`) sont
  inchangées : elles continuent d'accepter `name` pour le brouillon.
- Risque assumé : un coach peut renommer son équipe en pleine compétition
  (usurpation cosmétique). C'est un sujet de modération, pas de règle —
  le journal d'équipe le trace, le commissaire peut arbitrer.
