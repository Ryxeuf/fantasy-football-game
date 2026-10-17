# cup-leaderboards

## ADDED Requirements

### Requirement: Statistiques de coupe à la demande

`GET /cup/:id/leaderboards?topN=` DOIT servir les classements individuels de
la coupe (marqueurs, castagneurs, agresseurs, passeurs, intercepteurs, sacs
de frappe) bornés à `topN` (1 à 50, défaut 10) et les podiums par équipe.
La page `/cups/:id/stats` DOIT permettre de choisir le top N et lier chaque
équipe à son roster.

#### Scenario: Top 10
- WHEN un lecteur demande le top 10 d'une coupe
- THEN chaque catégorie DOIT contenir au plus 10 joueurs, triés par valeur décroissante

### Requirement: Palmarès d'une coupe jouée

La page d'une coupe DOIT annoncer son champion dès qu'il est connu, comme le
récap de saison d'une ligue : le vainqueur de la finale (rencontre jouée,
score validé, sans nul) quand la coupe a des play-offs, sinon le premier du
classement une fois la coupe close (`terminee` ou `archivee`). Elle DOIT y
joindre l'Oracle — le ou les meilleurs pronostiqueurs du groupe Coachs,
points > 0. Le nom du champion DOIT mener à son roster.

#### Scenario: Finale jouée
- WHEN la finale d'une coupe est validée 2-1
- THEN la page DOIT annoncer son vainqueur « vainqueur de la finale (2 – 1) »

#### Scenario: Finale nulle ou non jouée
- WHEN la finale n'a pas de vainqueur
- THEN aucun champion NE DOIT être annoncé, même coupe close

#### Scenario: Coupe sans play-offs
- WHEN une coupe sans bracket est close
- THEN le premier du classement DOIT être annoncé « en tête du classement final »
