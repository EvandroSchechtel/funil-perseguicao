import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError, badRequest } from "@/lib/api/response"
import { buscarLead, reprocessarLead } from "@/lib/services/leads.service"
import { prisma } from "@/lib/db/prisma"
import { setWhatsappIdField } from "@/lib/manychat/client"

// GET /api/admin/leads/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarLead(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/leads/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PATCH /api/admin/leads/[id] — set subscriber_id manually and optionally reprocess
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { subscriber_id, reprocess = true } = body as { subscriber_id?: string; reprocess?: boolean }

    if (!subscriber_id || typeof subscriber_id !== "string" || !subscriber_id.trim()) {
      return badRequest("subscriber_id é obrigatório.")
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        contato_id: true,
        telefone: true,
        webhook_flow: {
          select: {
            conta_id: true,
            conta: { select: { id: true, api_key: true, whatsapp_field_id: true } },
          },
        },
      },
    })

    if (!lead) return badRequest("Lead não encontrado.")

    // Persist subscriber_id on the lead
    await prisma.lead.update({
      where: { id },
      data: { subscriber_id: subscriber_id.trim() },
    })

    // Also upsert ContatoConta — so the worker uses the correct subscriber_id on next processing
    // (worker reads from ContatoConta, not Lead.subscriber_id, to enforce account-specific lookup)
    if (lead.contato_id && lead.webhook_flow?.conta_id) {
      await prisma.contatoConta.upsert({
        where: { contato_id_conta_id: { contato_id: lead.contato_id, conta_id: lead.webhook_flow.conta_id } },
        update: { subscriber_id: subscriber_id.trim() },
        create: {
          contato_id: lead.contato_id,
          conta_id: lead.webhook_flow.conta_id,
          subscriber_id: subscriber_id.trim(),
        },
      }).catch((e) => console.warn("[PATCH lead] contatoConta.upsert failed:", e))
    }

    // Best-effort: write phone to [esc]whatsapp-id custom field in Manychat
    if (lead.webhook_flow?.conta) {
      const { api_key, whatsapp_field_id } = lead.webhook_flow.conta
      setWhatsappIdField(api_key, subscriber_id.trim(), lead.telefone, whatsapp_field_id).catch(() => {})
    }

    if (reprocess) {
      try {
        await reprocessarLead(id)
        return ok({ message: "Subscriber ID salvo. Lead reenfileirado para reprocessamento." })
      } catch (e) {
        return ok({ message: "Subscriber ID salvo. Não foi possível reenfileirar automaticamente — reprocesse manualmente." })
      }
    }

    return ok({ message: "Subscriber ID salvo com sucesso." })
  } catch (error) {
    console.error("[PATCH /api/admin/leads/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
