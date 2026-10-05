# crowns

## ADDED Requirements

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
