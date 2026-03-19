import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { revelarApiKey } from "@/lib/services/contas.service"

// GET /api/admin/contas/[id]/api-key — revela a API key completa (requer api_keys:reveal)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "api_keys:reveal")) return forbidden("Sem permissão para revelar API keys.")

    const { id } = await params
    const result = await revelarApiKey(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]/api-key]", error)
    return handleServiceError(error) ?? serverError()
  }
}
