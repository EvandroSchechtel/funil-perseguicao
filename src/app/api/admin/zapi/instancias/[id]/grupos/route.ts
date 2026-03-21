import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { forbidden, serverError, handleServiceError, created, badRequest } from "@/lib/api/response"
import { criarGrupo } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

const criarGrupoSchema = z.object({
  campanha_id: z.string().min(1, "Campanha obrigatória"),
  conta_manychat_id: z.string().min(1, "Conta Manychat obrigatória"),
  nome_filtro: z.string().min(1, "Nome do grupo obrigatório"),
  tag_manychat_id: z.number().int().positive("ID da tag deve ser um número positivo"),
  tag_manychat_nome: z.string().min(1, "Nome da tag obrigatório"),
})

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id: instancia_id } = await params
    const body = await request.json()
    const parsed = criarGrupoSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await criarGrupo({ instancia_id, ...parsed.data })
    return created(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
