import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { addWebhookJob } from "@/lib/queue/queues"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"
import { getTodayUsageMap, msUntilMidnightBRT } from "@/lib/services/uso-diario.service"
import { parseWebhookPayload } from "@/lib/webhook/payload-parser"

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
        campanha: { select: { pausado_at: true } },
        webhook_flows: {
          where: { status: "ativo", deleted_at: null },
          select: {
            id: true,
            flow_ns: true,
            flow_nome: true,
            ordem: true,
            total_enviados: true,
            conta_id: true,
            conta: { select: { nome: true, limite_diario: true } },
          },
          orderBy: [{ total_enviados: "asc" }, { ordem: "asc" }],
        },
      },
    })

    if (!webhook) return notFound("Webhook não encontrado.")
    if (webhook.status === "inativo") return forbidden("Webhook desativado.")

    // 2. Parse body — suporta JSON, form-encoded, ActiveCampaign, RD Station, Hotmart, Kiwify, Eduzz
    const body = await parseWebhookPayload(request)

    const parsed = leadSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, telefone, email } = parsed.data

    const campanhaPausada = !!(webhook.campanha && webhook.campanha.pausado_at)

    // 3. Round-robin: pick flow with fewest sends, skipping accounts at daily limit
    const allFlows = webhook.webhook_flows
    const contaIds = [...new Set(allFlows.map((f) => f.conta_id))]
    const usageMap = campanhaPausada ? new Map<string, number>() : await getTodayUsageMap(contaIds)

    const availableFlows = campanhaPausada
      ? allFlows // when paused, assign round-robin without daily limit check
      : allFlows.filter((f) => {
          const limite = f.conta.limite_diario
          if (!limite) return true
          return (usageMap.get(f.conta_id) ?? 0) < limite
        })

    const flow = availableFlows[0] ?? null
    const allAtLimit = !campanhaPausada && allFlows.length > 0 && availableFlows.length === 0

    // 4. Upsert Contato by telefone (pessoa = número de celular)
    const contato = await prisma.contato.upsert({
      where: { telefone },
      update: { nome, email: email || null },
      create: { telefone, nome, email: email || null },
      select: { id: true },
    })

    // 5. Upsert Lead by (webhook_id, contato_id)
    //    - processando → skip (already in flight)
    //    - aguardando + campanha ainda pausada → update data, stay aguardando
    //    - falha/sem_optin/pendente → reuse, reset to pendente (or aguardando if paused)
    //    - sucesso → create new (legitimate re-send after success)
    const existing = await prisma.lead.findUnique({
      where: { webhook_id_contato_id: { webhook_id: webhook.id, contato_id: contato.id } },
      select: { id: true, status: true },
    })

    let leadId: string
    const targetStatus = campanhaPausada ? "aguardando" : "pendente"

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
          status: targetStatus,
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
          status: targetStatus,
        },
      })
      leadId = lead.id
    }

    // 6. Increment flow counter (always — so round-robin stays accurate when paused)
    if (flow) {
      await prisma.webhookFlow.update({
        where: { id: flow.id },
        data: { total_enviados: { increment: 1 } },
      })
    }

    // 7. Queue job — skip when paused (leads sit as aguardando until released)
    if (!campanhaPausada) {
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
      } else if (allAtLimit) {
        // All accounts at daily limit — schedule for next midnight BRT
        const delay = msUntilMidnightBRT()
        const firstFlow = allFlows[0]
        if (firstFlow) {
          addWebhookJob(
            { leadId, webhookId: webhook.id, contaId: firstFlow.conta_id, flowNs: firstFlow.flow_ns, nome, telefone, email: email || undefined },
            { delay }
          ).catch((err) => console.error("[addWebhookJob] Redis unavailable:", err))
          console.log(`[Webhook] All accounts at daily limit — job delayed ${Math.round(delay / 60000)}min`)
        }
      }
    }

    return ok({ ok: true, lead_id: leadId, queued: campanhaPausada })
  } catch (error) {
    console.error("[POST /api/webhook/[token]]", error)
    return serverError()
  }
}
