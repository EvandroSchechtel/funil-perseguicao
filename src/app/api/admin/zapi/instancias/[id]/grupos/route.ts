import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError, created, badRequest } from "@/lib/api/response"
import { criarGrupo } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id: instancia_id } = await params
    const body = await request.json()
    const { campanha_id, conta_manychat_id, nome_filtro, tag_manychat_id, tag_manychat_nome } = body

    if (!campanha_id || !conta_manychat_id || !nome_filtro || !tag_manychat_id || !tag_manychat_nome) {
      return badRequest("campanha_id, conta_manychat_id, nome_filtro, tag_manychat_id e tag_manychat_nome são obrigatórios.")
    }

    const result = await criarGrupo({
      instancia_id,
      campanha_id,
      conta_manychat_id,
      nome_filtro,
      tag_manychat_id: Number(tag_manychat_id),
      tag_manychat_nome,
    })
    return created(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
