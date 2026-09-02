# team-roster-page

## Purpose

Fiche publique d'un roster (`/teams/[slug]`) — carte
« Statistiques du roster ».

## Requirements

### Requirement: Statistiques de roster actionnables
La carte « Statistiques du roster » DOIT présenter des chiffres qu'un
coach exploite pour jauger le roster : nombre de positions, fourchette de
coût par joueur, coût d'un onze de départ légal et marge restante sur le
budget de création standard. Elle NE DOIT PAS afficher de tuile
« Joueurs max » ni de coûts minimum/maximum théoriques.

#### Scenario: Onze de départ
- WHEN la fiche d'un roster est affichée
- THEN le coût affiché du onze de départ est le prix minimal d'un effectif légal de 11 joueurs (minimums obligatoires, complétés au poste le moins cher dans la limite des maximums)

#### Scenario: Marge budget
- WHEN le onze de départ est calculable
- THEN la marge affichée est le budget standard de 1 000k moins ce coût, jamais négative

#### Scenario: Roster incapable d'aligner onze joueurs
- WHEN les maximums cumulés d'un roster sont inférieurs à 11
- THEN les tuiles concernées affichent une valeur neutre plutôt qu'un chiffre faux
