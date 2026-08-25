---
"@bb/game-engine": patch
"@bb/server": patch
"@bb/web": patch
---

Les règlements de tournoi sont appliqués au-delà des budgets.

Le pack NAF World Cup 2027 était pris en compte pour ce qu'il impose de plus visible (budget d'or, pool de SPP, rosters et Star Players autorisés, taxe Star Players), mais quatre de ses règles restaient lettre morte.

- **Surcoût Élite** : le pack facture 2 PSP par compétence Élite sans republier la liste des compétences concernées, donc `eliteSkills` était vide et le surcoût jamais appliqué. `resolveTournamentEliteSkills()` retient la liste du règlement s'il en publie une, sinon celles de l'édition (`Skill.isElite` : Blocage, Esquive, Châtaigne, Garde). Le serveur les résout à la création, le builder affiche les mêmes coûts.
- **Effectif régulier minimum** : 11 joueurs avant tout Star Player. `POST /team/build` refuse en deçà, et le builder remplace le sélecteur de Star Players par l'explication tant que l'effectif n'y est pas.
- **Barème de classement** : le pack compte V 5 / N 2 / D 0 / concession -5. Une ligue ou une coupe créée sous ce règlement l'IMPOSE désormais (au lieu du barème maison) ; côté coupe les points d'action passent à 0, sinon un touchdown pèserait autant qu'une victoire dans le total.
- **Coups de pouce** : le règlement publie une liste fermée avec ses prix (Mascotte 25 000, Fûts 50 000 ×2, Pots-de-vin 100 000…). La feuille de match sert cette liste et ces prix, et refuse à la soumission tout coup de pouce hors pack.
