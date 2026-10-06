# compendium-dice

## ADDED Requirements

### Requirement: Le Dé de Blocage est montré face par face
Le chapitre du compendium consacré aux Dés de Blocage DOIT afficher les six
faces du dé, dans l'ordre du livre (de la pire à la meilleure issue pour
l'attaquant), chacune accompagnée de son nom officiel. Les faces DOIVENT être
dessinées dans le thème de dés du coach, et dans le dé original pour un
visiteur.

#### Scenario: Six faces pour cinq icônes
- WHEN un visiteur ouvre le chapitre « Dés de Blocage »
- THEN six faces DOIVENT être affichées, dont deux « Repoussé »

#### Scenario: Résultat nommé dans une table
- WHEN une cellule de table porte le nom officiel d'une face du Dé de Blocage
- THEN la face correspondante DOIT être affichée à côté du nom

### Requirement: Les jets des tables sont dessinés en faces de dés
Une colonne de table dont l'en-tête désigne un dé (D6, 2D6, D8, D16, « 1ᵉʳ
D6 »…) DOIT afficher chaque plage de résultats en faces de dés : faces à
points pour un D6, dés chiffrés pour les autres. La plage DOIT rester
disponible en texte pour les technologies d'assistance. Une cellule qui
n'est pas une plage atteignable par le dé DOIT rester affichée en texte.

#### Scenario: Plage d'un D6
- WHEN une table « D6 » contient la plage « 2-5 »
- THEN quatre faces à points (2, 3, 4, 5) DOIVENT être affichées
- AND le texte « D6 : 2 à 5 » DOIT être présent pour les lecteurs d'écran

#### Scenario: Plage d'un 2D6
- WHEN une table « 2D6 » contient la plage « 2-7 »
- THEN deux dés chiffrés « 2 » et « 7 » séparés d'un tiret DOIVENT être affichés

#### Scenario: Cellule qui n'est pas un jet
- WHEN une cellule d'une colonne de dé ne contient pas une plage valide
- THEN son texte DOIT être affiché tel quel
