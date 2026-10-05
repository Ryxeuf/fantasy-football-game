---
"@bb/server": minor
"@bb/web": minor
"@bb/ui": minor
---

Dés originaux partout, 36 thèmes de dés, boutique en Couronnes et console admin.

**Le dé original or & charbon, partout.** Les faces PNG livrées dans `public/images/dices/` remplacent les dés dessinés à la main et les anciennes images : lanceur de la home, D8 d'amélioration (édition d'équipe, éditeur d'évolutions), jets de Haine (X) de la feuille de match, et tout le match en ligne — popup de choix de blocage, journal (dés multiples compris), popup de résultat, notifications de dés et dé animé du plateau. Les dés numériques (D6 à points, D3/D8/D16/2D6 chiffrés) sont dessinés dans le même style ; un total de 2D6 n'est plus affiché en points, et un blocage s'anime sur ses vraies faces.

**36 thèmes** (flag `dice_themes`) : le dé original (gratuit), Acier bleu, Chaos rouge, Malepierre, Glace et 31 thèmes d'équipe. Boutique `/me/dice-themes`, carte « Thème de dés » du profil, entrée du menu utilisateur.

**Couronnes** (flag `crowns`) : solde et historique sur le profil (`GET /crowns/me`), achat d'un thème en Crowns (`POST /dice-themes/:id/purchase`, atomique, thème équipé). Les écritures du wallet sont désormais toutes atomiques.

**Admin** : `/admin/dice-themes` (aperçu, prix, mise en vente, libellés, ordre, statistiques) et `/admin/coach-cosmetics` (solde et ajustement, thèmes acquis, cadeau, retrait remboursable, thème choisi), lien depuis la fiche utilisateur.
