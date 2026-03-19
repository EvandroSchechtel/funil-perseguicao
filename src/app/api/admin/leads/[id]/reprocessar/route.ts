import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { addWebhookJob } from "@/lib/queue/queues"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"

// POST /api/admin/leads/[id]/reprocessar
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        webhook: {
          select: { id: true, conta_id: true, flow_ns: true, status: true, deleted_at: true },
        },
      },
    })

    if (!lead) return notFound("Lead não encontrado.")
    if (lead.status !== "falha") {
      return badRequest("Apenas leads com status 'falha' podem ser reprocessados.")
    }

    if (!lead.webhook || lead.webhook.deleted_at) {
      return badRequest("O webhook associado a este lead foi removido.")
    }

    // Reset lead status and requeue
    await prisma.lead.update({
      where: { id },
      data: { status: "pendente", erro_msg: null },
    })

    await addWebhookJob({
      leadId: lead.id,
      webhookId: lead.webhook_id,
      contaId: lead.webhook.conta_id,
      flowNs: lead.webhook.flow_ns,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email || undefined,
    })

    return ok({ message: "Lead reenfileirado para reprocessamento." })
  } catch (error) {
    console.error("[POST /api/admin/leads/[id]/reprocessar]", error)
    return serverError()
  }
}
