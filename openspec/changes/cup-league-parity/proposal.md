# Une coupe offre ce qu'offre une ligue

## Why

« Une coupe est une ligue moins ses effets » : c'est la règle posée quand la
feuille de match est devenue commune (change `cups-managed-like-leagues`).
Elle tient pour la SAISIE, pas pour ce qu'on CONSULTE autour. Un audit
ligue/coupe (2026-10-17) relève, côté coupe :

- **les rosters sont introuvables** : aucun nom d'équipe n'est un lien
  (inscrits, classement, rondes, play-offs, bracket, matchs, podiums, tops
  joueurs), et il n'existe ni route ni page de roster de coupe — alors que la
  ligue en a une depuis FR20 ;
- **les pronostics n'existent pas** (le modèle ne connaît que la rencontre de
  ligue) ;
- **les feuilles en attente sont invisibles** : les cartes de ronde ne disent
  jamais qu'une feuille est soumise, la notification « match à valider »
  d'une coupe affiche « ? vs ? » et pointe une URL de ligue, et la page
  « Matchs à valider » renvoie vers `/leagues/<id de coupe>` ;
- **les statistiques sont figées** au top 5, sans page dédiée ni lecture
  par équipe ;
- **ni « mes prochains matchs », ni relance de ronde, ni notification de
  date convenue** ;
- le logo uploadé des inscrits et des matchs n'est pas servi par
  `GET /cup/:id`.

S'y ajoute un retour testeur sur la feuille de rencontre imprimable : les
coups de pouce d'une équipe n'apparaissent pas là où on suit le match — la
page de l'équipe —, seulement en page 1.

## What Changes

- **Fiche de roster de coupe** (`GET /cup/:id/teams/:teamId/roster-view`,
  page `/cups/[id]/teams/[teamId]`) : le roster D'INSCRIPTION (celui que
  rejoue chaque rencontre), repli sur l'équipe en direct pour un participant
  sans snapshot, statistiques DE LA COUPE, Star Players inscrits et coups de
  pouce de création. Même mise en page que la fiche de ligue (composant
  partagé), moins ce qui n'existe pas en coupe (trésorerie, blessures,
  disponibilité). Même porte que `GET /cup/:id`.
- **Tout nom d'équipe d'une coupe mène à son roster** : inscrits (avec un
  bouton « Voir le roster »), classement (général et par poule), rondes
  (exempt compris), play-offs, bracket chronologique, matchs, podiums,
  classements individuels, et le résumé de la feuille de match (ligue
  comprise, pour ses membres).
- **Pronostics de coupe** : même pick'em que la ligue (mêmes règles pures,
  même barème, mêmes groupes Coachs/Tribunes, même invariant « rien avant la
  clôture »), sur les rencontres de coupe. Portée par coupe (`off`,
  `members`, `open`), clôture write-once au premier évènement / à la
  première soumission / au résultat / manuellement, règlement à la
  validation de la feuille, dérèglement à l'invalidation, exempts et
  placeholders de bracket non pronosticables, bilan de ronde notifié une
  fois.
- **Feuilles à valider en coupe** : les cartes de ronde portent l'état de la
  feuille (« soumise 1/2 », « à valider »), la notification du commissaire
  nomme les équipes et pointe la coupe, et une page « Matchs à valider »
  existe pour la coupe.
- **Statistiques de coupe** : page dédiée `/cups/[id]/stats` (top N au
  choix, joueurs et équipes) servie par `GET /cup/:id/leaderboards`.
- **Calendrier** : « Mes prochains matchs » sur la page de la coupe, relance
  d'une ronde par le commissaire, notification de la date convenue à
  l'adversaire.
- **Palmarès** : une coupe jouée annonce son champion (vainqueur de la
  finale, sinon premier du classement d'une coupe close) et son Oracle,
  comme le récap de saison d'une ligue.
- **Feuille imprimable** : la page de chaque équipe rappelle ses coups de
  pouce (inscription puis avant-match).

## Capabilities

### New Capabilities

- `cup-team-roster` : fiche de roster d'un inscrit et ses points d'entrée.
- `cup-predictions` : pronostics sur les rencontres d'une coupe.
- `cup-leaderboards` : statistiques de coupe à la demande, palmarès.
- `cup-calendar` : prochains matchs, relance de ronde, notification de date.

### Modified Capabilities

- `cup-match-sheet` : état de la feuille sur les cartes, notification et
  page des feuilles à valider propres à la coupe.
- `competition-pdf-exports` : coups de pouce sur la page d'équipe.

## Impact

- **Base** (`db push`, aucune reprise de données) :
  - `CompetitionPrediction.pairingId` devient nullable, ajout de
    `cupPairingId String?` (+ unicité `[cupPairingId, userId]`) — même
    patron polymorphe que `LeagueMatchSheet` ;
  - `Cup.predictionsScope String?` (sans `@default` : `null` = `off` pour
    l'existant, la création écrit `members`), `CupPairing.predictionsClosedAt
    DateTime?`, `CupRound.predictionsNotifiedAt DateTime?` ;
  - dans `prisma/schema.prisma` ET le miroir SQLite.
- **Serveur** : `services/team-roster-view` (méta partagée ligue/coupe),
  `services/cup-team-roster`, `services/cup-predictions*`, routes
  `cup-team-roster`, `cup-predictions`, `cup-leaderboards`, crochets dans la
  feuille de coupe (clôture, règlement, dérèglement) et la ronde (bilan).
- **Web** : `components/TeamRosterPanel`, pages `/cups/[id]/teams/[teamId]`,
  `/cups/[id]/predictions`, `/cups/[id]/stats`,
  `/cups/[id]/pending-validations`, liens `TeamRosterLink` par compétition,
  bandeau de palmarès.
- Aucune rupture d'API : champs ajoutés, optionnels côté client.
