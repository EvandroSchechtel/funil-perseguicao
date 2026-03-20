import { Queue } from "bullmq"
import { getRedisConfig } from "./redis"

// Main queue for processing incoming webhook payloads → Manychat API
let _webhookQueue: Queue | null = null

export interface WebhookJobData {
  leadId: string
  webhookId: string
  contaId: string
  flowNs: string
  nome: string
  telefone: string
  email?: string
}

export function getWebhookQueue(): Queue {
  if (!_webhookQueue) {
    _webhookQueue = new Queue("webhooks", {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // 5s, 25s, 125s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
  }
  return _webhookQueue
}

export async function addWebhookJob(data: WebhookJobData, opts?: { forceNew?: boolean; delay?: number }) {
  const queue = getWebhookQueue()
  if (opts?.forceNew) {
    // Remove existing job (any state) so we can re-enqueue without dedup blocking it
    try { await queue.remove(data.leadId) } catch { /* ignore if not found */ }
    return queue.add("process-lead", data, { jobId: `${data.leadId}-${Date.now()}`, delay: opts.delay })
  }
  return queue.add("process-lead", data, { jobId: data.leadId, delay: opts?.delay })
}

export async function getQueueStats() {
  try {
    const queue = getWebhookQueue()
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])
    return { waiting, active, completed, failed, delayed, paused: 0, total: waiting + active + delayed }
  } catch (err) {
    console.error("[getQueueStats] Redis error:", err)
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }
  }
}
