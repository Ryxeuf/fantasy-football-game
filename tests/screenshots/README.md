# Captures d'écran versionnées

Preuves visuelles des corrections livrées, régénérables à l'identique.

Le harnais rend les **vrais composants React** de `apps/web` avec
`react-dom/server`, applique la **vraie feuille Tailwind** du projet
(générée par le binaire local, pas un CDN) et capture le résultat avec le
Chromium de Playwright. Aucun serveur ni base de données n'est requis : les
composants reçoivent des props représentatives, donc une capture obsolète
signale un vrai changement de rendu.

## Régénérer

```bash
pnpm --filter @bb/tests-screenshots run capture
```

Les PNG sont écrits dans [`docs/screenshots/`](../../docs/screenshots) et
versionnés.

## Ajouter une capture

Ajouter une entrée à `scenes.tsx` (`id`, `title`, `width`, `render`). Le
`id` devient le nom du fichier.
