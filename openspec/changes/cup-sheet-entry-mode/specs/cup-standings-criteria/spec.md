# cup-standings-criteria

## MODIFIED Requirements

### Requirement: Édition d'une coupe par son commissaire

`PATCH /cup/:id` (commissaire ou administrateur) DOIT permettre de modifier le
nom, la description, la visibilité, le barème de points, les critères de
départage et le mode de saisie de la feuille, y compris en cours de coupe —
le classement étant dérivé, il se recalcule seul, et le mode de saisie ne
gouverne que le formulaire. L'édition, le format et le règlement de tournoi
NE DOIVENT PAS y être modifiables. Une coupe archivée DOIT être refusée
(`409`), un tiers (`403`), une coupe inconnue (`404`).

#### Scenario: Barème corrigé en cours de coupe
- WHEN le commissaire change `winPoints` alors que des matchs sont joués
- THEN le classement servi ensuite DOIT appliquer le nouveau barème

#### Scenario: Mode de saisie changé en cours de coupe
- WHEN le commissaire passe la coupe en saisie simplifiée alors que des rondes sont jouées
- THEN les feuilles de la coupe DOIVENT ensuite être servies en saisie simplifiée
- AND le classement servi DOIT être inchangé

#### Scenario: Mode de saisie inconnu
- WHEN le corps de `PATCH /cup/:id` porte un mode de saisie autre que `complète` ou `simplifiée`
- THEN la réponse DOIT être `400` et la coupe inchangée
