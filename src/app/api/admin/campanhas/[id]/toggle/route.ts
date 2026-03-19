import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { toggleCampanha } from "@/lib/services/campanhas.service"

// POST /api/admin/campanhas/[id]/toggle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await toggleCampanha(id)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/campanhas/[id]/toggle]", error)
    return handleServiceError(error) ?? serverError()
  }
}
