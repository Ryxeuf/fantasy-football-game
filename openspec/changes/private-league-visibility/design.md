# Design — Une ligue privée est invisible

## « Privée » plutôt que « non listée mais lisible par lien »

Deux lectures possibles de `isPublic = false`. « Non listée » aurait suffi à
documenter le comportement en place, mais elle contredit tout ce que le
produit annonce déjà : le libellé « Privée » du formulaire, le JSON-LD qui
n'indexe pas ces ligues, le listing qui ne les montre qu'à leurs membres, les
documents officiels réservés aux inscrits. Une ligue de club avec ses noms de
coachs, son calendrier et ses appariements est exactement ce qu'un commissaire
veut garder entre ses membres. **Décision** : privée, au sens fort.

## 404, jamais 403 — et le même message

Un 403 « réservé aux membres » confirme qu'une ligue existe derrière l'id. Le
refus répond donc « Ligue introuvable » / « Saison introuvable » / « Pairing
introuvable », **exactement** comme pour un id inexistant : la garde et le cas
« introuvable » partagent la constante de message, et le test HTTP vérifie que
les deux réponses sont identiques.

Le 403 reste réservé à ce qui est VISIBLE mais interdit : les rosters d'une
ligue publique pour un coach non inscrit, ou pour un coach seulement invité.

## Un module, une règle pure, trois entrées

`services/league-access` porte LA résolution. `isLeagueVisibleTo` est pure
(ligue, lecteur, appartenance) et testée en table ; `canViewLeagueRow` ne lance
les requêtes d'appartenance (inscription puis invitation) que si la règle en a
besoin — jamais pour une ligue publique, un commissaire, un admin ou un
anonyme. Trois résolutions couvrent les trois façons d'adresser une ligue :
par son id, par une saison, par une rencontre.

Quand le handler a déjà chargé la ligne (détail via `getLeagueById`, saison via
`getSeasonById`, bracket), il tranche sur cette ligne (`canViewLeagueRow`) :
pas de seconde requête. Les autres handlers passent par une garde de route
(`ensureVisibleLeague` / `ensureVisibleSeason` / `ensureVisiblePairingLeague`)
qui répond elle-même le 404.

## Qui fait partie d'une ligue privée

- le **commissaire** (`creatorId`) ;
- un **administrateur** — la console admin liste toutes les ligues et lie
  vers leur page, elle serait cassée sinon ; c'est aussi la règle des
  invitations et des documents ;
- un **coach inscrit** : `isLeagueParticipant`, toute saison et tout statut
  confondus — un coach retiré garde l'accès à l'historique qu'il a joué ;
- un **coach invité** : invitation `pending` qui le nomme (`inviteeUserId`),
  même critère que `listLeagues`. Il voit la ligue avant d'accepter, comme
  la liste la lui montre déjà.

## `optionalAuthUser` sur les lectures ouvertes

Poules, classements individuels et récap n'avaient aucun middleware : une
ligue privée n'aurait alors JAMAIS pu être servie à ses membres, faute
d'identité. `optionalAuthUser` renseigne `req.user` quand un jeton valide est
présent et laisse passer sinon — c'est le patron déjà posé pour le bracket, et
la raison pour laquelle on ne duplique pas la route en version « membres ».

## La feuille de match est polymorphe

Une rencontre est de ligue OU de coupe (`resolveCompetitionPairing`). La garde
`isLeaguePairingHiddenFrom` ne cache que les rencontres de LIGUE dont la ligue
est invisible ; une rencontre de coupe ou un id inconnu passent au service,
qui a ses propres 404 / 403. Sans cela, toute feuille de coupe répondrait 404.

## Listings : la même règle en `where`

Le listing général le faisait déjà (`listLeagues` : publique OU créateur OU
inscrit OU invité). Le calendrier thématique public (`listThemedSeasons`) ne
filtrait pas et exposait les noms de ligues privées : il ne sert plus que les
ligues publiques. Les membres d'une ligue privée thématique la trouvent depuis
leur hub.

## Documents officiels : la ligue suit la règle, la coupe garde la sienne

`canViewCompetitionDocuments` délègue à `canViewLeagueRow` pour une ligue, ce
qui ajoute les invités en attente et unifie la règle ; et le refus devient un
`competition-not-found` (404) au lieu d'un `forbidden` (403). Une coupe privée
garde son 403 : la visibilité des coupes n'a pas été tranchée et
`GET /cup/:id` les sert à tous — un 404 sur les seuls documents serait
incohérent avec une page de coupe lisible.

## Ce qui garde son 403 : les mutations du commissaire

`ensureLeagueCreator` / `ensureLeagueCommissioner` répondent 403 à un
non-commissaire, ligue privée comprise. Ces routes ne SERVENT aucune donnée ;
harmoniser en 404 aurait touché ~35 appels et autant de tests pour un gain
marginal (savoir qu'un id existe sans rien pouvoir en lire). Suite possible,
pas dans ce change.

## Tests

- `services/league-access.test.ts` : règle pure en table, et requêtes
  d'appartenance lancées seulement quand la règle en a besoin.
- `routes/league-access.test.ts` : la VRAIE chaîne Express (routeur `/leagues`,
  `authUser` / `optionalAuthUser` avec de vrais JWT, Prisma mocké, calculs
  lourds remplacés) en table sur dix lectures : tiers → 404 identique à
  « inexistant », membre / invité / commissaire / admin → 200, ligue publique
  → 200 (sans compte sur les routes ouvertes), et rien n'est calculé pour un
  tiers.

Deux pièges rencontrés, à connaître pour les tests existants : une fixture de
ligue sans `isPublic` est vue PRIVÉE (undefined est faux) — les fixtures des
tests de route portent désormais `creatorId` + `isPublic` ; et
`mockResolvedValue` survit à `vi.clearAllMocks()` — consommer la valeur avec
`mockResolvedValueOnce` quand un `describe` n'utilise pas `resetAllMocks`.
