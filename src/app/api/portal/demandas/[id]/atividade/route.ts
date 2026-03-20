import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarEventos } from "@/lib/services/demandas.service"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "portal:read")) return forbidden("Sem permissão.")
    if (!user.cliente_id) return forbidden("Sem cliente vinculado.")

    const { id } = await params
    const result = await listarEventos(id, user.cliente_id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/portal/demandas/[id]/atividade]", error)
    return handleServiceError(error) ?? serverError()
  }
}
