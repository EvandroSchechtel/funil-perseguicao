import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { requireRoles } from "@/lib/api/auth-guard"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { ok, badRequest, notFound, conflict, forbidden, serverError } from "@/lib/api/response"

type Params = { params: Promise<{ id: string }> }

// GET — get user by id
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const { id } = await params

    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        avatar_url: true,
        status: true,
        force_password_change: true,
        ultimo_login: true,
        created_at: true,
        updated_at: true,
      },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    return ok({ data: usuario })
  } catch (error) {
    console.error("[GET /api/admin/usuarios/[id]]", error)
    return serverError()
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
    const currentUserId = authResult.context.user.id

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    const { nome, role, status, senha, force_password_change } = parsed.data

    // Prevent downgrading the last super_admin
    if (role && role !== "super_admin" && usuario.role === "super_admin") {
      const superAdminCount = await prisma.usuario.count({
        where: { role: "super_admin", deleted_at: null, status: "ativo" },
      })
      if (superAdminCount <= 1) {
        return forbidden("Não é possível alterar o perfil do único super_admin do sistema.")
      }
    }

    const updateData: Record<string, unknown> = {}
    if (nome !== undefined) updateData.nome = nome
    if (role !== undefined) updateData.role = role
    if (status !== undefined) updateData.status = status
    if (force_password_change !== undefined) updateData.force_password_change = force_password_change
    if (senha) updateData.senha = await bcrypt.hash(senha, 12)

    // If deactivating, revoke all tokens
    if (status === "inativo" && usuario.status === "ativo") {
      await revokeAllUserTokens(id)
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        status: true,
        force_password_change: true,
        updated_at: true,
      },
    })

    return ok({ data: updated })
  } catch (error) {
    console.error("[PUT /api/admin/usuarios/[id]]", error)
    return serverError()
  }
}

// DELETE — soft delete user
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const currentUserId = authResult.context.user.id

    if (id === currentUserId) {
      return forbidden("Você não pode excluir sua própria conta.")
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    // Prevent deleting the last super_admin
    if (usuario.role === "super_admin") {
      const count = await prisma.usuario.count({
        where: { role: "super_admin", deleted_at: null },
      })
      if (count <= 1) {
        return forbidden("Não é possível excluir o único super_admin do sistema.")
      }
    }

    // Revoke tokens and soft delete
    await revokeAllUserTokens(id)
    await prisma.usuario.update({
      where: { id },
      data: { deleted_at: new Date() },
    })

    return ok({ message: "Usuário excluído com sucesso." })
  } catch (error) {
    console.error("[DELETE /api/admin/usuarios/[id]]", error)
    return serverError()
  }
}
