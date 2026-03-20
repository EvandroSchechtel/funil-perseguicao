import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError } from "@/lib/api/response"
import { getQueueStats, getWebhookQueue } from "@/lib/queue/queues"
import { prisma } from "@/lib/db/prisma"

// GET /api/admin/queue — queue stats + recent failed jobs
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    // Lead counts from DB — always works, independent of Redis
    const statusList = ["pendente", "processando", "sucesso", "falha", "sem_optin", "aguardando"] as const
    const leadCountResults = await Promise.all(
      statusList.map((s) => prisma.lead.count({ where: { status: s } }))
    )
    const byStatus = Object.fromEntries(statusList.map((s, i) => [s, leadCountResults[i]]))

    // BullMQ stats — best-effort, Redis may not be reachable from Next.js
    let stats = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }
    let recentFailed: object[] = []
    try {
      stats = await getQueueStats()
      const failedJobs = await getWebhookQueue().getFailed(0, 9)
      recentFailed = failedJobs.map((j) => ({
        jobId: j.id,
        leadId: j.data?.leadId,
        nome: j.data?.nome,
        telefone: j.data?.telefone,
        flowNs: j.data?.flowNs,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
      }))
    } catch (redisErr) {
      console.warn("[GET /api/admin/queue] Redis stats unavailable:", (redisErr as Error).message)
    }

    return ok({ queue: stats, leads: byStatus, recentFailed })
  } catch (error) {
    console.error("[GET /api/admin/queue]", error)
    return serverError()
  }
}
