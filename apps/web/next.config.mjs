/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["@bb/ui", "@bb/game-engine"],
  },
  transpilePackages: ["@bb/ui", "@bb/game-engine", "@bb/nfl-mapper", "jose"],
  // @bb/nfl-mapper utilise des imports ESM NodeNext avec extension .js
  // explicite (ex: "./position-to-bb.js") alors que la source est en .ts
  // (resolue via tsconfig paths, pas de dist). Webpack ne sait pas mapper
  // .js -> .ts par defaut : extensionAlias le lui apprend. Fallback sur
  // les vrais fichiers .js (aucun impact sur les autres imports).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  // Faces de dés (`public/images/dices/`, ~33 Mo de PNG) : la boutique et
  // l'admin en affichent des centaines. Sans en-tête, `public/` est servi en
  // `max-age=0` et chaque visite les revalide une à une. Une semaine (pas
  // `immutable` : les noms de fichiers ne sont pas versionnés).
  async headers() {
    return [
      {
        source: "/images/dices/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  // Optimisations SEO
  compress: true,
  poweredByHeader: false,
  // Optimisation des images
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
export default nextConfig;
