import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { getTags } from "@/lib/manychat/tags"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/zapi/instancias/[id]/tags-manychat
// Returns Manychat tags from the conta_manychat linked to this instance's grupos
// Query param: ?conta_id=<contaManychatId> to specify which conta to use
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id } = await params
    const contaId = request.nextUrl.searchParams.get("conta_id")

    let apiKey: string | null = null

    if (contaId) {
      const conta = await prisma.contaManychat.findFirst({
        where: { id: contaId, deleted_at: null },
        select: { api_key: true },
      })
      apiKey = conta?.api_key ?? null
    } else {
      // Try to find any conta linked to this instance's grupos
      const grupo = await prisma.grupoMonitoramento.findFirst({
        where: { instancia_id: id, status: "ativo" },
        include: { conta_manychat: { select: { api_key: true } } },
      })
      apiKey = grupo?.conta_manychat?.api_key ?? null
    }

    if (!apiKey) {
      return ok({ tags: [] })
    }

    const tags = await getTags(apiKey)
    return ok({ tags })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
