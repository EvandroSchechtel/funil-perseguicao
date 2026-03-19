import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarCliente, atualizarCliente, deletarCliente } from "@/lib/services/clientes.service"

const updateClienteSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  telefone: z.string().max(30).nullable().optional(),
})

// GET /api/admin/clientes/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "clientes:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarCliente(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/clientes/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PATCH /api/admin/clientes/[id]
export async function PATCH(
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
    const parsed = updateClienteSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const data = parsed.data
    const result = await atualizarCliente(id, {
      nome: data.nome,
      email: data.email === "" ? null : data.email,
      telefone: data.telefone,
    })
    return ok(result)
  } catch (error) {
    console.error("[PATCH /api/admin/clientes/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE /api/admin/clientes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "clientes:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await deletarCliente(id)
    return ok(result)
  } catch (error) {
    console.error("[DELETE /api/admin/clientes/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
