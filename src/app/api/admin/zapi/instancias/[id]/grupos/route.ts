import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { forbidden, serverError, handleServiceError, created, ok, badRequest } from "@/lib/api/response"
import { criarGrupo, batchCriarGrupos } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

const contasAdicionaisSchema = z.array(z.object({
  conta_id: z.string().min(1),
  tag_id: z.number().int().positive(),
  tag_nome: z.string().min(1),
})).optional()

const baseSchema = z.object({
  campanha_id: z.string().min(1, "Campanha obrigatória"),
  conta_manychat_id: z.string().min(1, "Conta Manychat obrigatória"),
  tag_manychat_id: z.number().int().positive("ID da tag deve ser um número positivo"),
  tag_manychat_nome: z.string().min(1, "Nome da tag obrigatório"),
  auto_expand: z.boolean().optional(),
  contas_adicionais: contasAdicionaisSchema,
})

const singleSchema = baseSchema.extend({
  nome_filtro: z.string().min(1, "Nome do grupo obrigatório"),
})

const batchSchema = baseSchema.extend({
  grupos: z.array(z.object({ nome: z.string().min(1), phone: z.string() })).min(1, "Selecione ao menos um grupo"),
})

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const { id: instancia_id } = await params
    const body = await request.json()

    // Batch mode: body contains grupos[] array
    if (Array.isArray(body.grupos)) {
      const parsed = batchSchema.safeParse(body)
      if (!parsed.success) {
        return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }
      const { contas_adicionais, ...rest } = parsed.data
      const result = await batchCriarGrupos({
        instancia_id,
        ...rest,
        ...(contas_adicionais && { contas: contas_adicionais }),
      })
      return ok(result)
    }

    // Single mode (legado)
    const parsed = singleSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }
    const { contas_adicionais, ...rest } = parsed.data
    const result = await criarGrupo({
      instancia_id,
      ...rest,
      ...(contas_adicionais && { contas: contas_adicionais }),
    })
    return created(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
