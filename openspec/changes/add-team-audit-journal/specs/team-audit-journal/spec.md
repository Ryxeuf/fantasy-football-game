# team-audit-journal (delta)

Capability : journal append-only des modifications d'une équipe — qui a fait
quoi, sur quoi, et **quel état l'équipe avait après chaque étape**. Couvre le
roster, le staff, la trésorerie et les valeurs (VE/VEA), quel que soit l'auteur
(coach, commissaire, admin, job système).

## ADDED Requirements

### Requirement: Trace de toute mutation d'équipe
Toute mutation persistante portant sur `Team`, `TeamPlayer` ou
`TeamStarPlayer` DOIT produire au moins une entrée de journal, sauf exemption
explicitement justifiée (contenu jetable, cosmétique, ou délégation à un module
qui journalise). L'exhaustivité DOIT être vérifiée automatiquement.

#### Scenario: Un nouveau flux de mutation non journalisé échoue en CI
- WHEN un module de `services/` ou `routes/` écrit sur une entité d'équipe sans appeler le journal
- THEN la garde de couverture DOIT échouer en nommant le fichier
- AND l'ajouter à la liste d'exemptions DOIT exiger une justification

#### Scenario: L'écriture du journal ne peut pas casser la mutation
- WHEN l'insertion dans le journal échoue (table absente, base indisponible)
- THEN la mutation métier déjà committée DOIT rester committée
- AND l'erreur DOIT être loggée, pas propagée à l'appelant

### Requirement: Identification de l'auteur
Chaque entrée DOIT porter l'auteur de la mutation : son identifiant, son rôle
au moment de l'acte (`owner`, `admin`, `commissioner`, `system`, `anonymous`),
un libellé lisible **figé** à l'écriture, et, en session d'impersonation,
l'admin à l'origine. Une mutation déclenchée par un job DOIT être attribuée à
`system` plutôt qu'à un utilisateur arbitraire.

#### Scenario: Le propriétaire prime sur les rôles portés par le token
- WHEN un utilisateur `admin` modifie SA PROPRE équipe
- THEN le rôle enregistré DOIT être `owner`

#### Scenario: Le libellé survit à la disparition du compte
- WHEN le compte de l'auteur est renommé ou supprimé après l'action
- THEN le libellé enregistré DOIT rester celui du moment de l'action

### Requirement: Corrélation et ordre des étapes
Les mutations déclenchées par une même opération DOIVENT partager un
`correlationId` et porter un `step` croissant reflétant l'ordre réel
d'exécution. En contexte HTTP, le `correlationId` DOIT être le `requestId` de
la requête, pour permettre le recoupement avec les logs applicatifs.

#### Scenario: Un achat produit une séquence lisible
- WHEN un coach achète un joueur
- THEN le journal DOIT contenir l'étape d'achat (débit de trésorerie) PUIS l'étape de recalcul de VE
- AND les deux DOIVENT partager le même `correlationId`

#### Scenario: Deux requêtes concurrentes ne mélangent pas leurs étapes
- WHEN deux opérations se déroulent en parallèle
- THEN chaque entrée DOIT porter la corrélation de SON opération
- AND les compteurs d'étape DOIVENT être indépendants

### Requirement: État résultant stocké à chaque étape
Chaque entrée DOIT stocker l'état de l'équipe APRÈS l'étape (trésorerie,
VE, VEA, staff, effectif, Star Players), le diff par rapport à l'état d'avant,
et les variations de trésorerie et de VE. Les montants clés DOIVENT aussi être
dénormalisés en colonnes scalaires pour être requêtables sans désérialiser.

#### Scenario: Reconstitution d'un écart de trésorerie
- WHEN la trésorerie affichée ne correspond pas à ce qu'attend le coach
- THEN la lecture du journal DOIT montrer, étape par étape, chaque variation et le solde résultant

#### Scenario: Recalcul de VE sans effet
- WHEN un recalcul de VE aboutit aux mêmes valeurs qu'avant
- THEN aucune entrée ne DOIT être écrite (le journal ne se remplit pas de non-événements)

#### Scenario: Mutation en échec
- WHEN une mutation enveloppée par le journal lève une erreur
- THEN une entrée `<action>.failed` DOIT être écrite avec le message d'erreur
- AND l'erreur DOIT ensuite être propagée à l'appelant

### Requirement: Lecture du journal d'une équipe
Le journal d'une équipe DOIT être consultable par son coach propriétaire, par
un admin, et par le commissaire d'une ligue où l'équipe est ou a été inscrite.
Toute autre demande DOIT être traitée comme une équipe introuvable. L'adresse
IP de l'auteur NE DOIT être servie qu'aux admins.

#### Scenario: Un tiers sans lien n'accède pas au journal
- WHEN un utilisateur qui n'est ni propriétaire, ni admin, ni commissaire concerné demande le journal
- THEN la réponse DOIT être 404

#### Scenario: Filtres et pagination
- WHEN la lecture précise un préfixe d'action, un auteur, une fenêtre temporelle, ou ne demande que les étapes économiques
- THEN seules les entrées correspondantes DOIVENT être servies
- AND la taille de page DOIT être bornée quelle que soit la valeur demandée

### Requirement: Immutabilité et coupe-circuit
Les entrées de journal NE DOIVENT jamais être mises à jour ni supprimées par le
code applicatif. Le journal DOIT pouvoir être désactivé par variable
d'environnement, sans déploiement, auquel cas aucune lecture ni écriture
supplémentaire ne DOIT être effectuée.

#### Scenario: Journal désarmé
- WHEN `TEAM_AUDIT_DISABLED=1`
- THEN aucune entrée ne DOIT être écrite
- AND aucune capture d'état ne DOIT être effectuée (pas de coût résiduel)
