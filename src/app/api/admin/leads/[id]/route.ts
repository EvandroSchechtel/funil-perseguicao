import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarLead } from "@/lib/services/leads.service"

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
