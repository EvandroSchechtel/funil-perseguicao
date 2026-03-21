/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server starts (Node.js runtime only).
 * Used to initialize background services like BullMQ workers.
 */
export async function register() {
  // Only run in the Node.js runtime — never in Edge or browser contexts
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startWebhookWorker, startGrupoEventosWorker, startMonitorWorker } =
        await import("./src/lib/queue/workers")
      const { agendarMonitoramento } = await import("./src/lib/queue/queues")

      startWebhookWorker()
      console.log("[BullMQ] Webhook worker started successfully")

      startGrupoEventosWorker()
      console.log("[BullMQ] Grupo-eventos worker started successfully")

      startMonitorWorker()
      console.log("[BullMQ] Monitor worker started successfully")

      agendarMonitoramento().catch((err) =>
        console.error("[BullMQ] Failed to schedule monitor job:", err)
      )
    } catch (err) {
      // Worker failure should not crash the server — log and continue
      console.error("[BullMQ] Failed to start workers:", err)
    }
  }
}
