---
"@bb/server": patch
"@bb/web": patch
---

NFL Fantasy : le cron suit enfin le vrai calendrier 2026, et un lineup se fige joueur par joueur au coup d'envoi.

Les semaines étaient ancrées au 5 septembre — un samedi en 2026 —, si bien que 247 matchs de saison régulière sur 272 tombaient dans la mauvaise semaine : le verrou du dimanche visait la semaine suivante et les stats du dimanche n'étaient jamais ingérées. Les fenêtres partent désormais du mardi qui suit le Labor Day. Le règlement passe au mercredi, après un import frais (les stats du Monday Night sont publiées le mardi vers 12h30 UTC), et un règlement déjà fait peut être rejoué sans recréditer la carrière.

Un joueur dont le match a commencé ne peut plus entrer, sortir, ni devenir capitaine ou vice-capitaine : jusqu'ici, un joueur du jeudi restait modifiable jusqu'au dimanche, stats connues. L'écran de lineup affiche l'heure de chaque match et grise les joueurs figés. Au passage, les coups d'envoi de septembre-octobre étaient enregistrés une heure trop tard (heure d'été ignorée).

Rattrapage du début de saison : `make nfl-catchup-prod-2026` après la publication des stats du Monday Night.
