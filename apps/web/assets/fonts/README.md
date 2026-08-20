# Polices embarquées (rendu serveur des cartes joueur)

Fichiers TTF chargés par `app/lib/player-card/render.ts` pour le rendu
`ImageResponse`/satori des cartes joueur exportables (`/api/player-card`,
`/star-players/[slug]/card`). satori exige les données de police brutes —
`next/font` ne les expose pas au runtime, d'où ces copies committées.

| Fichier | Famille | Graisse | Licence |
| --- | --- | --- | --- |
| `bebas-neue-400.ttf` | Bebas Neue | 400 | SIL Open Font License 1.1 |
| `montserrat-600.ttf` | Montserrat | 600 | SIL Open Font License 1.1 |
| `montserrat-800.ttf` | Montserrat | 800 | SIL Open Font License 1.1 |

Les deux familles sont distribuées sous licence
[SIL OFL 1.1](https://openfontlicense.org/) (redistribution autorisée) et
téléchargées depuis Google Fonts. Elles font déjà partie de l'identité du
site (cf. `next/font/google` dans `app/layout.tsx`).
