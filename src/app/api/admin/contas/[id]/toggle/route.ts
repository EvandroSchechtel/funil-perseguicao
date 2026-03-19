import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { toggleConta } from "@/lib/services/contas.service"

// PATCH /api/admin/contas/[id]/toggle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await toggleConta(id)
    return ok(result)
  } catch (error) {
    console.error("[PATCH /api/admin/contas/[id]/toggle]", error)
    return handleServiceError(error) ?? serverError()
  }
}
