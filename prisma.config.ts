import { defineConfig } from "prisma/config";

// Load .env file for local development.
// In production (Railway, etc.) the env vars are injected directly,
// so dotenv may not be installed — the try-catch handles that gracefully.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
} catch {
  // dotenv not available (production build) — DATABASE_URL must be set externally
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
