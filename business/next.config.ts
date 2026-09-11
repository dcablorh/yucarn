import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: a self-contained server bundled with only the
  // node_modules it actually imports. The Docker runtime stage copies that
  // instead of the full dependency tree, which is the difference between a
  // ~150MB image and a ~500MB one. Harmless outside Docker.
  output: "standalone",
};

export default nextConfig;
