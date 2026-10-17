---
"@bb/server": patch
"@bb/web": patch
---

Les statistiques de la fiche d'équipe comptent enfin les matchs de ligue.

**Une équipe qui avait joué toute une saison affichait « 0 match ».** Le bloc « Statistiques de l'équipe » ne lisait que les parties offline saisies à la main (et les rencontres de coupe). Un résultat de ligue — feuille de match validée, forfait, match en ligne rattaché à une saison — n'y apparaissait jamais. Valider une feuille ne changeait donc rien à la fiche.

**Le bilan couvre désormais toutes les compétitions.** Les matchs joués, le bilan victoires / nuls / défaites et les touchdowns pour / contre additionnent la ligue (les mêmes compteurs que le classement, forfaits compris), la coupe et les matchs amicaux, avec le détail par compétition sous le nombre de matchs. Une feuille invalidée sort du bilan d'elle-même.
