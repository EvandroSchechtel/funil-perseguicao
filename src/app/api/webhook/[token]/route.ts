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

    // 1. Find webhook by token
    const webhook = await prisma.webhook.findFirst({
      where: { token, deleted_at: null },
      select: {
        id: true,
        nome: true,
        conta_id: true,
        flow_ns: true,
        status: true,
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

    // 3. Create Lead record
    const lead = await prisma.lead.create({
      data: {
        webhook_id: webhook.id,
        nome,
        telefone,
        email: email || null,
        status: "pendente",
      },
    })

    // 4. Queue job for async processing (best-effort — lead stays as pendente if Redis is down)
    addWebhookJob({
      leadId: lead.id,
      webhookId: webhook.id,
      contaId: webhook.conta_id,
      flowNs: webhook.flow_ns,
      nome,
      telefone,
      email: email || undefined,
    }).catch((err) => console.error("[addWebhookJob] Redis unavailable, lead queued manually later:", err))

    return ok({ ok: true, lead_id: lead.id })
  } catch (error) {
    console.error("[POST /api/webhook/[token]]", error)
    return serverError()
  }
}
