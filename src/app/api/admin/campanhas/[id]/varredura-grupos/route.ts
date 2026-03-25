import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { forbidden, serverError, handleServiceError, ok } from "@/lib/api/response"
import { varredarGruposCampanha } from "@/lib/services/varredura-grupos.service"

// Allows up to 5 minutes for large groups
export const maxDuration = 300

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/campanhas/[id]/varredura-grupos
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const resultado = await varredarGruposCampanha(id)
    return ok({ message: "Varredura concluída.", resultado })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
