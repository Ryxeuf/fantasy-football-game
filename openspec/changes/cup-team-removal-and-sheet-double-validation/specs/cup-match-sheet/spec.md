# cup-match-sheet

## ADDED Requirements

### Requirement: Double validation des feuilles de match

Une coupe DOIT porter une option « double validation des feuilles de match »,
décochée par défaut (coupes existantes comprises), choisie à la création
(`POST /cup`) et modifiable à tout moment par le commissaire
(`PATCH /cup/:id`), coupe lancée comprise. `GET /cup/:id` DOIT la servir.

Quand l'option est cochée, la validation d'une feuille par le commissaire (ou
un administrateur) DOIT être refusée (`409`) tant que les DEUX coachs ne l'ont
pas soumise. Sur un forfait déclaré, seule la soumission du coach NON
forfaitaire est attendue. La lecture de la feuille DOIT servir l'option dans
`competitionRules.doubleValidation` (toujours `false` en ligue).

#### Scenario: Validation avant les deux soumissions
- WHEN l'option est cochée et que seul le coach à domicile a soumis la feuille
- THEN la validation du commissaire DOIT répondre `409`
- AND le message DOIT nommer le côté dont la soumission manque

#### Scenario: Validation après les deux soumissions
- WHEN l'option est cochée et que les deux coachs ont soumis la feuille
- THEN la validation du commissaire DOIT réussir

#### Scenario: Forfait
- WHEN l'option est cochée, que l'extérieur est déclaré forfait et que seul le coach à domicile a soumis
- THEN la validation du commissaire DOIT réussir

#### Scenario: Option décochée
- WHEN l'option est décochée
- THEN le commissaire DOIT pouvoir valider une feuille qu'aucun coach n'a soumise (comportement historique)

#### Scenario: Ligue
- WHEN une feuille de LIGUE est lue
- THEN `competitionRules.doubleValidation` DOIT valoir `false`

### Requirement: La feuille annonce la double validation

Quand l'option est cochée, la feuille DOIT l'annoncer par un bandeau, et le
bouton de validation du commissaire DOIT être désactivé tant qu'une soumission
attendue manque, en disant laquelle. Un commissaire qui joue la rencontre
DOIT pouvoir soumettre et reprendre la saisie de SON côté.

#### Scenario: Bouton du commissaire désactivé
- WHEN le commissaire ouvre une feuille sous double validation soumise par un seul coach
- THEN le bouton « Valider le match » DOIT être désactivé avec le côté manquant

#### Scenario: Commissaire-coach
- WHEN le commissaire joue la rencontre avec sa propre équipe
- THEN le bouton « Valider ma saisie » DOIT lui être proposé
