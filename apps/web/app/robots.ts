import { MetadataRoute } from 'next';

/**
 * robots.txt généré par Next.js.
 *
 * IMPORTANT : si `app/robots.ts` existe, il prend le pas sur le fichier
 * statique `public/robots.txt`. Les deux doivent rester alignés pour
 * que l'intention soit claire à la lecture du dépôt.
 *
 * On déclare explicitement les crawlers IA (GPTBot, ClaudeBot,
 * PerplexityBot, Google-Extended, Applebot-Extended, CCBot, etc.) pour
 * qu'ils puissent indexer et citer les pages publiques — c'est
 * l'objectif GEO / LLMO (Generative Engine Optimization).
 */
export default function robots(): MetadataRoute.Robots {
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nufflearena.fr';

  const privateAreas = [
    '/me/',
    '/api/',
    '/admin/',
    '/login',
    '/register',
    '/waiting/',
    '/lobby/',
    '/spectate/',
    '/replay/',
  ];

  // Crawlers IA / moteurs génératifs auxquels on accorde explicitement
  // l'accès au contenu public. Les zones privées restent interdites.
  const aiCrawlers = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'anthropic-ai',
    'Claude-Web',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Amazonbot',
    'DuckAssistBot',
    'Meta-ExternalAgent',
    'Meta-ExternalFetcher',
    'Bytespider',
    'MistralAI-User',
    'YouBot',
    'cohere-ai',
    'cohere-training-data-crawler',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: privateAreas,
      },
      ...aiCrawlers.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: privateAreas,
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
