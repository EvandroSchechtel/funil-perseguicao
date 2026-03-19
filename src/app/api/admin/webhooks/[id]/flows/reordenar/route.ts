import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { reordenarFlows } from "@/lib/services/webhook_flows.service"

const reordenarSchema = z.object({
  flow_ids: z.array(z.string().uuid()).min(1, "Lista de flows é obrigatória"),
})

// POST /api/admin/webhooks/[id]/flows/reordenar
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
    const parsed = reordenarSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await reordenarFlows(id, parsed.data.flow_ids)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/webhooks/[id]/flows/reordenar]", error)
    return handleServiceError(error) ?? serverError()
  }
}
