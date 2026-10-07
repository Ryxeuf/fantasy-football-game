# shop

## Purpose

La Boutique du coach (`/me/shop`) : registre PUR de catégories
(`app/me/shop/categories.ts`, une entrée = id + page + flag), en-tête commun
avec le solde de Couronnes et onglets ; les thèmes de dés en sont la première
catégorie (`/me/shop/dice-themes`, l'ancienne adresse redirige).

Change d'origine : `shop-and-crowns-admin` (#1060, archivé le 2026-10-06).

## Requirements

### Requirement: Une boutique à catégories
Le site DOIT proposer une boutique (`/me/shop`) dont chaque catégorie a sa
page (`/me/shop/<id>`) et son propre flag. La boutique DOIT afficher le
solde de Couronnes et les onglets des seules catégories ouvertes ; elle est
annoncée fermée quand aucune ne l'est, jamais pendant le chargement des
flags. Les thèmes de dés en sont la première catégorie.

#### Scenario: Entrée du menu
- WHEN au moins une catégorie est ouverte au coach
- THEN le menu utilisateur DOIT proposer « Boutique » vers `/me/shop`

#### Scenario: Ancienne adresse
- WHEN un coach ouvre `/me/dice-themes`
- THEN il DOIT être redirigé vers `/me/shop/dice-themes`
