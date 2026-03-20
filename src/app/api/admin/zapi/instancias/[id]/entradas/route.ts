import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarEntradas } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/zapi/instancias/[id]/entradas?grupo_id=<gid>
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const grupoId = request.nextUrl.searchParams.get("grupo_id") ?? undefined

    const entradas = await listarEntradas(id, grupoId)
    return ok({ entradas })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
