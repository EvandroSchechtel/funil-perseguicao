import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarConta, atualizarConta, deletarConta } from "@/lib/services/contas.service"

const updateContaSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  api_key: z.string().min(1).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
  whatsapp_field_id: z.number().int().positive().nullable().optional(),
})

// GET /api/admin/contas/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarConta(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PUT /api/admin/contas/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = updateContaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await atualizarConta(id, parsed.data)
    return ok(result)
  } catch (error) {
    console.error("[PUT /api/admin/contas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE /api/admin/contas/[id] — soft delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await deletarConta(id)
    return ok(result)
  } catch (error) {
    console.error("[DELETE /api/admin/contas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
