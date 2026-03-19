import { NextRequest } from "next/server"
import { requireRoles } from "@/lib/api/auth-guard"
import { ok, serverError, handleServiceError } from "@/lib/api/response"
import { resetarSenha } from "@/lib/services/usuarios.service"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const data = await resetarSenha(id)
    return ok(data)
  } catch (error) {
    console.error("[POST /api/admin/usuarios/[id]/reset-senha]", error)
    return handleServiceError(error) ?? serverError()
  }
}
