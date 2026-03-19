import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { addWebhookJob } from "@/lib/queue/queues"
import { ok, forbidden, serverError } from "@/lib/api/response"

// POST /api/admin/leads/reprocessar-falhas — bulk requeue all failed leads
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const webhookId = searchParams.get("webhook_id")

    // Find all failed leads with active (non-deleted) webhooks
    const leads = await prisma.lead.findMany({
      where: {
        status: "falha",
        ...(webhookId ? { webhook_id: webhookId } : {}),
        webhook: { deleted_at: null },
      },
      include: {
        webhook: { select: { id: true, conta_id: true, flow_ns: true } },
      },
      take: 500, // safety limit
    })

    if (leads.length === 0) {
      return ok({ reprocessados: 0, message: "Nenhum lead com falha encontrado." })
    }

    // Reset all leads to pendente in a single query
    await prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { status: "pendente", erro_msg: null },
    })

    // Enqueue each job fire-and-forget
    let enqueued = 0
    for (const lead of leads) {
      addWebhookJob({
        leadId: lead.id,
        webhookId: lead.webhook_id,
        contaId: lead.webhook.conta_id,
        flowNs: lead.webhook.flow_ns,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email || undefined,
      }).catch((err) =>
        console.error(`[reprocessar-falhas] Failed to queue lead ${lead.id}:`, err)
      )
      enqueued++
    }

    return ok({
      reprocessados: enqueued,
      message: `${enqueued} lead${enqueued !== 1 ? "s" : ""} reenfileirado${enqueued !== 1 ? "s" : ""} com sucesso.`,
    })
  } catch (error) {
    console.error("[POST /api/admin/leads/reprocessar-falhas]", error)
    return serverError()
  }
}
