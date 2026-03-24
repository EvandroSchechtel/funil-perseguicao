import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { reprocessarFalhas } from "@/lib/services/leads.service"

// POST /api/admin/leads/reprocessar-falhas — bulk requeue all failed leads
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const webhookId = request.nextUrl.searchParams.get("webhook_id") || undefined
    const contaId = request.nextUrl.searchParams.get("conta_id") || undefined
    const result = await reprocessarFalhas(webhookId, contaId)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/leads/reprocessar-falhas]", error)
    return handleServiceError(error) ?? serverError()
  }
}
