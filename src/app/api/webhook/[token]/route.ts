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
        status: true,
        campanha_id: true,
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
    try { body = await request.json() } catch {
      return badRequest("Body JSON inválido.")
    }

    const parsed = leadSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, telefone, email } = parsed.data

    // 3. Round-robin: pick flow with fewest sends
    const flow = webhook.webhook_flows[0] ?? null

    // 4. Upsert Contato by telefone (pessoa = número de celular)
    const contato = await prisma.contato.upsert({
      where: { telefone },
      update: { nome, email: email || null },
      create: { telefone, nome, email: email || null },
      select: { id: true },
    })

    // 5. Upsert Lead by (webhook_id, contato_id)
    //    - processando → skip (already in flight)
    //    - falha/sem_optin/pendente → reuse, reset to pendente
    //    - sucesso → create new (legitimate re-send after success)
    const existing = await prisma.lead.findUnique({
      where: { webhook_id_contato_id: { webhook_id: webhook.id, contato_id: contato.id } },
      select: { id: true, status: true },
    })

    let leadId: string

    if (existing?.status === "processando") {
      return ok({ ok: true, lead_id: existing.id, deduped: true })
    }

    if (existing && existing.status !== "sucesso") {
      await prisma.lead.update({
        where: { id: existing.id },
        data: {
          nome,
          email: email || null,
          webhook_flow_id: flow?.id ?? null,
          flow_executado: flow?.flow_ns ?? null,
          conta_nome: flow?.conta.nome ?? null,
          status: "pendente",
          erro_msg: null,
        },
      })
      leadId = existing.id
    } else {
      const lead = await prisma.lead.create({
        data: {
          contato_id: contato.id,
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
      leadId = lead.id
    }

    // 6. Increment flow counter
    if (flow) {
      await prisma.webhookFlow.update({
        where: { id: flow.id },
        data: { total_enviados: { increment: 1 } },
      })
    }

    // 7. Queue job
    if (flow) {
      addWebhookJob({
        leadId,
        webhookId: webhook.id,
        contaId: flow.conta_id,
        flowNs: flow.flow_ns,
        nome,
        telefone,
        email: email || undefined,
      }).catch((err) => console.error("[addWebhookJob] Redis unavailable:", err))
    }

    return ok({ ok: true, lead_id: leadId })
  } catch (error) {
    console.error("[POST /api/webhook/[token]]", error)
    return serverError()
  }
}
