import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { atualizarFlow, removerFlow } from "@/lib/services/webhook_flows.service"

const updateFlowSchema = z.object({
  flow_ns: z.string().min(1).optional(),
  flow_nome: z.string().max(200).nullable().optional(),
  webhook_url: z.string().url("URL inválida").optional(),
  ordem: z.number().int().min(0).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
  tag_manychat_id: z.number().int().positive().nullable().optional(),
  tag_manychat_nome: z.string().max(200).nullable().optional(),
  limite_diario: z.number().int().min(1).nullable().optional(),
})

// PATCH /api/admin/webhooks/[id]/flows/[flowId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { flowId } = await params
    const body = await request.json()
    const parsed = updateFlowSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await atualizarFlow(flowId, parsed.data)
    return ok(result)
  } catch (error) {
    console.error("[PATCH /api/admin/webhooks/[id]/flows/[flowId]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE /api/admin/webhooks/[id]/flows/[flowId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; flowId: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { flowId } = await params
    const result = await removerFlow(flowId)
    return ok(result)
  } catch (error) {
    console.error("[DELETE /api/admin/webhooks/[id]/flows/[flowId]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
