import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarDemanda } from "@/lib/services/demandas.service"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/portal/demandas/[id]
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "portal:read")) return forbidden("Sem permissão.")

    const clienteId = (user as { cliente_id?: string }).cliente_id
    if (!clienteId) return forbidden("Usuário sem cliente vinculado.")

    const { id } = await params
    const result = await buscarDemanda(id, clienteId)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/portal/demandas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
