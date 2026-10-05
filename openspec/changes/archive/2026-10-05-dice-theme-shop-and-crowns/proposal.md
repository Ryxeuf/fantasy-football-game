# Boutique de thèmes de dés et Couronnes

## Pourquoi

Le commit `32b1b11` a livré les images des dés de blocage Nuffle Arena : le dé
ORIGINAL (or & charbon), un pack de 5 thèmes et 31 thèmes d'équipe, en PNG
64/128/320 px. Le site dessinait encore ses dés en SVG maison (home, feuille
de match) ou avec d'anciens PNG (`/images/blocking_dice/`, match en ligne),
et le plateau Pixi en blanc avec des points noirs. Le système de thèmes
(`dice-themes`, #1044) n'avait qu'un thème et aucun moyen d'en acquérir un
autre : les Crowns n'existaient que dans la Pro League gelée.

## Quoi

1. **Le dé original partout.** Le thème par défaut (`nuffle`) dessine les
   faces PNG « original-or » sur tout le site ET dans tous les simulateurs :
   lanceur de la home, D8 d'amélioration (édition d'équipe, éditeur
   d'évolutions), jets de Haine (X), popup de choix de blocage, journal,
   popup de résultat et dé animé du plateau Pixi (match, spectateur, replay),
   démo des notifications de dés. Les dés NUMÉRIQUES (D6 à points, D3/D8/
   D16/2D6 chiffrés) n'ont pas de PNG : ils sont dessinés dans la palette du
   thème (SVG côté site, `Graphics` côté Pixi).
2. **36 thèmes** : le dé original (gratuit, défaut), 4 déclinaisons (Acier
   bleu, Chaos rouge, Malepierre, Glace — 250 Crowns) et 31 thèmes d'équipe
   (400 Crowns). Un seul registre de rendu, `@bb/ui/dice` (skins : chemin des
   PNG + palette), partagé par le site et les composants de match en ligne.
3. **Catalogue « base d'abord »** : table `DiceTheme` (libellés, prix, mise
   en vente, ordre), catalogue compilé en repli et seed create-if-missing.
4. **Couronnes sur le profil** : solde et historique (`GET /crowns/me`), pastille
   dans le menu, boutique `/me/dice-themes`. La monnaie est celle du wallet
   existant (`ProWallet` / `ProTransaction`) — pas de seconde monnaie.
5. **Achat** (`POST /dice-themes/:id/purchase`) : débit `SINK` conditionnel,
   acquisition `UserDiceTheme`, journal et thème équipé dans UNE transaction.
6. **Admin** : `/admin/dice-themes` (aperçu complet, prix, vente, libellés,
   ordre, statistiques, réinitialisation) et `/admin/coach-cosmetics`
   (solde + ajustement, thèmes acquis, cadeau, retrait remboursable, thème
   choisi) ; lien depuis la fiche utilisateur.
7. **Flags** : `dice_themes` (existant, boutique + choix) et `crowns` (nouveau,
   solde + achat). Le dé ORIGINAL, lui, est servi à tout le monde.

## Hors périmètre (suites possibles)

- Sources de Crowns hors Pro League (bonus quotidien, récompenses de ligue) :
  seul l'admin crédite pour l'instant.
- Application mobile (Expo) : le choix de blocage y reste textuel.
- Visuels éditables en admin (upload de faces) : le slug et les PNG restent
  un contrat de code.
- Thème de l'ADVERSAIRE en match en ligne (chacun voit ses propres dés).
