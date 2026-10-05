# Tâches

- [x] Service `crowns-admin` : liste avec / sans wallet, création unitaire (idempotente, course P2002) et en masse (lots, sans `skipDuplicates`), vue d'ensemble, journal global
- [x] Routes `GET /admin/wallets`, `POST /admin/wallets/create-missing`, `POST /admin/wallets/:userId`, `GET /admin/crowns/overview`, `GET /admin/crowns/transactions` (audit `wallet.create` / `wallet.create-missing`)
- [x] `GET /admin/wallets/:userId` expose `wallet.exists`
- [x] Pages `/admin/wallets` et `/admin/crowns`, bandeau « wallet absent » sur la fiche, section « Couronnes » du menu admin
- [x] Boutique `/me/shop` (registre de catégories, en-tête, onglets), catégorie `/me/shop/dice-themes`, redirection de `/me/dice-themes`, menu et profil
- [x] Tests unitaires (service, routes, pages, registre) et spec e2e `crowns-wallets-admin`
