# league-match-sheet

## MODIFIED Requirements

### Requirement: Budget des coups de pouce (petty cash + trésorerie)
Le budget de coups de pouce d'une équipe sur une feuille de LIGUE DOIT être
calculé selon les règles officielles : petty cash (différence de CTV pour
l'équipe la moins chère) + trésorerie. Une sélection dépassant ce budget
DOIT être empêchée côté interface ET rejetée côté serveur. Une feuille de
COUPE suit le régime de sa coupe (capacité `cup-inducements`) et ne compte
jamais la trésorerie.

#### Scenario: Budget affiché
- **WHEN** la feuille est chargée
- **THEN** le petty cash, la trésorerie et le budget total de chaque équipe DOIVENT être affichés

#### Scenario: Dépassement bloqué côté UI
- **WHEN** la sélection de coups de pouce dépasse le budget
- **THEN** l'enregistrement de l'avant-match DOIT être désactivé

#### Scenario: Dépassement rejeté côté serveur
- **WHEN** une sélection hors budget est soumise à `updatePreMatch`
- **THEN** la requête DOIT être rejetée (`inducement_over_budget`) sans modification

#### Scenario: Comptabilité petty cash à la validation
- **WHEN** le match est validé par le commissaire
- **THEN** la trésorerie NE DOIT être débitée que de l'excédent des coups de pouce au-delà du petty cash reçu

#### Scenario: Feuille de coupe
- **WHEN** la feuille appartient à une coupe
- **THEN** la trésorerie NE DOIT être ni affichée comme budget de coups de pouce, ni comptée par le serveur
