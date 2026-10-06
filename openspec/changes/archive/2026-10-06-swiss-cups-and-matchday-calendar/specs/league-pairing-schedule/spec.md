# league-pairing-schedule

## ADDED Requirements

### Requirement: Date prévisionnelle d'une rencontre

Les deux coachs d'une rencontre de ligue et le commissaire DOIVENT pouvoir
poser ou retirer sa date prévisionnelle via `PATCH
/leagues/pairings/:id/schedule` avec `{ scheduledAt: ISO | null }`. Un tiers
DOIT être refusé (`403`), une date illisible (`400`), une rencontre jouée,
forfaitée ou annulée (`409`). Les autres coachs impliqués DOIVENT recevoir
une notification interne `league.pairing_scheduled` (jamais bloquante).

#### Scenario: Le coach visiteur propose une date
- WHEN le propriétaire de l'équipe visiteuse appelle la route avec une date
- THEN la réponse DOIT être `200` avec `actorRole = "away"` et `notified = 1`
- AND `GET /leagues/seasons/<id>` DOIT servir cette date sur la rencontre

#### Scenario: Rencontre jouée
- WHEN la rencontre est en forfait
- THEN la route DOIT renvoyer `409`

### Requirement: Statut « Prévu le … »

Dans le calendrier, une rencontre `scheduled` portant une date DOIT
afficher « Prévu le <date> » à la place de « À jouer », et proposer
l'éditeur de date aux coachs impliqués et au commissaire tant qu'elle
n'est pas jouée.
