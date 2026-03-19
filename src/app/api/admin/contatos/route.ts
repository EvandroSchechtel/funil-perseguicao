import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarContatos } from "@/lib/services/contatos.service"

// GET /api/admin/contatos
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { searchParams } = new URL(request.url)
    const result = await listarContatos({
      page: Number(searchParams.get("page") || 1),
      perPage: Number(searchParams.get("per_page") || 20),
      search: searchParams.get("search") || "",
    })
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/contatos]", error)
    return handleServiceError(error) ?? serverError()
  }
}
