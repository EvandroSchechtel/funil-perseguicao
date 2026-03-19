import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { addWebhookJob } from "@/lib/queue/queues"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"

const leadSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(200),
  telefone: z.string().min(8, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
})

// POST /api/webhook/{token} — public endpoint, no auth required
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // 1. Find webhook with active flows (ordered for round-robin)
    const webhook = await prisma.webhook.findFirst({
      where: { token, deleted_at: null },
      select: {
        id: true,
        nome: true,
        status: true,
        campanha_id: true,
        campanha: { select: { nome: true } },
        webhook_flows: {
          where: { status: "ativo", deleted_at: null },
          select: {
            id: true,
            flow_ns: true,
            flow_nome: true,
            ordem: true,
            total_enviados: true,
            conta_id: true,
            conta: { select: { nome: true } },
          },
          orderBy: [{ total_enviados: "asc" }, { ordem: "asc" }],
        },
      },
    })

    if (!webhook) return notFound("Webhook não encontrado.")
    if (webhook.status === "inativo") return forbidden("Webhook desativado.")

    // 2. Validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest("Body JSON inválido.")
    }

    const parsed = leadSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, telefone, email } = parsed.data

    // 3. Round-robin: pick flow with fewest sends
    const flow = webhook.webhook_flows[0] ?? null

    // 4. Create Lead record
    const lead = await prisma.lead.create({
      data: {
        webhook_id: webhook.id,
        campanha_id: webhook.campanha_id || null,
        webhook_flow_id: flow?.id || null,
        flow_executado: flow?.flow_ns || null,
        conta_nome: flow?.conta.nome || null,
        nome,
        telefone,
        email: email || null,
        status: "pendente",
      },
    })

    // 5. Increment flow counter
    if (flow) {
      await prisma.webhookFlow.update({
        where: { id: flow.id },
        data: { total_enviados: { increment: 1 } },
      })
    }

    // 6. Queue job for async processing
    if (flow) {
      addWebhookJob({
        leadId: lead.id,
        webhookId: webhook.id,
        contaId: flow.conta_id,
        flowNs: flow.flow_ns,
        nome,
        telefone,
        email: email || undefined,
      }).catch((err) => console.error("[addWebhookJob] Redis unavailable:", err))
    }

    return ok({ ok: true, lead_id: lead.id })
  } catch (error) {
    console.error("[POST /api/webhook/[token]]", error)
    return serverError()
  }
}
