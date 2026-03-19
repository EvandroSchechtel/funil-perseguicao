import { NextRequest } from "next/server"
import { z } from "zod"
import { requireRoles } from "@/lib/api/auth-guard"
import { ok, badRequest, serverError, handleServiceError } from "@/lib/api/response"
import { buscarUsuario, atualizarUsuario, deletarUsuario } from "@/lib/services/usuarios.service"

type Params = { params: Promise<{ id: string }> }

// GET — get user by id
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const { id } = await params
    const data = await buscarUsuario(id)
    return ok(data)
  } catch (error) {
    console.error("[GET /api/admin/usuarios/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

const updateSchema = z.object({
  nome: z.string().min(2).optional(),
  role: z.enum(["super_admin", "admin", "operador", "viewer"]).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
  senha: z.string().min(8).optional(),
  force_password_change: z.boolean().optional(),
})

// PUT — update user
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const data = await atualizarUsuario(id, parsed.data, authResult.context.user.id)
    return ok(data)
  } catch (error) {
    console.error("[PUT /api/admin/usuarios/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE — soft delete user
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const data = await deletarUsuario(id, authResult.context.user.id)
    return ok(data)
  } catch (error) {
    console.error("[DELETE /api/admin/usuarios/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
