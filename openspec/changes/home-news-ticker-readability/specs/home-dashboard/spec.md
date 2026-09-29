# home-dashboard

## ADDED Requirements

### Requirement: Bandeau « À la une » lisible sans texte en mouvement
Quand le flag `home_news_ticker` est actif et que l'API sert des éléments, la
home DOIT présenter les résultats de ligue et de coupe en cartes fixes et les
autres actualités (Gazette, inscriptions ouvertes) sur une ligne affichant un
seul élément à la fois. Aucun texte NE DOIT défiler en continu.

#### Scenario: Résultat en carte
- WHEN l'API sert un résultat de ligue « Rats 2 – 1 Nains »
- THEN une carte liée à la page de la compétition DOIT afficher les deux
  équipes, leur score et marquer « Rats » comme vainqueur
- AND l'âge de l'évènement DOIT être affiché en temps relatif

#### Scenario: Plusieurs actualités
- WHEN l'API sert plus d'une actualité hors résultats
- THEN la ligne DOIT en afficher une seule, avec des commandes
  « précédente », « suivante » et « pause »
- AND la rotation automatique NE DOIT PAS démarrer si l'utilisateur préfère
  réduire les animations

#### Scenario: Zone vide
- WHEN l'API ne sert que des résultats (ou que des actualités)
- THEN seule la zone concernée DOIT être rendue
