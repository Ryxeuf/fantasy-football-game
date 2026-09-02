---
"@bb/server": patch
"@bb/web": patch
---

Feuille de match — journaliers : poste, évolutions et tirage « Hasard ».

**Poste de chaque journalier.** Quand le roster offre plusieurs Trois-quarts (Orques : Orque ou Gobelin), changer le poste d'un journalier RE-GÈLE le côté : la VEA du match (donc la cagnotte des coups de pouce) et le roster « version du match » suivent désormais le choix, comme les pickers d'évènements. La valeur des journaliers est stockée à part dans le gel (`journeymenValue`) ; les feuilles antérieures restent lisibles sans backfill.

**Évolution d'un journalier.** L'API refusait toute évolution stagée pour un journalier (« Joueur journeyman-away-1 hors de l'équipe extérieur ») : il est désormais reconnu par la même dérivation que celle qui l'affiche. Un journalier désigné Joueur du Match sans autre statistique reçoit ses PSP dès la saisie (il manquait aux paliers d'évolution et son recrutement partait de zéro). L'éditeur affiche le poste choisi dans son libellé et le bloc « SPP estimés » le liste.

**Tirage « Hasard ».** La Compétence Principale au hasard (3 PSP) est ouverte aux journaliers : endpoint `POST /leagues/pairings/:id/sheet/journeymen/:journeymanId/roll-random-primary`, tirage déterministe (feuille + journalier + poste + catégorie) re-vérifié à la validation. Les évolutions des journaliers sont contrôlées à la validation comme celles du roster (compétence possédée, pool du poste, candidats du tirage) et TRACÉES sur la feuille (appliquée / refusée / non recruté / PSP insuffisants) au lieu d'être perdues ou laissées « en attente ».
