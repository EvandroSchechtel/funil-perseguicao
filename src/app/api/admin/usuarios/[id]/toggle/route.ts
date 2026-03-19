import { NextRequest } from "next/server"
import { requireRoles } from "@/lib/api/auth-guard"
import { ok, serverError, handleServiceError } from "@/lib/api/response"
import { toggleUsuario } from "@/lib/services/usuarios.service"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const data = await toggleUsuario(id, authResult.context.user.id)
    return ok(data)
  } catch (error) {
    console.error("[PATCH /api/admin/usuarios/[id]/toggle]", error)
    return handleServiceError(error) ?? serverError()
  }
}
