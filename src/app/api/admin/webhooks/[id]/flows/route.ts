import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarWebhookFlows, adicionarFlow } from "@/lib/services/webhook_flows.service"

const addFlowSchema = z.object({
  tipo: z.enum(["manychat", "webhook"]).default("manychat"),
  conta_id: z.string().uuid("Conta inválida").optional(),
  flow_ns: z.string().min(1).optional(),
  flow_nome: z.string().max(200).optional(),
  ordem: z.number().int().min(0).optional(),
  tag_manychat_id: z.number().int().positive().optional(),
  tag_manychat_nome: z.string().max(200).optional(),
  webhook_url: z.string().url("URL inválida").optional(),
})

// GET /api/admin/webhooks/[id]/flows
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await listarWebhookFlows(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/webhooks/[id]/flows]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// POST /api/admin/webhooks/[id]/flows
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = addFlowSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await adicionarFlow(id, parsed.data)
    return created(result)
  } catch (error) {
    console.error("[POST /api/admin/webhooks/[id]/flows]", error)
    return handleServiceError(error) ?? serverError()
  }
}
