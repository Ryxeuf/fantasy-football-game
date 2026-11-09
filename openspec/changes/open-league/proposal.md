# Ligue libre : des matchs à la demande, un classement au pourcentage

## Why

Retour testeur (2026-11, préparation de la ligue 2027). Le groupe fait vivre
deux ligues : une ligue **standard** (un match par mois puis des play-offs,
déjà couverte) et une ligue **libre** :

- les coachs jouent quand ils veulent, contre qui ils veulent ;
- un coach peut inscrire plusieurs équipes ;
- le classement est un **pourcentage de victoires**, avec un **bonus selon le
  nombre de matchs joués** ;
- une équipe n'apparaît au classement qu'à partir de **5 matchs** joués.

Avec l'existant, il faudrait que le commissaire crée une journée par match
(« imagine si je dois créer 43 journées ») :

- `LeaguePairing.roundId` est obligatoire ;
- seul le commissaire crée des rencontres (`ensureLeagueCreator`) ;
- la garde d'ouverture de feuille (`league-sheet-open-guard`) raisonne par
  numéro de journée ;
- le classement (`computeSeasonStandings`, `league-standings-order`) ne
  connaît ni pourcentage ni seuil de qualification.

## What Changes

- **Format de ligue** : colonne `League.format` nullable, sans `@default`.
  `null` correspond à `standard`, l'existant inchangé ; `open` désigne la ligue
  libre. Le format se choisit à la création et reste modifiable tant
  qu'aucune rencontre n'a été jouée.
- **Matchs déclarés par les coachs** : un coach inscrit déclare une rencontre
  entre une de ses équipes et une autre équipe active de la saison.
  - La rencontre est rangée dans la journée du MOIS (« Novembre 2026 »),
    créée paresseusement. Calendrier, feuilles de match, pronostics et exports
    continuent donc de fonctionner sans connaître un nouveau cas.
  - Le commissaire peut supprimer ou corriger une rencontre non jouée.
  - L'avertissement « même coach » s'applique.
- **Garde de fraîcheur chronologique** : en ligue libre, une feuille ne
  s'ouvre pas tant qu'une rencontre ANTÉRIEURE (par date de déclaration) de
  l'une des deux équipes n'est pas close. Le numéro de journée n'est pas
  utilisé ; le commissaire peut toujours forcer.
- **Classement au pourcentage** : nouveau mode de classement, calculé dans un
  module pur à côté de `league-standings-order`.
  - Le score combine le pourcentage de victoires et un bonus de
    participation (formule à trancher, voir design).
  - Un seuil de qualification est configurable (5 par défaut). Les équipes
    sous le seuil sont listées à part, « non classées (n/5) ».
  - L'ordre de départage existant s'applique ensuite.
- **Pas de calendrier généré** : « démarrer la saison » n'appelle pas le
  générateur round-robin en format `open`.

## Capabilities

### New Capabilities

- `open-league` : format libre, déclaration de rencontres par les coachs,
  journées mensuelles paresseuses, classement au pourcentage avec seuil.

### Modified Capabilities

- `league-standings` (si elle existe à la synchro) : nouveau mode de
  classement.

## Impact

- Prisma : `League.format String?` ; paramètres du classement libre (seuil,
  bonus) dans une colonne JSON nullable de `League`.
- Serveur :
  - `services/league-open-pairing` (pur + service) ;
  - garde d'ouverture de feuille ;
  - `computeSeasonStandings` ;
  - création / édition de ligue (schémas Zod) ;
  - `startSeason`.
- Web :
  - formulaire de ligue (choix du format) ;
  - bouton « Déclarer un match » ;
  - classement « classées / non classées » ;
  - calendrier par mois.
- Aucune donnée existante ne change : `null` = standard.

## Statut

Proposition consignée le 2026-11-09, **à explorer** (`/opsx:explore`) avant
toute implémentation : les questions ouvertes du design doivent être
tranchées avec les testeurs.
