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
