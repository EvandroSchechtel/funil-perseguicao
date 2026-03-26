import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getGroupsAndCommunities } from "@/lib/zapi/client"
import { escanearEAutoVincular } from "@/lib/services/grupo-auto-vincular.service"
import { sincronizarGruposCache } from "@/lib/services/zapi.service"

// Allows time for paginated group fetching across large accounts
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/zapi/instancias/[id]/escanear-grupos
// Fetches all Z-API groups and auto-links similar ones to existing GrupoMonitoramento templates.
export async function POST(request: NextRequest, { params }: Ctx) {
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

    const grupos = await getGroupsAndCommunities(inst.instance_id, inst.token, inst.client_token)
    await sincronizarGruposCache(id, grupos)
    const result = await escanearEAutoVincular(id, grupos)

    return ok(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
