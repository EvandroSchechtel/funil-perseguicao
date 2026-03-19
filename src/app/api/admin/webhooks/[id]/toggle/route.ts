import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { toggleWebhook } from "@/lib/services/webhooks.service"

// PATCH /api/admin/webhooks/[id]/toggle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:toggle")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await toggleWebhook(id)
    return ok(result)
  } catch (error) {
    console.error("[PATCH /api/admin/webhooks/[id]/toggle]", error)
    return handleServiceError(error) ?? serverError()
  }
}
