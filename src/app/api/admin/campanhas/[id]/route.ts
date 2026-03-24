import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarCampanha, atualizarCampanha, deletarCampanha } from "@/lib/services/campanhas.service"

const updateCampanhaSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  descricao: z.string().max(1000).nullable().optional(),
  data_inicio: z.coerce.date().nullable().optional(),
  data_fim: z.coerce.date().nullable().optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  instancia_zapi_id: z.string().nullable().optional(),
})

// GET /api/admin/campanhas/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarCampanha(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/campanhas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PATCH /api/admin/campanhas/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = updateCampanhaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await atualizarCampanha(id, parsed.data)
    return ok(result)
  } catch (error) {
    console.error("[PATCH /api/admin/campanhas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE /api/admin/campanhas/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await deletarCampanha(id)
    return ok(result)
  } catch (error) {
    console.error("[DELETE /api/admin/campanhas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
