---
"@bb/web": patch
---

Page publique de partage d'un roster : l'écart entre la Valeur d'Équipe et la VE actuelle est désormais expliqué.

Une équipe Ogre à 16 joueurs affichait VE 1 415K et VE actuelle 1 265K sans qu'aucun joueur ne soit indisponible et avec une trésorerie à 0 — 150K sans justification visible. Le calcul était juste : c'est « Trois-quarts à vil prix », la règle spéciale du roster Ogre, qui traite le Coût d'Embauche des Trois-quarts comme nul dans la VE actuelle. Les 10 Trois-Quarts Gnoblar à 15K font exactement les 150K, leurs augmentations de valeur restant comptées.

Le serveur décomposait déjà cet écart (`budgetSummary.cheapLinemenWaived` et `unavailablePlayersCost`) et la fiche du coach l'affichait ; `/r/:token` servait les quatre chiffres nus. Un visiteur — le seul public de cette page — ne pouvait que conclure à une erreur de calcul. La page lit maintenant les deux postes servis et rend l'écart poste par poste, sans rien re-dériver de son côté. Aucun changement de calcul, et rien ne s'affiche quand la VE actuelle vaut la VE.
