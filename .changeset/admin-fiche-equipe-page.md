---
"@bb/server": minor
"@bb/web": minor
---

Console admin : la fiche d'une équipe devient une page, lisible comme sur le site public.

**Le manque.** La visualisation d'une équipe depuis `/admin/teams` s'ouvrait dans une modale qui affichait les données brutes de la base : la position d'un joueur apparaissait en slug (`black_orc_orque_noir`) et ses compétences en chaîne CSV (`brawler,grab`). Ni les mots-clés de la position, ni la distinction entre compétence de base et compétence acquise, ni les accès de montée de niveau — tout ce que la fiche coach montre déjà. Les Star Players n'étaient identifiés que par leur slug, sans nom ni caractéristiques.

**La fiche vit désormais à `/admin/teams/[id]`.** Une page se partage par URL et se recharge, ce qu'une modale ne fait pas, et elle a la place d'afficher un roster entier. Elle réutilise les composants de la fiche coach plutôt que d'en réimplémenter une variante : nom de position résolu, mots-clés, infobulle de compétence avec base/acquise distinguées à partir des compétences par défaut lues en base, badges d'accès primaire/secondaire, panneau Star Players. S'y ajoutent les PSP et les matchs joués, et les joueurs morts ou licenciés restent visibles, grisés et étiquetés.

**Trois affordances admin :** retour à l'écran précédent, navigation entre toutes les équipes du même coach (précédente / suivante et pastilles cliquables, les équipes supprimées barrées), et le journal de l'équipe — aperçu des dernières écritures sur la page même, avec lien vers le journal complet.

Côté API, `GET /admin/teams/:id` sert désormais les Star Players enrichis par le catalogue (même source que `GET /team/:id`, donc un edit admin sur `StarPlayer` se répercute sans resync, avec repli sur slug + coût si la ligne est inconnue) et la liste des équipes du propriétaire, équipes soft-deletées comprises mais marquées.

Corrige au passage le filtre « ruleset » de la liste admin, qui ne relançait aucune recherche.
