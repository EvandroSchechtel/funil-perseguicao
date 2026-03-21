import { NextRequest } from "next/server"
import IORedis from "ioredis"
import type { Job } from "bullmq"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError } from "@/lib/api/response"
import { getWebhookQueue, getGrupoEventosQueue, type WebhookJobData, type GrupoEventoJobData } from "@/lib/queue/queues"
import { getRedisConfig } from "@/lib/queue/redis"
import { prisma } from "@/lib/db/prisma"

// Ping Redis to verify connectivity and measure latency
async function pingRedis(): Promise<{ ok: boolean; latencyMs: number | null }> {
  let client: IORedis | null = null
  try {
    client = new IORedis({ ...getRedisConfig(), lazyConnect: true, connectTimeout: 3000 })
    await client.connect()
    const start = Date.now()
    await client.ping()
    const latencyMs = Date.now() - start
    return { ok: true, latencyMs }
  } catch {
    return { ok: false, latencyMs: null }
  } finally {
    if (client) client.disconnect()
  }
}

// Start of today in BRT (UTC-3)
function inicioDiaHoje(): Date {
  const now = new Date()
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), 3, 0, 0, 0))
}

// GET /api/admin/queue
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const inicioDia = inicioDiaHoje()

    // ── DB queries — always works, independent of Redis ──────────────────────
    const statusList = ["pendente", "processando", "sucesso", "falha", "sem_optin", "aguardando"] as const
    const [
      leadCounts,
      entradasHoje,
      saidasHoje,
      entradasTotal,
      saidasTotal,
    ] = await Promise.all([
      Promise.all(statusList.map((s) => prisma.lead.count({ where: { status: s } }))),
      prisma.entradaGrupo.count({ where: { entrou_at: { gte: inicioDia } } }),
      prisma.saidaGrupo.count({ where: { saiu_at: { gte: inicioDia } } }),
      prisma.entradaGrupo.count(),
      prisma.saidaGrupo.count(),
    ])

    const leads = Object.fromEntries(statusList.map((s, i) => [s, leadCounts[i]]))

    // ── Redis — best-effort ──────────────────────────────────────────────────
    let redis = { ok: false, latencyMs: null as number | null }
    let webhooksQueue = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }
    let grupoEventosQueue = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }
    let webhooksFailed: object[] = []
    let grupoEventosFailed: object[] = []

    try {
      const [redisPing, wq, geq] = await Promise.all([
        pingRedis(),
        getWebhookQueue(),
        getGrupoEventosQueue(),
      ])
      redis = redisPing

      const [
        wWaiting, wActive, wCompleted, wFailed, wDelayed,
        gWaiting, gActive, gCompleted, gFailed, gDelayed,
        wFailedJobs, gFailedJobs,
      ] = await Promise.all([
        wq.getWaitingCount(),
        wq.getActiveCount(),
        wq.getCompletedCount(),
        wq.getFailedCount(),
        wq.getDelayedCount(),
        geq.getWaitingCount(),
        geq.getActiveCount(),
        geq.getCompletedCount(),
        geq.getFailedCount(),
        geq.getDelayedCount(),
        wq.getFailed(0, 9),
        geq.getFailed(0, 9),
      ])

      webhooksQueue = {
        waiting: wWaiting, active: wActive, completed: wCompleted,
        failed: wFailed, delayed: wDelayed, paused: 0,
        total: wWaiting + wActive + wDelayed,
      }
      grupoEventosQueue = {
        waiting: gWaiting, active: gActive, completed: gCompleted,
        failed: gFailed, delayed: gDelayed, paused: 0,
        total: gWaiting + gActive + gDelayed,
      }

      webhooksFailed = wFailedJobs.map((j: Job<WebhookJobData>) => ({
        jobId: j.id,
        leadId: j.data?.leadId,
        nome: j.data?.nome,
        telefone: j.data?.telefone,
        flowNs: j.data?.flowNs,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
      }))

      grupoEventosFailed = gFailedJobs.map((j: Job<GrupoEventoJobData>) => ({
        jobId: j.id,
        tipo: j.data?.tipo,
        instanciaId: j.data?.instanciaId,
        telefone: j.data?.payload?.participantPhone,
        chatName: j.data?.payload?.chatName,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
      }))
    } catch (redisErr) {
      console.warn("[GET /api/admin/queue] Redis unavailable:", (redisErr as Error).message)
    }

    return ok({
      redis,
      webhooks: { queue: webhooksQueue, recentFailed: webhooksFailed },
      grupoEventos: {
        queue: grupoEventosQueue,
        recentFailed: grupoEventosFailed,
        entradas_hoje: entradasHoje,
        saidas_hoje: saidasHoje,
        entradas_total: entradasTotal,
        saidas_total: saidasTotal,
      },
      leads,
    })
  } catch (error) {
    console.error("[GET /api/admin/queue]", error)
    return serverError()
  }
}
