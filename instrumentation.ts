/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server starts (Node.js runtime only).
 * Used to initialize background services like BullMQ workers.
 */
export async function register() {
  // Only run in the Node.js runtime — never in Edge or browser contexts
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startWebhookWorker } = await import("./src/lib/queue/workers")
      startWebhookWorker()
      console.log("[BullMQ] Webhook worker started successfully")
    } catch (err) {
      // Worker failure should not crash the server — log and continue
      console.error("[BullMQ] Failed to start webhook worker:", err)
    }
  }
}
