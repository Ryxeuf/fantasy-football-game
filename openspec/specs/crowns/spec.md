# crowns

## Purpose

Les Couronnes (Crowns) sont la monnaie de Nuffle Arena hors Pro League. Il
n'y en a qu'UNE : celle du wallet Pro League (`ProWallet` + journal
`ProTransaction`), dont les routes coach sont gelées avec la Pro League. Le
flag `crowns` ouvre au coach son solde et son historique, et l'achat de thèmes
de dés (capacité `dice-themes`). Toute écriture du solde est atomique
(incrément, ou décrément conditionnel au solde) : un écrivain concurrent ne
peut ni passer le solde sous zéro, ni écraser la mise à jour d'un autre.

Les Couronnes se GAGNENT en jouant : chaque côté d'une feuille de match
validée (ligue ou coupe, plafond par saison), chaque succès et le bonus de
bienvenue rapportent une fois. C'est la participation qui paie, jamais la
victoire ; les récompenses dues sont rattrapées à la lecture du solde, par un
registre à clé de source unique.

Changes d'origine : `dice-theme-shop-and-crowns` (archivé le 2026-10-05),
`crowns-earning` (archivé le 2026-10-07).

## Requirements

### Requirement: Les Couronnes du coach sont visibles sur son profil
Avec le flag `crowns`, le profil DOIT afficher le solde de Crowns et les
dernières opérations (libellées : achat, remboursement, ajustement admin…),
et le menu utilisateur la pastille du solde. Flag OFF : aucune mention des
Crowns et aucune requête.

#### Scenario: Flag inactif
- WHEN le flag `crowns` est inactif pour le coach
- THEN `GET /crowns/me` DOIT répondre 403 `feature_flag_disabled`
- AND le profil NE DOIT PAS afficher de solde

#### Scenario: Solde servi
- WHEN un coach connecté appelle `GET /crowns/me`
- THEN la réponse DOIT contenir son solde du wallet et ses 20 dernières opérations

#### Scenario: Solde indisponible
- WHEN le chargement du solde échoue
- THEN la boutique DOIT le dire et proposer de réessayer, sans présenter les achats comme « bientôt disponibles »

### Requirement: L'admin ajuste les Couronnes d'un coach
L'écran admin d'un coach DOIT permettre d'ajuster son solde par la route
wallet existante (`ADMIN_ADJUST`, raison obligatoire, journal admin). La
raison étant visible du coach dans son historique, l'écran DOIT le rappeler.

### Requirement: Les écritures du solde sont atomiques
Tout débit DOIT être un décrément conditionnel au solde (refusé en solde
insuffisant si la condition échoue) et tout crédit un incrément, jamais une
valeur calculée sur une lecture préalable.

#### Scenario: Ajustement admin concurrent d'un achat
- WHEN un crédit admin et un achat s'exécutent en même temps
- THEN le solde final DOIT refléter les deux opérations

