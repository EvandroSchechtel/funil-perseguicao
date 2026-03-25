import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/campanhas/[id]/grupos
// Returns all monitoring groups for a campaign with entry counts
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id: campanha_id } = await params

    const grupos = await prisma.grupoMonitoramento.findMany({
      where: { campanha_id },
      select: {
        id: true,
        nome_filtro: true,
        grupo_wa_id: true,
        tag_manychat_id: true,
        tag_manychat_nome: true,
        status: true,
        created_at: true,
        instancia: { select: { id: true, nome: true } },
        conta_manychat: { select: { id: true, nome: true } },
        _count: { select: { entradas: true } },
      },
      orderBy: { created_at: "desc" },
    })

    return ok({ grupos })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
