# roster-staff-config (delta)

Capability : configuration du staff d'équipe (relances, apothicaire,
cheerleaders, coachs assistants, fans dévoués — plafonds et coûts) stockée en
base par roster ET par format de jeu (`bb11` / `sevens`), source de vérité des
coûts et plafonds consommée par la validation/construction d'équipe.

## ADDED Requirements

### Requirement: Config staff persistée par roster et par format
Chaque roster DOIT pouvoir porter une configuration de staff distincte pour
chaque format (`bb11`, `sevens`), comprenant : coût de relance, plafond de
relances, apothicaire autorisé, coût d'apothicaire, et pour cheerleaders /
coachs assistants / fans dévoués un plafond et un coût unitaire. Les montants
SONT exprimés en po entiers. Une paire (roster, format) DOIT être unique.

#### Scenario: Saisie indépendante par format
- WHEN un admin édite la config staff d'un roster pour `bb11` puis pour `sevens`
- THEN les deux formats DOIVENT être persistés indépendamment, sans que l'un écrase l'autre

#### Scenario: Valeur par défaut dérivée
- WHEN aucune ligne `RosterStaffConfig` n'existe pour (roster, format)
- THEN la config résolue DOIT être dérivée des constantes historiques
  (`defaultStaffConfig`), et pour `bb11` DOIT être identique au comportement
  antérieur (relance par roster, cheerleader 10k, apothicaire 50k…)

### Requirement: Édition admin de la config staff
L'admin DOIT pouvoir lire et modifier la config staff des deux formats depuis la
page d'édition d'un roster. La mise à jour DOIT valider les entrées (entiers ≥ 0,
booléen apothicaire) et faire un upsert des deux formats.

#### Scenario: Mise à jour des deux formats
- WHEN l'admin envoie `PUT /admin/data/rosters/:id/staff-config` avec `{ bb11, sevens }`
- THEN les lignes correspondantes DOIVENT être créées ou mises à jour
- AND une entrée d'audit `roster.staffConfig.update` DOIT être enregistrée

#### Scenario: Rejet d'entrées invalides
- WHEN un coût négatif ou non entier est soumis
- THEN la requête DOIT être rejetée (400) sans modification

### Requirement: Coûts et plafonds pilotés par la config résolue
La construction et les achats d'équipe DOIVENT calculer les coûts de staff et
appliquer les plafonds à partir de la config résolue (DB par roster × format,
sinon défaut), et NON plus de constantes codées en dur.

#### Scenario: Coût de staff à la construction
- WHEN une équipe est construite avec relances / cheerleaders / coachs / fans / apothicaire
- THEN le coût de staff DOIT utiliser les coûts de la config résolue du roster et du format

#### Scenario: Apothicaire non autorisé
- WHEN l'apothicaire est demandé alors que la config (roster × format) ne l'autorise pas
- THEN la création DOIT être refusée (422) et l'achat post-création refusé (422)

#### Scenario: Plafonds par roster respectés à l'achat
- WHEN un achat ferait dépasser le plafond de la config (relances, cheerleaders, coachs, fans)
- THEN l'achat DOIT être refusé avec le plafond de la config résolue

### Requirement: Exposition de la config au client
L'API publique des rosters DOIT exposer la config staff par format pour que le
constructeur d'équipe affiche des coûts, plafonds et l'autorisation apothicaire
cohérents avec la base.

#### Scenario: Builder cohérent avec la base
- WHEN le builder charge un roster pour un format donné
- THEN les coûts/plafonds affichés et la validation DOIVENT refléter la config en base de ce roster
