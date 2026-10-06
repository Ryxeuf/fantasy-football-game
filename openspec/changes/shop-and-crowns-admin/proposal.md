# Boutique, admin des Couronnes et des wallets

## Pourquoi

Retour du mainteneur après la mise en recette des thèmes de dés :

- un coach SANS wallet était invisible : son solde se lisait 0 partout
  (`getBalance`), le wallet ne naissait qu'au premier crédit, et aucun écran
  ne permettait de s'assurer qu'un coach en avait un, ni de le lui créer ;
- la monnaie n'avait pas de console : ni masse en circulation, ni flux par
  type, ni journal global — seulement la fiche d'un coach à la fois ;
- l'achat d'un thème restait « Bientôt disponible » sans que l'admin puisse
  voir pourquoi : la ligne du flag `crowns` n'existait pas en base (le seed
  ne tourne pas en prod), donc rien n'était activable ;
- « Thèmes de dés » était une page autonome alors que d'autres cosmétiques
  viendront : elle devient la première catégorie d'une **Boutique**.

## Quoi

1. **Admin Wallets** (`/admin/wallets`) : tous les coachs, filtre « tous /
   avec / sans wallet » avec compteurs, recherche, création unitaire
   idempotente et création en masse des wallets manquants. La fiche d'un
   wallet annonce son absence et propose de le créer.
2. **Admin Couronnes** (`/admin/crowns`) : état du flag `crowns` (ligne
   absente / éteint / overrides / actif, lien vers les flags), masse en
   circulation, nombre de wallets et de coachs sans wallet, flux par type
   (récents sur 7/30/90 jours ou depuis toujours), plus gros soldes, journal
   global filtrable par type et par coach.
3. **Boutique** (`/me/shop`) : en-tête commun (solde), onglets des
   catégories ouvertes ; « Thèmes de dés » est la seule catégorie
   (`/me/shop/dice-themes`). `/me/dice-themes` redirige. Le menu affiche
   « 🛒 Boutique », le profil y mène.

## Hors périmètre

- Nouvelles catégories de boutique (bannières, cadres…) : le registre est
  prêt, aucune n'est livrée.
- Création automatique d'un wallet à l'inscription : l'admin dispose de la
  création en masse ; un crédit crée toujours le wallet à la volée.
- Export CSV du journal.
