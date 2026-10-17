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
