# Polices auto-hébergées

Chargées par `next/font/local` dans `app/layout.tsx`. Elles remplacent
`next/font/google`, qui téléchargeait les polices à chaque `next build` : le
2026-10-29, une réponse inattendue de Google Fonts a fait échouer le
déploiement en production (`TypeError: Cannot read properties of null
(reading '1')` dans `@next/font/dist/google/loader.js`). Un build ne dépend
plus du réseau.

Fichiers = sous-ensemble **latin** servi par Google Fonts (CSS2 API,
user-agent Chrome, soit exactement les fichiers que `next/font/google`
préchargeait). Les caractères hors latin passent sur la police de repli
générée par Next.

| Fichier | Famille | Graisses | Source |
|---|---|---|---|
| `cinzel-decorative-400-latin.woff2` | Cinzel Decorative | 400 | `fonts.gstatic.com/s/cinzeldecorative/v19` |
| `cinzel-decorative-700-latin.woff2` | Cinzel Decorative | 700 | `fonts.gstatic.com/s/cinzeldecorative/v19` |
| `cinzel-variable-latin.woff2` | Cinzel (variable) | 400–700 | `fonts.gstatic.com/s/cinzel/v26` |
| `montserrat-variable-latin.woff2` | Montserrat (variable) | 400–700 | `fonts.gstatic.com/s/montserrat/v31` |
| `inter-variable-latin.woff2` | Inter (variable) | 400–600 | `fonts.gstatic.com/s/inter/v20` |
| `bebas-neue-400-latin.woff2` | Bebas Neue | 400 | `fonts.gstatic.com/s/bebasneue/v16` |

Toutes sont sous licence SIL Open Font License 1.1 (redistribution autorisée).

## Mettre à jour une police

```bash
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36'
curl -s -A "$UA" 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
# repérer le bloc /* latin */, télécharger son url(...) dans ce dossier
```

Garde : `self-hosted-fonts.test.ts` (aucun `next/font/google`, chaque fichier
référencé existe et est un WOFF2).
