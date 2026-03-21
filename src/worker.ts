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

import { startWebhookWorker, startGrupoEventosWorker, startMonitorWorker } from "./lib/queue/workers"
import { agendarMonitoramento } from "./lib/queue/queues"

console.log("[Worker] Starting BullMQ workers...")
console.log(`[Worker] Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`)

const webhookWorker = startWebhookWorker()
const grupoWorker = startGrupoEventosWorker()
const monitorWorker = startMonitorWorker()

// Schedule repeating health-check (every 5min)
agendarMonitoramento().catch((err) => console.error("[Worker] Erro ao agendar monitoramento:", err))

async function shutdown(signal: string) {
  console.log(`[Worker] ${signal} received — shutting down gracefully...`)
  await Promise.all([webhookWorker.close(), grupoWorker.close(), monitorWorker.close()])
  console.log("[Worker] Shutdown complete.")
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

console.log("[Worker] Ready. Workers: webhooks, grupo-eventos, monitor")
