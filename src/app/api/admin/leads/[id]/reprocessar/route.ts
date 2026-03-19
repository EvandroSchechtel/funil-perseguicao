import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { reprocessarLead } from "@/lib/services/leads.service"

// POST /api/admin/leads/[id]/reprocessar
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await reprocessarLead(id)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/leads/[id]/reprocessar]", error)
    return handleServiceError(error) ?? serverError()
  }
}
