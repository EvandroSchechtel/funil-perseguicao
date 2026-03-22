import { Queue } from "bullmq"
import { getRedisConfig } from "./redis"
import { getParticipantPhone, type ZApiWebhookPayload } from "@/lib/zapi/client"

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
    // Remove the canonical job (initial enqueue uses leadId as jobId)
    try { await queue.remove(data.leadId) } catch { /* ignore if not found */ }
    // Also scan delayed jobs: moveToDelayed keeps the original timestamped jobId,
    // so previous forceNew jobs that got delayed won't be found by plain remove().
    try {
      const delayed = await queue.getDelayed(0, 200)
      for (const j of delayed) {
        if ((j.data as WebhookJobData)?.leadId === data.leadId && j.id !== data.leadId) {
          try { await queue.remove(j.id!) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore Redis errors */ }
    // Use canonical leadId as jobId (no timestamp) to prevent job accumulation
    return queue.add("process-lead", data, { jobId: data.leadId, delay: opts.delay })
  }
  return queue.add("process-lead", data, { jobId: data.leadId, delay: opts?.delay })
}

// ── grupo-eventos queue ────────────────────────────────────────────────────────

export interface GrupoEventoJobData {
  tipo: "entrada" | "saida"
  instanciaId: string
  payload: ZApiWebhookPayload
}

let _grupoEventosQueue: Queue | null = null

export function getGrupoEventosQueue(): Queue {
  if (!_grupoEventosQueue) {
    _grupoEventosQueue = new Queue("grupo-eventos", {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 }, // 5s → 25s → 125s
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })
  }
  return _grupoEventosQueue
}

/**
 * Enqueues a Z-API group entry or exit event for reliable async processing.
 * Deduplicates by phone+group (entries) or phone+group+minute (exits).
 * Swallows Redis errors silently so the webhook route always returns 200.
 */
export async function addGrupoEventoJob(data: GrupoEventoJobData): Promise<void> {
  const { tipo, instanciaId, payload } = data
  const telefone = getParticipantPhone(payload).replace(/\D/g, "")
  const grupoRef = payload.phone || payload.chatId || payload.chatName || "unknown"

  // Entries: same phone+group → safe to dedup (DB upsert is idempotent)
  // Exits: include minute-epoch to allow multiple exits but dedup Z-API retries
  // BullMQ v5 forbids ":" in custom jobIds (reserved for Redis key prefix)
  const jobId =
    tipo === "entrada"
      ? `entrada_${instanciaId}_${telefone}_${grupoRef}`
      : `saida_${instanciaId}_${telefone}_${grupoRef}_${Math.floor(Date.now() / 60000)}`

  await getGrupoEventosQueue()
    .add("grupo-evento", data, { jobId })
    .catch((err) => console.error("[addGrupoEventoJob] Redis indisponível:", err))
}

// ── monitor queue ─────────────────────────────────────────────────────────────

let _monitorQueue: Queue | null = null

export function getMonitorQueue(): Queue {
  if (!_monitorQueue) {
    _monitorQueue = new Queue("monitor", {
      connection: getRedisConfig(),
      defaultJobOptions: { removeOnComplete: { count: 10 }, removeOnFail: { count: 20 } },
    })
  }
  return _monitorQueue
}

/**
 * Schedules a repeating health-check job every 5 minutes.
 * Safe to call multiple times — BullMQ deduplicates by jobId.
 */
export async function agendarMonitoramento(): Promise<void> {
  await getMonitorQueue().add(
    "health-check",
    {},
    { repeat: { every: 5 * 60 * 1000 }, jobId: "health-check-repeat" }
  )
  console.log("[Monitor] Job de monitoramento agendado (a cada 5min)")
}

// ── stats ──────────────────────────────────────────────────────────────────────

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
