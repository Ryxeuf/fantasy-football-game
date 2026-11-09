# Design — Ligue libre

## Context

Une rencontre de ligue s'appuie sur trois objets :

- `LeagueRound` : `@@unique([seasonId, roundNumber])`, `kind`, `status`.
- `LeaguePairing` : `roundId` obligatoire, côtés par participant.
- `LeagueMatchSheet` : feuille polymorphe ligue / coupe.

Plusieurs garanties en dépendent :

- La clôture d'une journée déclenche les bilans de pronostics.
- La garde d'ouverture (`league-sheet-open-guard`, 409
  `previous_match_pending`) compare les numéros de journée.
- Le gel « version du match » suppose un état à jour.

L'existant permet déjà plusieurs équipes par coach dans une saison : seule
contrainte, `@@unique([seasonId, teamId])`. Une équipe ne peut en revanche
être engagée que dans une compétition active à la fois
(`team-competition-status`).

## Goals / Non-Goals

**Goals**

- Jouer sans calendrier préparé.
- Ne rien réécrire de la feuille de match, des pronostics ni des exports.
- Un classement lisible avec un seuil de qualification.

**Non-Goals**

- Matchmaking automatique.
- Ligue libre en coupe.
- Play-offs d'une ligue libre : à trancher, hors première itération.

## Decisions

### D1 — Une journée par mois, créée paresseusement

Plutôt que de rendre `roundId` nullable (tous les lecteurs de rencontres
devraient apprendre le cas « sans journée »), une rencontre déclarée va dans
la journée du mois de sa date prévue (ou de sa déclaration). La journée est
créée au besoin avec `max(roundNumber) + 1` et le nom « <Mois> <Année> ».

Conséquences :

- Une journée de mois passé peut recevoir une rencontre si la date prévue y
  tombe. Les numéros ne suivent donc pas l'ordre chronologique, d'où D3.
- La journée se complète quand toutes ses rencontres sont closes. Elle peut se
  « rouvrir » à la déclaration d'une nouvelle rencontre (statut
  `in_progress`). Les bilans de pronostics sont write-once
  (`predictionsNotifiedAt`) et ne repartent pas.

Alternative écartée : une journée unique « saison » ouverte en permanence. Les
pronostics ne se notifieraient jamais et le calendrier deviendrait une liste
sans repère.

### D2 — Déclaration par un coach

Route : `POST /leagues/seasons/:id/open-pairings` avec
`{ homeTeamId, awayTeamId, scheduledAt? }`. Elle est réservée au propriétaire
d'une des deux équipes ou au commissaire. Les deux équipes doivent être
actives dans la saison.

Gardes possibles, à confirmer :

- plafond de rencontres contre le même adversaire ;
- une seule rencontre ouverte à la fois par paire.

L'adversaire est notifié (notification interne).

### D3 — Garde de fraîcheur chronologique

En format `open`, le prédicat « rencontre antérieure non close » compare les
dates de déclaration (ou dates prévues), pas `roundNumber`. Il reste un module
pur, injecté dans la garde existante selon le format.

### D4 — Classement au pourcentage

Nouveau module pur `league-open-standings` :

- **Entrées** : lignes du classement existant (`wins`, `draws`, `losses`,
  `played`…).
- **Calcul** : `score = f(wins, draws, played)` et `qualified = played >= seuil`.
- **Sortie** : deux listes, les classées triées par score puis par l'ordre de
  départage configuré, et les non classées triées par matchs joués.

Les compteurs restent ceux du participant (rien de nouveau n'est persisté), et
la règle se relit à chaque lecture (cf. « un correctif de calcul ne corrige pas
un compteur persisté »).

## Open Questions (à trancher avec les testeurs)

1. **Formule exacte.** Un nul vaut-il une demi-victoire ? Quel bonus par match
   joué : linéaire ou plafonné, en points de pourcentage ? Exemple à valider :
   `(V + N/2) / J × 100 + min(J, 20) × 0,5`.
2. **Seuil** : 5 matchs par défaut, configurable par la ligue ?
3. **Même adversaire** : nombre maximal de rencontres contre la même équipe
   dans une saison ?
4. **Ses propres équipes** : un coach peut-il opposer deux de ses équipes ?
   L'avertissement est déjà en place en ligue standard.
5. **Fin de saison** : date de fin, clôture manuelle (existante) ? Play-offs
   éventuels entre les qualifiés ?
6. **Engagement** : une équipe de ligue libre peut-elle jouer une autre
   compétition en parallèle ? `team-competition-status` l'interdit
   aujourd'hui.

## Risks / Trade-offs

- **Journées « à rebours »** (D1) : une rencontre datée dans un mois passé
  crée une journée de numéro supérieur. L'affichage doit trier par date, pas
  par numéro, en format `open`.
- **Classement à deux listes** : les exports PDF et le récapitulatif de saison
  (`computeSeasonRecap` prend le premier du classement) devront lire les
  classées seulement.
