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

    const [stats, leadCounts] = await Promise.all([
      getQueueStats(),
      prisma.lead.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ])

    let recentFailed: object[] = []
    try {
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
      console.warn("[GET /api/admin/queue] Redis unavailable for getFailed:", redisErr)
    }

    const byStatus = Object.fromEntries(leadCounts.map((r) => [r.status, r._count._all]))

    return ok({ queue: stats, leads: byStatus, recentFailed })
  } catch (error) {
    console.error("[GET /api/admin/queue]", error)
    return serverError()
  }
}
