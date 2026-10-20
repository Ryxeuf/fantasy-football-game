# cup-team-removal

## ADDED Requirements

### Requirement: Retrait d'une équipe d'une coupe

`POST /cup/:id/unregister` DOIT retirer une équipe d'une coupe (suppression de
son inscription). Le propriétaire de l'équipe DOIT pouvoir retirer SA propre
équipe tant que les inscriptions sont ouvertes. Le commissaire de la coupe
(son créateur) ou un administrateur DOIT pouvoir retirer N'IMPORTE QUELLE
équipe inscrite tant que la coupe n'est ni terminée ni archivée, inscriptions
closes et coupe en cours comprises. Tout autre utilisateur DOIT être refusé
(`403`).

#### Scenario: Le commissaire retire l'équipe d'un coach
- WHEN le commissaire retire l'équipe d'un autre coach d'une coupe ouverte
- THEN l'inscription DOIT être supprimée
- AND la réponse DOIT servir la coupe sans cette équipe

#### Scenario: Retrait par le commissaire après la clôture des inscriptions
- WHEN le commissaire retire une équipe d'une coupe validée (`en_cours`) dont aucune rencontre n'est ouverte
- THEN l'inscription DOIT être supprimée

#### Scenario: Le propriétaire après la clôture des inscriptions
- WHEN le propriétaire (non commissaire) retire son équipe d'une coupe validée
- THEN la réponse DOIT être `400` et l'inscription conservée

#### Scenario: Un tiers
- WHEN un coach qui n'est ni propriétaire de l'équipe, ni commissaire, ni administrateur tente le retrait
- THEN la réponse DOIT être `403` et l'inscription conservée

#### Scenario: Coupe terminée
- WHEN le commissaire tente un retrait sur une coupe `terminee` ou `archivee`
- THEN la réponse DOIT être `409`, sauf administrateur avec `force`

#### Scenario: Équipe non inscrite
- WHEN l'équipe visée n'est pas inscrite à la coupe
- THEN la réponse DOIT être `400`

### Requirement: Une rencontre ouverte bloque le retrait

Une équipe ayant une rencontre de ronde OUVERTE (`scheduled` ou `in_progress`)
dans la coupe NE DOIT PAS pouvoir être retirée (`409`), quel que soit
l'acteur : le commissaire règle d'abord la rencontre (forfait sur la feuille
ou annulation). Un exempt n'est pas une rencontre ouverte.

#### Scenario: Rencontre planifiée
- WHEN le commissaire retire une équipe dont la rencontre de la ronde courante est planifiée
- THEN la réponse DOIT être `409`
- AND le message DOIT nommer le forfait et l'annulation comme moyens de régler la rencontre

### Requirement: Les résultats d'une équipe retirée restent acquis

Le retrait NE DOIT effacer aucun résultat : les matchs déjà joués par l'équipe
retirée DOIVENT rester au classement (les siens et ceux de ses adversaires).
Sa ligne de classement DOIT être signalée comme retirée et ne plus figurer
dans les classements par poule. L'équipe retirée NE DOIT plus être appariée
aux rondes suivantes NI qualifiée au bracket.

#### Scenario: Retrait en cours de coupe
- WHEN une équipe ayant joué la ronde 1 est retirée, puis la ronde 2 générée
- THEN la ronde 2 NE DOIT PAS l'apparier
- AND le vainqueur de son match de ronde 1 DOIT garder ses points
- AND le classement DOIT servir sa ligne avec `withdrawn: true`

#### Scenario: Bracket sans poules
- WHEN le bracket d'une coupe sans poules est généré après le retrait d'une équipe bien classée
- THEN l'équipe retirée NE DOIT PAS figurer parmi les têtes de série

### Requirement: Le coach est prévenu du retrait de son équipe

Quand le commissaire (ou un administrateur) retire l'équipe d'un AUTRE coach,
ce coach DOIT recevoir une notification interne nommant l'équipe et la coupe.
L'échec de la notification NE DOIT PAS faire échouer le retrait.

#### Scenario: Notification
- WHEN le commissaire retire l'équipe d'un coach
- THEN ce coach DOIT recevoir une notification `cup.team_removed` menant à la coupe

### Requirement: Le commissaire retire depuis la liste des inscrits

La page de la coupe DOIT proposer au commissaire (et à un administrateur) un
bouton « Retirer » sur chaque équipe inscrite tant que la coupe n'est ni
terminée ni archivée, avec une confirmation nommant l'équipe et son coach.
Le propriétaire DOIT garder « Retirer mon équipe » tant que les inscriptions
sont ouvertes.

#### Scenario: Bouton du commissaire
- WHEN le commissaire consulte une coupe en cours
- THEN chaque équipe inscrite DOIT porter un bouton « Retirer »
