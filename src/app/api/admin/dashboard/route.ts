import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError } from "@/lib/api/response"
import { getMetricas } from "@/lib/services/dashboard.service"

// GET /api/admin/dashboard
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dashboard:read")) return forbidden("Sem permissão.")

    const result = await getMetricas()
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/dashboard]", error)
    return serverError()
  }
}