### Requirement: L'admin s'assure que chaque coach a un wallet
La console admin DOIT lister les coachs avec leur wallet (solde, date de
création, nombre d'opérations) ou son absence, filtrer « avec / sans
wallet » et créer un wallet manquant (solde 0, aucune transaction), un par
un ou pour tous les coachs qui n'en ont pas.

#### Scenario: Création unitaire idempotente
- WHEN un admin crée le wallet d'un coach qui n'en a pas
- THEN `POST /admin/wallets/:userId` DOIT répondre 201 `created: true` et journaliser `wallet.create`
- WHEN il rejoue la création
- THEN la réponse DOIT être 200 `created: false`, sans écriture

#### Scenario: Création en masse
- WHEN un admin crée les wallets manquants
- THEN tous les coachs sans wallet DOIVENT en recevoir un, et un second appel NE DOIT rien créer

#### Scenario: Fiche d'un coach sans wallet
- WHEN un admin ouvre la fiche wallet d'un coach qui n'en a pas
- THEN `wallet.exists` DOIT valoir `false` et l'écran DOIT proposer de le créer

### Requirement: L'admin pilote la monnaie
La console admin DOIT montrer la masse de Couronnes en circulation, le
nombre de wallets et de coachs sans wallet, les flux par type (crédits,
débits, net) sur une fenêtre récente et depuis toujours, les plus gros
soldes, le journal global filtrable par type et par coach, et l'état du
flag `crowns` en distinguant une ligne ABSENTE de la base d'un flag éteint.

#### Scenario: Flag absent de la base
- WHEN la ligne `crowns` n'existe pas dans `FeatureFlag`
- THEN la vue d'ensemble DOIT servir `flag.exists = false` et l'écran DOIT inviter à synchroniser les flags

### Requirement: Une feuille de match validée rapporte des Couronnes à chaque coach
Chaque côté d'une feuille de match VALIDÉE, de ligue ou de coupe, DOIT (MUST)
rapporter une fois le montant du barème au propriétaire de l'équipe de ce
côté. La récompense rémunère la participation : elle ne dépend ni du
résultat ni du score, et une feuille dont les deux côtés appartiennent au
même compte ne rapporte rien.

#### Scenario: Feuille de ligue validée
- WHEN une feuille de ligue est validée entre l'équipe du coach A et celle du coach B
- THEN A et B DOIVENT recevoir chacun le montant du barème pour cette feuille

#### Scenario: Feuille de coupe validée
- WHEN une feuille de coupe est validée
- THEN chacun des deux coachs DOIT recevoir le montant du barème, comme en ligue

#### Scenario: Le vainqueur ne gagne pas davantage
- WHEN une feuille est validée sur une victoire de A
- THEN A et B DOIVENT recevoir le même montant

#### Scenario: Même compte des deux côtés
- WHEN les deux équipes d'une feuille validée appartiennent au même coach
- THEN cette feuille NE DOIT rien rapporter

#### Scenario: Feuille non validée
- WHEN une feuille est en brouillon, soumise par un seul coach ou invalidée sans avoir été revalidée
- THEN elle NE DOIT rien rapporter tant qu'elle n'est pas validée

### Requirement: Une récompense de feuille n'est versée qu'une fois par côté
La récompense d'un côté de feuille DOIT (MUST) être versée au plus une fois, quel
que soit le nombre de validations, d'invalidations ou de lectures du solde.
Une invalidation NE DOIT PAS reprendre une récompense déjà versée.

#### Scenario: Invalidation après versement
- WHEN une feuille dont les récompenses ont été versées est invalidée
- THEN les deux coachs DOIVENT conserver leurs Couronnes

#### Scenario: Revalidation
- WHEN une feuille invalidée est validée de nouveau
- THEN aucun des deux coachs NE DOIT recevoir une seconde récompense pour cette feuille

#### Scenario: Changement de propriétaire d'une équipe
- WHEN la récompense d'un côté a été versée puis l'équipe change de propriétaire
- THEN le nouveau propriétaire NE DOIT PAS recevoir de récompense pour ce côté

### Requirement: Les gains de feuilles sont plafonnés par saison de ligue
La somme des récompenses de feuilles d'un coach DOIT (MUST) être plafonnée par
saison de ligue ; une coupe tient lieu de saison. La récompense qui dépasse le
plafond DOIT être tronquée au reliquat, puis nulle, et consignée comme telle
afin de n'être jamais retentée. Les autres sources ne comptent pas dans ce
plafond.

#### Scenario: Plafond atteint
- WHEN un coach a déjà atteint le plafond d'une saison et une nouvelle feuille de cette saison est validée
- THEN cette feuille NE DOIT rien lui rapporter
- AND une saison différente NE DOIT PAS être affectée

#### Scenario: Reliquat
- WHEN le reliquat du plafond est inférieur au montant du barème
- THEN la récompense DOIT être égale au reliquat

### Requirement: Un succès débloqué rapporte des Couronnes une fois
Chaque succès débloqué par un coach et connu du catalogue DOIT (MUST) lui rapporter
une fois le montant du barème des succès, hors plafond de saison.

#### Scenario: Succès débloqué
- WHEN un coach débloque un succès du catalogue
- THEN il DOIT recevoir une fois le montant du barème des succès

#### Scenario: Succès inconnu du catalogue
- WHEN un coach possède un succès dont l'identifiant n'existe plus au catalogue
- THEN ce succès NE DOIT rien rapporter

### Requirement: Le bonus de bienvenue est versé une fois par coach
Chaque coach DOIT (MUST) recevoir une fois le bonus de bienvenue du barème. Un coach
qui a déjà reçu le bonus de bienvenue de la Pro League NE DOIT PAS le
recevoir à nouveau.

#### Scenario: Nouveau coach
- WHEN un coach consulte ses Couronnes pour la première fois avec le flag `crowns` actif
- THEN il DOIT recevoir le bonus de bienvenue

#### Scenario: Bonus déjà perçu en Pro League
- WHEN un coach a déjà une opération de bonus de bienvenue dans son historique
- THEN il NE DOIT PAS recevoir le bonus une seconde fois

### Requirement: Les récompenses dues sont rattrapées à la lecture du solde
`GET /crowns/me` DOIT (MUST) créditer les récompenses dues et non encore versées
avant de servir le solde, y compris celles antérieures à l'ouverture des
Couronnes. Un échec du rattrapage NE DOIT PAS faire échouer la lecture du
solde. Flag `crowns` inactif : rien n'est crédité.

#### Scenario: Premier passage
- WHEN un coach qui a des feuilles validées et des succès antérieurs consulte ses Couronnes pour la première fois
- THEN son solde DOIT inclure toutes les récompenses dues, plafonds compris

#### Scenario: Lecture sans récompense due
- WHEN toutes les récompenses d'un coach ont déjà été versées
- THEN la lecture NE DOIT ni créditer ni écrire d'opération

#### Scenario: Lectures simultanées
- WHEN deux lectures du solde du même coach arrivent en même temps
- THEN chaque récompense DOIT être versée une seule fois

#### Scenario: Rattrapage en échec
- WHEN le rattrapage échoue
- THEN `GET /crowns/me` DOIT servir le solde courant sans erreur

### Requirement: Le journal explique les récompenses
Chaque passage de rattrapage qui crédite DOIT (MUST) produire UNE opération dans
l'historique du coach, et `GET /crowns/me` DOIT servir son détail (nombre de
feuilles, de succès, bonus de bienvenue, récompenses plafonnées). Le profil
DOIT l'afficher en clair et expliquer comment gagner des Couronnes.

#### Scenario: Passage crédité
- WHEN un passage crédite deux feuilles et un succès
- THEN l'historique DOIT contenir une seule opération dont le libellé mentionne les deux feuilles et le succès

#### Scenario: Bonus de bienvenue historique
- WHEN l'historique contient le bonus de bienvenue de la Pro League
- THEN il DOIT rester libellé « Bonus de bienvenue »

### Requirement: L'admin voit les récompenses d'un coach
L'écran admin des cosmétiques d'un coach DOIT (MUST) lister ses récompenses
(source, période, montant, plafonnement, date), réservé aux admins.

#### Scenario: Consultation admin
- WHEN un admin ouvre l'écran des cosmétiques d'un coach
- THEN il DOIT voir la liste de ses récompenses avec leur source et leur montant

#### Scenario: Non-admin
- WHEN un coach non admin appelle la lecture admin du registre
- THEN la réponse DOIT être 403
