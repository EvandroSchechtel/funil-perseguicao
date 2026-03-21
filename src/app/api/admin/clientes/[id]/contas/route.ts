import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { adicionarContaAoCliente } from "@/lib/services/clientes.service"

const addContaSchema = z.object({
  nome: z.string().min(1, "Nome da conta é obrigatório").max(200),
  api_key: z.string().min(1, "API Key é obrigatória"),
  whatsapp_field_id: z.number().int().positive().nullable().optional(),
})

// POST /api/admin/clientes/[id]/contas
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "clientes:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = addContaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await adicionarContaAoCliente(id, {
      nome: parsed.data.nome,
      api_key: parsed.data.api_key,
      whatsapp_field_id: parsed.data.whatsapp_field_id ?? null,
      userId: user.id,
    })
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/clientes/[id]/contas]", error)
    return handleServiceError(error) ?? serverError()
  }
}
