import { NextRequest } from "next/server"
import type { Job } from "bullmq"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { getWebhookQueue, type WebhookJobData } from "@/lib/queue/queues"
import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "@/lib/services/errors"

// GET /api/admin/webhooks/[id]/queue
// Returns BullMQ job counts + jobs filtered by webhookId + last 100 leads
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params

    // Verify webhook exists
    const webhook = await prisma.webhook.findFirst({ where: { id, deleted_at: null }, select: { id: true } })
    if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

    // ── Leads from DB (always available) ───────────────────────────────────
    const leads = await prisma.lead.findMany({
      where: { webhook_id: id },
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        subscriber_id: true,
        flow_executado: true,
        conta_nome: true,
        status: true,
        erro_msg: true,
        tentativas: true,
        grupo_entrou_at: true,
        processado_at: true,
        created_at: true,
        webhook_flow: {
          select: {
            flow_nome: true,
            flow_ns: true,
            conta: { select: { nome: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    })

    // ── BullMQ — best-effort (Redis may be offline) ─────────────────────────
    let counts = { waiting: 0, active: 0, failed: 0, delayed: 0, completed: 0 }
    let jobs: object[] = []
    let redisOnline = true

    try {
      const queue = getWebhookQueue()

      const [allCounts, waitingJobs, activeJobs, failedJobs, delayedJobs] = await Promise.all([
        queue.getJobCounts("waiting", "active", "failed", "delayed", "completed"),
        queue.getJobs(["waiting"], 0, 200),
        queue.getJobs(["active"], 0, 50),
        queue.getJobs(["failed"], 0, 200),
        queue.getJobs(["delayed"], 0, 200),
      ])

      counts = {
        waiting: allCounts.waiting ?? 0,
        active: allCounts.active ?? 0,
        failed: allCounts.failed ?? 0,
        delayed: allCounts.delayed ?? 0,
        completed: allCounts.completed ?? 0,
      }

      const mapJob = (state: string) => (j: Job<WebhookJobData>) => {
        if (j.data?.webhookId !== id) return null
        return {
          id: j.id,
          state,
          leadId: j.data.leadId,
          nome: j.data.nome,
          telefone: j.data.telefone,
          flowNs: j.data.flowNs,
          attemptsMade: j.attemptsMade,
          failedReason: (j as Job<WebhookJobData> & { failedReason?: string }).failedReason ?? null,
          timestamp: j.timestamp,
          processedOn: j.processedOn ?? null,
          delay: j.opts?.delay ?? 0,
        }
      }

      jobs = [
        ...waitingJobs.map(mapJob("waiting")).filter(Boolean),
        ...activeJobs.map(mapJob("active")).filter(Boolean),
        ...failedJobs.map(mapJob("failed")).filter(Boolean),
        ...delayedJobs.map(mapJob("delayed")).filter(Boolean),
      ] as object[]
    } catch (redisErr) {
      console.warn("[GET /api/admin/webhooks/[id]/queue] Redis unavailable:", (redisErr as Error).message)
      redisOnline = false
    }

    return ok({ counts, jobs, leads, redisOnline })
  } catch (error) {
    console.error("[GET /api/admin/webhooks/[id]/queue]", error)
    return handleServiceError(error) ?? serverError()
  }
}
