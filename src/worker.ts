/**
 * Standalone BullMQ Worker
 * Run with: npm run worker
 *
 * Use this in production when you want to run the worker
 * as a separate process from the Next.js server.
 *
 * Example with PM2:
 *   pm2 start npm --name "funil-worker" -- run worker
 */

import { startWebhookWorker } from "./lib/queue/workers"

console.log("[Worker] Starting standalone BullMQ webhook worker...")
console.log(`[Worker] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`)

const worker = startWebhookWorker()

async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received — shutting down gracefully...`)
  await worker.close()
  console.log("[Worker] Shutdown complete.")
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

console.log("[Worker] Ready. Waiting for jobs...")
