---
"@bb/server": minor
"@bb/web": minor
---

Fiches de positionnels enrichies, portraits sur les cartes exportables et outils du catalogue enfin visibles.

**La carte d'un Star Player sortait sans visage.** La fiche `/star-players/grombrindal` affiche bien un portrait, mais sa carte exportable `/star-players/grombrindal/card` tombait sur l'emblème programmatique : satori ne décode que png/apng/jpeg/gif/svg, or les visuels du catalogue sont en `.webp`. Un nouveau résolveur (`lib/player-card/portrait.ts`) lit l'asset **sur disque** quand il vient d'un dossier allowlisté de `public/` (`star-players`, `positions`, `player-images`), le transcode en PNG si nécessaire, et l'embarque en data URI. Quand rien d'affichable ne peut être produit, le portrait est abandonné au lieu d'être passé à satori, qui lèverait. Le chemin est validé segment par segment puis revérifié après résolution absolue, et le résultat est mis en cache par process. Même bénéfice côté joueurs de coach : sans photo, la carte reprend l'illustration du positionnel.

**Chaque positionnel peut porter son propre contenu.** `Position` gagne cinq colonnes nullables — illustration, description de jeu et fluff, ces deux derniers bilingues — posables par `prisma db push` sans backfill. La résolution (trim, chaîne vide ramenée à `null`, repli FR quand la traduction manque) vit dans un helper pur partagé par `/api/positions` et `/api/rosters/:slug`, pour que les deux lectures ne divergent jamais. La saisie se fait dans `/admin/data/positions`, et la duplication d'un poste vers une autre édition emporte son contenu.

**La fiche d'un poste dit enfin de quelle édition elle parle.** `/teams/amazon/guerriere_jaguar` affiche l'illustration en tête, les sections « Rôle sur le terrain » et « Dans l'univers », un badge de l'édition réellement servie (les stats d'un même poste changent entre Saison 2 et Saison 3) et une bascule explicite entre éditions. La description éditoriale ouvre désormais la meta description et le `DefinedTerm` JSON-LD, les stats restant citables derrière.

**Les outils du catalogue n'étaient atteignables qu'en connaissant leur URL.** Comparateur d'équipes, comparateur de positions, études des positions et tier list ont maintenant un menu « Outils » dans l'en-tête (desktop et mobile), un bloc dans le pied de page, et une barre commune montée sur toutes les pages du catalogue — qui masque l'outil sur lequel on se trouve déjà.

**Et les classements de positions passent au-dessus de la pliure.** Sur `/teams/positions`, l'explorateur listait les ~300 postes du catalogue *avant* « les plus rapides », « les plus agiles » et les quatre autres classements : il fallait scroller très loin pour atteindre le contenu principal. Les classements passent en premier, précédés d'un sommaire d'ancres ; l'explorateur passe dessous, replié par défaut et borné à 24 résultats.
