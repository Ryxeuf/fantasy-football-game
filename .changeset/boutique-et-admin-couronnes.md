---
"@bb/server": minor
"@bb/web": minor
---

Boutique, admin des Couronnes et des wallets.

**Boutique** : la page « Thèmes de dés » devient la première catégorie d'une boutique (`/me/shop`, onglets par catégorie, solde de Couronnes en en-tête). L'ancienne adresse `/me/dice-themes` redirige ; le menu utilisateur affiche « 🛒 Boutique ».

**Admin Wallets** (`/admin/wallets`) : tous les coachs avec ou sans wallet (filtre, compteurs, recherche), création d'un wallet manquant à l'unité ou pour tous. La fiche d'un wallet signale son absence et propose de le créer.

**Admin Couronnes** (`/admin/crowns`) : état du flag `crowns` (y compris « absent de la base »), masse en circulation, flux par type sur 7/30/90 jours ou depuis toujours, plus gros soldes et journal global filtrable.
