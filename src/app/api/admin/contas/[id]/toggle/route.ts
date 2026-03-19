import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

// PATCH /api/admin/contas/[id]/toggle — ativar / desativar
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Conta não encontrada.")

    const novoStatus = existing.status === "ativo" ? "inativo" : "ativo"

    const conta = await prisma.contaManychat.update({
      where: { id },
      data: { status: novoStatus },
      select: { id: true, status: true },
    })

    return ok({
      conta,
      message: `Conta ${novoStatus === "ativo" ? "ativada" : "desativada"} com sucesso.`,
    })
  } catch (error) {
    console.error("[PATCH /api/admin/contas/[id]/toggle]", error)
    return serverError()
  }
}
