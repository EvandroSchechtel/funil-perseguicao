import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { atualizarGrupo, deletarGrupo } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string; gid: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { gid } = await params
    const body = await request.json()
    return ok(await atualizarGrupo(gid, body))
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { gid } = await params
    return ok(await deletarGrupo(gid))
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
