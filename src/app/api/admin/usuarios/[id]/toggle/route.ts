import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { requireRoles } from "@/lib/api/auth-guard"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params
    const currentUserId = authResult.context.user.id

    if (id === currentUserId) {
      return forbidden("Você não pode desativar sua própria conta.")
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    const novoStatus = usuario.status === "ativo" ? "inativo" : "ativo"

    // Prevent deactivating the last super_admin
    if (novoStatus === "inativo" && usuario.role === "super_admin") {
      const count = await prisma.usuario.count({
        where: { role: "super_admin", status: "ativo", deleted_at: null },
      })
      if (count <= 1) {
        return forbidden("Não é possível desativar o único super_admin ativo do sistema.")
      }
    }

    if (novoStatus === "inativo") {
      await revokeAllUserTokens(id)
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { status: novoStatus },
      select: { id: true, status: true },
    })

    return ok({ data: updated })
  } catch (error) {
    console.error("[PATCH /api/admin/usuarios/[id]/toggle]", error)
    return serverError()
  }
}
