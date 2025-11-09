/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ["@bb/ui", "@bb/game-engine"],
  },
  transpilePackages: ["@bb/ui", "@bb/game-engine", "jose"],
};
export default nextConfig;
