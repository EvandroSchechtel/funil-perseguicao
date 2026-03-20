import { defineConfig } from "prisma/config";
import * as fs from "fs";

// Load env files for local development.
// Next.js loads .env.local automatically at runtime, but Prisma CLI does not.
// We try .env.local first (real credentials), then fall back to .env.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv");
  if (fs.existsSync(".env.local")) {
    dotenv.config({ path: ".env.local", override: true });
  } else {
    dotenv.config();
  }
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
