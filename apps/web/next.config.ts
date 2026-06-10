import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript is validated by `npm run typecheck`; this avoids a duplicate
    // Next worker spawn that can be blocked by Windows sandbox permissions.
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(appDir, "../.."),
  },
};

export default nextConfig;
