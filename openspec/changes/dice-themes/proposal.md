# Thèmes de dés (Dé de Blocage + D6)

## Pourquoi

Les faces du Dé de Blocage de la home vont changer d'icônes, et les mêmes
faces serviront ailleurs : phases d'avant et d'après-match de la feuille de
match, puis parties en ligne et tout jet de dés. Le coach doit pouvoir
choisir l'apparence de ses dés depuis son profil ; des thèmes seront à
terme achetables en Crowns.

Aujourd'hui le dessin des faces est codé en dur dans `NuffleArt.BlockDie`
(home seulement), et un D6 s'affiche en chiffre dans une boîte
(`HateRollsRecap`) ou en caractère Unicode (`⚄`).

## Quoi

1. **Un thème = un rendu par famille de dé** (`DiceThemeRenderer` :
   `BlockFace` + `D6Face`). Thème unique pour l'instant : « Nuffle » (gravure
   or sur jeton sombre, l'art actuel de la home), qui est le DÉFAUT.
2. **Deux icônes partagées** : `BlockDieIcon` et `D6Icon`
   (`components/dice/`), qui dessinent dans le thème du coach. Branchées sur
   la home (lanceur de dés + tuiles) et l'après-match de la feuille (jets de
   Haine (X)).
3. **Préférence stockée côté serveur** (`User.diceTheme`, nullable) et
   servie par `GET|PUT /dice-themes/me`, avec le catalogue et la possession.
4. **Sélecteur dans le profil** (`/me/profile`) : aperçu des 11 faces par
   thème, thème actif marqué, thème payant non possédé verrouillé avec son
   prix.
5. **Flag `dice_themes`** (OFF) : gate la route ET le sélecteur ; OFF, tout
   le monde voit le thème par défaut et aucune requête n'est faite.

## Hors périmètre (suites possibles)

- Achat d'un thème en Crowns (pas de puits de Crowns hors Pro League gelée).
  Point d'entrée prévu : `loadOwnedPaidThemeIds` du service.
- Nouveaux thèmes et nouvelles icônes (le changement d'icônes de la home se
  fera en éditant `themes/nuffle.tsx` ou en ajoutant un thème).
- Dés du moteur en ligne (plateau Pixi) et autres jets (2D6 de météo et de
  coup d'envoi, saisis en liste déroulante par leur TOTAL).
