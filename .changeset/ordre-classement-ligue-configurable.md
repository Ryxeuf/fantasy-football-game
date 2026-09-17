---
"@bb/server": minor
"@bb/web": minor
---

L'ordre de tri du classement d'une ligue se corrige — et se choisit.

**Le classement ne triait pas sur ce qu'il affiche.** Le tableau montre Pts | Bo | MJ | For | TD+ | TD- | Diff TD | Sor+ | Sor- | Diff Sor, mais le tri n'en lisait que trois colonnes : points, différence de TD, TD marqués, différence de sorties. Deux colonnes bien visibles n'entraient jamais dans le départage — les **points bonus** (`Bo`, qui sont comptés à part des points : c'est leur seule matérialisation) et les **forfaits** (`For`). Une équipe qui gagnait ses bonus passait donc derrière une équipe qui n'en avait aucun, et déclarer forfait ne coûtait rien au classement.

**Le nouvel ordre par défaut suit les colonnes** : points, puis points bonus, puis forfaits (le moins de forfaits devant), puis différence de TD, puis différence de sorties, le nom de l'équipe tranchant en dernier recours. Il s'applique à toutes les ligues qui ne configurent rien, y compris les anciennes.

**Le créateur d'une ligue compose son propre ordre**, à la création comme à l'édition : une liste ordonnée où l'on ajoute, monte, descend et retire les critères parmi treize — points, bonus, forfaits, différence et détail des TD, différence et détail des sorties, ELO de saison, victoires, matchs joués, nom. Ne rien cocher reste un choix : l'ordre par défaut est annoncé en toutes lettres sous le formulaire.

**Un administrateur peut le corriger à tout moment**, même sur une ligue verrouillée par un match déjà joué, en cours de saison ou archivée. C'est le seul réglage de ligue qui échappe au verrou, et pour une bonne raison : le classement est trié à la lecture, changer l'ordre ne réécrit aucun point déjà attribué. La console `/admin/leagues` affiche l'ordre appliqué de chaque ligue et signale celles qui sont restées sur le défaut.

**L'ordre appliqué est enfin visible** : il s'affiche sous le tableau de classement, du premier au dernier critère. Sans cette ligne, un coach ne pouvait pas savoir pourquoi telle équipe passait devant telle autre à points égaux — c'est exactement comme ça que le problème a été signalé.
