# crowns

## Purpose

Les Couronnes (Crowns) sont la monnaie de Nuffle Arena hors Pro League. Il
n'y en a qu'UNE : celle du wallet Pro League (`ProWallet` + journal
`ProTransaction`), dont les routes coach sont gelées avec la Pro League. Le
flag `crowns` ouvre au coach son solde et son historique, et l'achat de thèmes
de dés (capacité `dice-themes`). Toute écriture du solde est atomique
(incrément, ou décrément conditionnel au solde) : un écrivain concurrent ne
peut ni passer le solde sous zéro, ni écraser la mise à jour d'un autre.

Change d'origine : `dice-theme-shop-and-crowns` (archivé le 2026-10-05).

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
