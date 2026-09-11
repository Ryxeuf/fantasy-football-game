---
"@bb/server": minor
"@bb/web": minor
---

La feuille de match devient le seul chemin de saisie : la partie offline est désactivée, et le bandeau des rondes d'une coupe dit enfin quel appariement s'applique.

**Le bandeau des rondes suit le système choisi.** Il annonçait « Rondes (système suisse) » et décrivait l'appariement par classement **en permanence** — y compris après que le commissaire ait sélectionné « Tirage au sort » ou « Saisie manuelle » : le texte décrivait une règle qui n'allait pas être appliquée à la ronde générée. Titre et description suivent désormais la pastille choisie. Hors sélection (coach inscrit, ou commissaire qui ne peut pas encore générer), le bandeau reste **neutre** : une coupe panache les systèmes d'une ronde à l'autre, en annoncer un seul serait faux — c'est le badge de chaque ronde qui dit avec quel appariement elle a été composée. Le petit texte sous les pastilles disparaît : il répétait la même chose au même écran.

**Plus de création de partie offline depuis une coupe.** Une rencontre proposait encore « Créer le match », et la page de la coupe « Créer un match local pour cette coupe », alors qu'un résultat de coupe se saisit sur la **feuille de match**, exactement comme en ligue. Deux chemins concurrents écrivaient le même résultat sans que l'écran dise lequel faisait foi. Seule la feuille reste proposée ; le bracket de play-offs pointe vers elle, et la liste « Matchs de la coupe » devient un récapitulatif en lecture seule.

**La partie offline est désactivée sur le site.** La brique `/local-matches` (journal d'actions saisi à la main, sans les règles de fin de match, sans VE ni PSP) passe derrière le feature flag `offline_match`, **coupé par défaut** : plus d'entrée de menu ni de carte d'accueil, et un accès direct affiche un écran qui renvoie vers la feuille de match. Rien n'est supprimé — le modèle `LocalMatch` continue de porter la **matérialisation** du résultat d'une feuille de coupe (dont le classement dérive), les administrateurs gardent l'accès aux parties déjà enregistrées, et la fonctionnalité se rallume d'un toggle admin le jour où elle sera mûre.
