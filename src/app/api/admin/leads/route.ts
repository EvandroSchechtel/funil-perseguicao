import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarLeads } from "@/lib/services/leads.service"

// GET /api/admin/leads
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const result = await listarLeads({
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "20", 10),
      search: searchParams.get("q") || "",
      status: searchParams.get("status") || "",
      webhookId: searchParams.get("webhook_id") || "",
      campanhaId: searchParams.get("campanha_id") || "",
    })

    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/leads]", error)
    return handleServiceError(error) ?? serverError()
  }
}
