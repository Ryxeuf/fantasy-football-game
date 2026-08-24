---
"@bb/server": patch
"@bb/web": patch
---

Édition d'équipe : coûts et plafonds de staff justes, résumé budgétaire cohérent.

Le panneau « Staff de l'équipe » de `/me/teams/[id]/edit` écrivait ses coûts et
ses plafonds en dur alors que la création lit déjà la config résolue par le
serveur (`RosterStaffConfig`, par roster × format, éditable en admin). Le
résumé budgétaire en haut de page, lui, ne comptait que les joueurs : il
annonçait « Restant 180k » pendant que le panneau juste en dessous affichait 0.

- Web : le panneau staff reprend le rendu de la création (`StaffRow` +
  `QuantityStepper`) et dérive tous ses coûts/plafonds de la config du roster.
  Le fan dévoué n'est plus annoncé à 10k (il vaut 5k en BB11, 20k en Sevens),
  le format Sevens n'affiche plus les tarifs BB11, et un roster sans droit à
  l'apothicaire ne peut plus le cocher.
- Web : le « Résumé budgétaire » applique la règle du serveur (joueurs + staff
  + Star Players ≤ budget initial), détaille les trois postes et suit le staff
  en cours d'édition ; les coûts d'embauche viennent des positions **en base**
  et le plafond de joueurs suit le format (Sevens 7-11 au lieu d'un 16 en dur).
- Web : le bloc « Informations importantes » n'affirme plus que les
  compétences sont non modifiables (le bouton « + Compétence » en achète contre
  des SPP), cite les bornes du format et rappelle que le staff se sauvegarde
  avec son propre bouton.
- Serveur : `PUT /team/:id/info` valide le staff contre la config résolue du
  roster × format au lieu de bornes Zod figées (0-8 / 0-12 / 0-6 / 1-6), et
  refuse l'apothicaire quand le roster n'y a pas droit.
- Serveur : `GET /team/:id/available-positions` plafonne sur le format de
  l'équipe au lieu d'un `maxPlayers: 16` écrit en dur.
