/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server starts (Node.js runtime only).
 *
 * Workers are started inline here for single-container deployments.
 * When running a dedicated worker process (e.g. `npm run worker` on Railway),
 * set DISABLE_INLINE_WORKERS=true in the Next.js container to avoid
 * duplicate consumers on the same BullMQ queues.
 */
export async function register() {
  // Only run in the Node.js runtime — never in Edge or browser contexts
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // Skip if a dedicated worker process is handling the queues
  if (process.env.DISABLE_INLINE_WORKERS === "true") {
    console.log("[BullMQ] Inline workers disabled (DISABLE_INLINE_WORKERS=true) — using dedicated worker process")
    return
  }

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
