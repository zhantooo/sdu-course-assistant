import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's driver adapter and pg should stay external to the server bundle.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  // Don't auto-generate AGENTS.md / CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
