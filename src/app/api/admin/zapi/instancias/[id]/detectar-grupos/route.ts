import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroups } from "@/lib/zapi/client"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/zapi/instancias/[id]/detectar-grupos
// Proxies Z-API /chats to return only groups — for the UI picker
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const inst = await prisma.instanciaZApi.findFirst({
      where: { id, deleted_at: null },
      select: { instance_id: true, token: true, client_token: true },
    })
    if (!inst) return (await import("@/lib/api/response")).notFound("Instância não encontrada.")

    const grupos = await getGroups(inst.instance_id, inst.token, inst.client_token)
    return ok({ grupos })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
