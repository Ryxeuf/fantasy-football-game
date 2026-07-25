---
"@bb/server": minor
"@bb/web": minor
---

Morts et licenciements tracés et réversibles : le statut de présence d'un joueur porte désormais sa provenance (feuille de match, match en ligne, commissaire, admin) et un journal d'événements. L'annulation d'un match — invalidation d'une feuille de ligue, annulation ou suppression administrative d'un match en ligne — ressuscite les joueurs qu'il a tués et réintègre ceux qu'il a licenciés, et uniquement ceux-là : la reversion est refusée quand le statut courant a été posé par une autre source. Corrige au passage les filtres de roster actif (un licencié ne peut plus être aligné en match ni prendre un level-up, un joueur mort ne part plus en coupe).
